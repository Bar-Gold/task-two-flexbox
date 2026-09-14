import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { parse } from "node-html-parser";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const read = (relative) => readFileSync(join(ROOT, relative), "utf8");
export const exists = (relative) => existsSync(join(ROOT, relative));

export const html = read("index.html");
export const doc = parse(html, { comment: true });

export const cssFiles = ["css/reset.css", "css/tokens.css", "css/style.css"];
export const css = cssFiles.map(read).join("\n");

export const jsFiles = ["js/theme.js", "js/levels.js", "js/game.js"];
export const js = jsFiles.map(read).join("\n");

/* levels.js only assigns to window.FLEX_DOCK, so it runs happily in a sandbox. */
export const gameData = (() => {
  const sandbox = { window: {} };
  vm.runInNewContext(read("js/levels.js"), sandbox);
  /* Objects born in the sandbox have foreign prototypes, which trips
     deepStrictEqual; a JSON round trip brings them into this realm. */
  return JSON.parse(JSON.stringify(sandbox.window.FLEX_DOCK));
})();

export const { properties, levels } = gameData;

export const propertyByName = (name) => properties.find((p) => p.name === name);

/** The full value map a level's solution container ends up with. */
export const solutionOf = (level) => {
  const values = Object.fromEntries(properties.map((p) => [p.name, p.initial]));
  return { ...values, display: "flex", ...level.solution };
};

/** The full value map a level starts from. */
export const startOf = (level) => {
  const values = Object.fromEntries(properties.map((p) => [p.name, p.initial]));
  return { ...values, ...level.start };
};

/* ------------------------------------------------------------------ colour */

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

export const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/* ------------------------------------------------- custom property parsing */

const declarationsIn = (block) => {
  const out = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[name] = value.trim();
  }
  return out;
};

const blockAt = (text, from) => {
  const start = text.indexOf("{", from);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return { body: text.slice(start + 1, i), end: i };
    }
  }
  return null;
};

const tokensCss = read("css/tokens.css");

/** Bodies of every top-level `:root {` (not inside @media) – the light theme plus shared tokens. */
const lightBodies = () => {
  const bodies = [];
  const mediaRanges = [];
  for (const m of tokensCss.matchAll(/@media[^{]*/g)) {
    const block = blockAt(tokensCss, m.index);
    if (block) mediaRanges.push([m.index, block.end]);
  }
  const insideMedia = (i) => mediaRanges.some(([s, e]) => i >= s && i <= e);
  for (const m of tokensCss.matchAll(/(^|\n):root\s*\{/g)) {
    const at = m.index + m[0].indexOf(":root");
    if (insideMedia(at)) continue;
    const block = blockAt(tokensCss, at);
    if (block) bodies.push(block.body);
  }
  return bodies;
};

/** Body of `:root[data-theme="dark"] {` – the explicit dark theme. */
const darkBody = () => {
  const m = tokensCss.match(/:root\[data-theme="dark"\]\s*\{/);
  return m ? blockAt(tokensCss, m.index).body : "";
};

/** Body of the `:root:not([data-theme="light"])` block inside prefers-color-scheme. */
const osDarkBody = () => {
  const m = tokensCss.match(/:root:not\(\[data-theme="light"\]\)\s*\{/);
  return m ? blockAt(tokensCss, m.index).body : "";
};

const merge = (bodies) => bodies.reduce((acc, body) => Object.assign(acc, declarationsIn(body)), {});

const resolveIn = (map, name, seen = new Set()) => {
  let value = map[name];
  while (value && /^var\(\s*(--[\w-]+)\s*\)$/.test(value)) {
    const next = value.match(/^var\(\s*(--[\w-]+)\s*\)$/)[1];
    if (seen.has(next)) return null;
    seen.add(next);
    value = map[next];
  }
  return value ?? null;
};

export const themes = (() => {
  const light = merge(lightBodies());
  const dark = { ...light, ...merge([darkBody()]) };
  const resolved = (map) => {
    const out = {};
    for (const name of Object.keys(map)) {
      const value = resolveIn(map, name);
      if (value && /^#[0-9a-f]{3,8}$/i.test(value)) out[name] = value;
    }
    return out;
  };
  return {
    light: resolved(light),
    dark: resolved(dark),
    rawDark: declarationsIn(darkBody()),
    rawOsDark: declarationsIn(osDarkBody()),
  };
})();

/* -------------------------------------------------------------- extraction */

export const htmlAssetRefs = () => {
  const refs = new Set();
  for (const el of doc.querySelectorAll("[src], [href]")) {
    for (const attr of ["src", "href"]) {
      const v = el.getAttribute(attr);
      if (v && !/^(https?:|mailto:|tel:|data:|#)/.test(v)) refs.add(v.split("?")[0]);
    }
  }
  return [...refs];
};

export const cssAssetRefs = () =>
  cssFiles.flatMap((file) => {
    const dir = dirname(file);
    return [...read(file).matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)]
      .map((m) => m[1])
      .filter((u) => !/^(https?:|data:)/.test(u))
      .map((u) => ({ file, ref: u, path: join(dir, u).replaceAll("\\", "/") }));
  });

export const fontCssRefs = () => {
  const dir = "assets/fonts";
  return [...read("assets/fonts/fonts.css").matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => ({
    ref: m[1],
    path: `${dir}/${m[1]}`,
  }));
};
