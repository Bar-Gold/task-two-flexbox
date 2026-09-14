/**
 * Builds the submission ZIP.
 *
 * Only the game itself goes in: index.html, css/, js/, assets/ and the README.
 * The validation tooling, the git metadata and the linter configs stay out,
 * so what the grader unzips is exactly what GitHub Pages serves.
 *
 *   node tools/make-zip.mjs        (or: cd tools && npm run zip)
 */
import { createWriteStream } from "node:fs";
import { readdir, stat, readFile } from "node:fs/promises";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDeflateRaw } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { PassThrough } from "node:stream";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INCLUDE = ["index.html", "README.md", "css", "js", "assets"];
const OUT = join(ROOT, "flex-dock-submission.zip");
const PREFIX = "flex-dock/";

const walk = async (path, acc = []) => {
  if ((await stat(path)).isFile()) {
    acc.push(path);
    return acc;
  }
  for (const entry of await readdir(path)) await walk(join(path, entry), acc);
  return acc;
};

/* --- a minimal ZIP writer; no dependency needed for a job this small ----- */

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const deflate = async (buf) => {
  const chunks = [];
  const sink = new PassThrough();
  sink.on("data", (c) => chunks.push(c));
  const source = new PassThrough();
  source.end(buf);
  await pipeline(source, createDeflateRaw({ level: 9 }), sink);
  return Buffer.concat(chunks);
};

const files = (await Promise.all(INCLUDE.map((i) => walk(join(ROOT, i))))).flat().sort();

const chunks = [];
const central = [];
let offset = 0;

for (const file of files) {
  const name = PREFIX + relative(ROOT, file).replaceAll("\\", "/");
  const raw = await readFile(file);
  const packed = await deflate(raw);
  const nameBuf = Buffer.from(name, "utf8");

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);          // version needed
  local.writeUInt16LE(0x0800, 6);      // UTF-8 filenames
  local.writeUInt16LE(8, 8);           // deflate
  local.writeUInt32LE(crc32(raw), 14);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);

  chunks.push(local, nameBuf, packed);

  const dir = Buffer.alloc(46);
  dir.writeUInt32LE(0x02014b50, 0);
  dir.writeUInt16LE(20, 4);
  dir.writeUInt16LE(20, 6);
  dir.writeUInt16LE(0x0800, 8);
  dir.writeUInt16LE(8, 10);
  dir.writeUInt32LE(crc32(raw), 16);
  dir.writeUInt32LE(packed.length, 20);
  dir.writeUInt32LE(raw.length, 24);
  dir.writeUInt16LE(nameBuf.length, 28);
  dir.writeUInt32LE(offset, 42);
  central.push(dir, nameBuf);

  offset += local.length + nameBuf.length + packed.length;
}

const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);

const out = createWriteStream(OUT);
out.write(Buffer.concat([...chunks, centralBuf, end]));
out.end();

const total = Buffer.concat([...chunks, centralBuf, end]).length;
console.log(`${relative(ROOT, OUT)}  ${(total / 1024).toFixed(0)} KB  (${files.length} files)`);
for (const f of files) console.log("  " + PREFIX + relative(ROOT, f).replaceAll("\\", "/"));
