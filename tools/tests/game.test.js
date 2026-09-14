/* Plays the whole game in a real (headless) Chrome through the actual UI:
   clicks the radio labels, the check / reset / next buttons, the level map,
   the theme toggle, and reloads to check that progress survives.

   Needs Chrome installed. Set CHROME_PATH to point at another binary. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { ROOT, levels, properties, solutionOf, startOf } from "./helpers.js";

const CHROME =
  process.env.CHROME_PATH ||
  ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"].find(existsSync);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

let server;
let browser;
let page;
let origin;
const problems = [];

before(async () => {
  assert.ok(CHROME, "Chrome not found; set CHROME_PATH");
  server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = join(ROOT, path === "/" ? "index.html" : path);
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;

  browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  page = await browser.newPage();
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()}`));
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`);
  });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${origin}/index.html`, { waitUntil: "load" });
});

after(async () => {
  await browser?.close();
  server?.close();
});

/* ------------------------------------------------------------ helpers */

const text = (selector) => page.$eval(selector, (el) => el.textContent.trim());
const hidden = (selector) => page.$eval(selector, (el) => el.hidden || getComputedStyle(el).display === "none");
const values = () => page.evaluate(() => window.FLEX_DOCK.debug.getValues());
const levelIndex = () => page.evaluate(() => window.FLEX_DOCK.debug.getLevelIndex());

const choose = async (name, value) => {
  const id = await page.$eval(`input[name="${name}"][value="${value}"]`, (el) => el.id);
  await page.click(`label[for="${id}"]`);
};

const check = () => page.click("#check");
const clickReset = () => page.click("#reset");
const next = () => page.click("#next");

const feedbackState = async () => ({
  text: await text("#feedback"),
  error: await page.$eval("#feedback", (el) => el.classList.contains("is-error")),
  info: await page.$eval("#feedback", (el) => el.classList.contains("is-info")),
});

const board = () =>
  page.$eval("#board", (el) => {
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });

/* ------------------------------------------------------------- tests */

test("loads with the first level, no console errors, and a 320x320 board", async () => {
  assert.equal(await text("#level-indicator"), `שלב 1 מתוך ${levels.length}`);
  assert.equal(await text("#level-title"), levels[0].title);
  assert.equal(await text("#level-instruction"), levels[0].instruction);
  assert.deepEqual(await board(), { width: 320, height: 320 });
  assert.deepEqual(problems, []);
});

test("the pads follow the solution and the ships follow the player", async () => {
  const counts = await page.evaluate(() => ({
    pads: document.querySelectorAll("#pads .pad").length,
    ships: document.querySelectorAll("#dock .ship").length,
    padsDisplay: getComputedStyle(document.getElementById("pads")).display,
    dockDisplay: getComputedStyle(document.getElementById("dock")).display,
  }));
  assert.equal(counts.pads, levels[0].ships);
  assert.equal(counts.ships, levels[0].ships);
  assert.equal(counts.padsDisplay, "flex");
  assert.equal(counts.dockDisplay, "block");
});

test("only the level's controls are shown; the rest are hidden and disabled", async () => {
  const state = await page.$$eval("fieldset.prop", (els) =>
    els.map((el) => ({ name: el.dataset.prop, hidden: el.hidden, disabled: el.disabled }))
  );
  for (const s of state) {
    const enabled = levels[0].controls.includes(s.name);
    assert.equal(s.hidden, !enabled, `${s.name} hidden`);
    assert.equal(s.disabled, !enabled, `${s.name} disabled`);
  }
});

test("the live CSS panel shows the current values", async () => {
  const code = await text("#code");
  assert.match(code, /\.dock \{/);
  assert.match(code, /display: block;/);
});

test("plays every level: wrong first, reset, then the solution", async () => {
  for (const [i, level] of levels.entries()) {
    const at = `level ${i + 1} (${level.title})`;
    assert.equal(await levelIndex(), i, at);
    assert.equal(await text("#level-indicator"), `שלב ${i + 1} מתוך ${levels.length}`, at);
    assert.equal(await text("#level-instruction"), level.instruction, at);
    assert.deepEqual(await values(), startOf(level), `${at}: start values`);

    const padCount = await page.$$eval("#pads .pad", (els) => els.length);
    assert.equal(padCount, level.ships, `${at}: pads`);

    /* the start state must not pass */
    await check();
    let fb = await feedbackState();
    assert.ok(fb.error, `${at}: start state was accepted: ${fb.text}`);
    assert.match(fb.text, /עגנ/, at);
    assert.equal(await text("#attempts"), "1", at);
    assert.ok(await hidden("#success"), at);

    /* change something, reset, and the start state is back */
    const firstControl = level.controls[level.controls.length - 1];
    const prop = properties.find((p) => p.name === firstControl);
    const other = prop.values.find((v) => v !== startOf(level)[firstControl]);
    await choose(firstControl, other);
    assert.equal((await values())[firstControl], other, `${at}: control did not apply`);
    const dockValue = await page.$eval("#dock", (el, name) => getComputedStyle(el).getPropertyValue(name), firstControl);
    assert.equal(dockValue, other, `${at}: dock style did not update`);
    await clickReset();
    assert.deepEqual(await values(), startOf(level), `${at}: reset`);
    fb = await feedbackState();
    assert.ok(fb.info, `${at}: reset message`);
    assert.equal(await text("#attempts"), "1", `${at}: reset must not touch attempts`);

    /* second wrong attempt reveals the hint */
    await check();
    assert.equal(await text("#attempts"), "2", at);
    assert.ok(!(await hidden("#hint-toggle")), `${at}: hint button should appear after 2 attempts`);
    assert.ok(await hidden("#hint"), at);
    await page.click("#hint-toggle");
    assert.ok(!(await hidden("#hint")), `${at}: hint should open`);
    assert.equal(await text("#hint-text"), level.hint, at);

    /* the solution passes */
    for (const [name, value] of Object.entries(level.solution)) await choose(name, value);
    assert.deepEqual(await values(), solutionOf(level), `${at}: values after solving`);
    await check();
    assert.ok(!(await hidden("#success")), `${at}: solution rejected: ${(await feedbackState()).text}`);
    assert.equal(await text("#attempts"), "3", at);
    assert.equal(await text("#success-stars"), "★★☆", `${at}: 3 attempts should give 2 stars`);
    if (i + 1 < levels.length) assert.match(await text("#success-text"), /שני כוכבים/, `${at}: star wording`);
    if (i + 1 < levels.length) assert.match(await text("#success-title"), level.shipType === "freighter" ? /משאיות/ : /ספינות/, `${at}: unit in title`);
    assert.equal(await page.$eval("#board", (el) => el.classList.contains("is-success")), true, at);

    const map = await page.$$eval("#level-map .level", (els) =>
      els.map((el) => ({ done: el.classList.contains("level--done"), disabled: el.disabled }))
    );
    assert.equal(map[i].done, true, `${at}: map not marked done`);
    if (i + 1 < levels.length) assert.equal(map[i + 1].disabled, false, `${at}: next level still locked`);

    if (i + 1 < levels.length) {
      assert.ok(!(await hidden("#next")), at);
      await next();
    } else {
      assert.ok(await hidden("#next"), "last level has no next button");
      assert.match(await text("#success-title"), /כל השלבים הושלמו/);
    }
  }
  assert.equal(await text("#score"), String(levels.length * 2));
  assert.deepEqual(problems, []);
});

test("progress survives a reload", async () => {
  await page.reload({ waitUntil: "load" });
  assert.equal(await levelIndex(), levels.length - 1);
  assert.equal(await text("#score"), String(levels.length * 2));
  const map = await page.$$eval("#level-map .level", (els) => els.map((el) => el.disabled));
  assert.deepEqual(map, levels.map(() => false));
});

test("a completed level can be replayed from the map and keeps its stars", async () => {
  await page.click('#level-map .level[data-level="3"]');
  assert.equal(await levelIndex(), 3);
  assert.equal(await text("#level-indicator"), `שלב 4 מתוך ${levels.length}`);
  assert.deepEqual(await values(), startOf(levels[3]));
  for (const [name, value] of Object.entries(levels[3].solution)) await choose(name, value);
  await check();
  assert.ok(!(await hidden("#success")));
  assert.match(await text("#success-text"), /כבר הושלם/);
  assert.equal(await text("#score"), String(levels.length * 2), "replaying must not change the score");
});

test("Enter inside the controls checks the level", async () => {
  await page.click('#level-map .level[data-level="1"]');
  await page.focus('input[name="justify-content"]:checked');
  await page.keyboard.press("Enter");
  const fb = await feedbackState();
  assert.ok(fb.error, fb.text);
});

test("a different property combination with the same layout is accepted", async () => {
  /* Level 12 asks for column-reverse + center + align-items: flex-end.
     One line pushed to the end with wrap + align-content lands in the same place. */
  const last = levels.length - 1;
  await page.click(`#level-map .level[data-level="${last}"]`);
  await choose("flex-direction", "column-reverse");
  await choose("justify-content", "center");
  await choose("flex-wrap", "wrap");
  await choose("align-content", "flex-end");
  await check();
  assert.ok(!(await hidden("#success")), (await feedbackState()).text);
});

test("the theme toggle switches and remembers the theme", async () => {
  const before = await page.evaluate(() => document.documentElement.dataset.theme || "");
  await page.click("#theme-toggle");
  const afterClick = await page.evaluate(() => document.documentElement.dataset.theme);
  assert.ok(["dark", "light"].includes(afterClick));
  assert.notEqual(afterClick, before);
  await page.reload({ waitUntil: "load" });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), afterClick);
  const label = await page.$eval("#theme-toggle", (el) => el.getAttribute("aria-label"));
  assert.match(label, afterClick === "dark" ? /בהיר/ : /כהה/);
  await page.click("#theme-toggle");
});

test("restart asks twice, then clears everything", async () => {
  await page.click("#restart");
  assert.match(await text("#restart"), /למחוק/);
  assert.equal(await text("#score"), String(levels.length * 2), "one click must not clear");
  await page.click("#restart");
  assert.equal(await text("#score"), "0");
  assert.equal(await levelIndex(), 0);
  const stored = await page.evaluate(() => localStorage.getItem("flexdock.progress.v1"));
  assert.match(stored, /"current":0/);
  const map = await page.$$eval("#level-map .level", (els) => els.map((el) => el.disabled));
  assert.deepEqual(map, levels.map((_, i) => i !== 0));
});

test("phone width: board stays 320x320, nothing scrolls sideways, controls still usable", async () => {
  await page.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: "load" });
  assert.deepEqual(await board(), { width: 320, height: 320 });
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyScroll: document.body.scrollWidth,
  }));
  assert.ok(scroll.scrollWidth <= scroll.innerWidth, `horizontal overflow: ${JSON.stringify(scroll)}`);
  await choose("display", "flex");
  await check();
  assert.ok(!(await hidden("#success")));
  assert.deepEqual(problems, []);
});

test("320px-wide phone: board still fits with no sideways scroll", async () => {
  await page.setViewport({ width: 320, height: 640, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: "load" });
  assert.deepEqual(await board(), { width: 320, height: 320 });
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    boardLeft: document.getElementById("board").getBoundingClientRect().left,
  }));
  assert.ok(scroll.scrollWidth <= scroll.innerWidth, `horizontal overflow: ${JSON.stringify(scroll)}`);
  assert.ok(scroll.boardLeft >= 0, "board is cut off on the left");
  assert.deepEqual(problems, []);
});

test("works from file:// as it will from the ZIP: fonts load, no errors, game playable", async () => {
  const filePage = await browser.newPage();
  const localProblems = [];
  filePage.on("pageerror", (e) => localProblems.push(`pageerror: ${e.message}`));
  filePage.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") localProblems.push(`console.${m.type()}: ${m.text()}`);
  });
  filePage.on("requestfailed", (r) => localProblems.push(`requestfailed: ${r.url()}`));
  await filePage.setViewport({ width: 1280, height: 800 });
  await filePage.goto(`file:///${ROOT.replaceAll("\\", "/")}/index.html`, { waitUntil: "load" });
  const fonts = await filePage.evaluate(async () => {
    await document.fonts.ready;
    return {
      rubik: document.fonts.check("16px Rubik"),
      mono: document.fonts.check("16px 'JetBrains Mono'"),
      loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
    };
  });
  assert.equal(fonts.rubik, true, `Rubik not loaded: ${JSON.stringify(fonts)}`);
  assert.equal(fonts.mono, true, `JetBrains Mono not loaded: ${JSON.stringify(fonts)}`);
  const shipIcon = await filePage.$eval("#dock .ship__icon", (el) => el.getBoundingClientRect().width);
  assert.ok(shipIcon > 0, "ship icon has no size");
  const id = await filePage.$eval('input[name="display"][value="flex"]', (el) => el.id);
  await filePage.click(`label[for="${id}"]`);
  await filePage.click("#check");
  assert.equal(await filePage.$eval("#success", (el) => el.hidden), false);
  assert.deepEqual(localProblems, []);
  await filePage.close();
});

test("large screen: board is still 320x320 and sits beside the console", async () => {
  await page.setViewport({ width: 1920, height: 1080 });
  await page.reload({ waitUntil: "load" });
  assert.deepEqual(await board(), { width: 320, height: 320 });
  const side = await page.evaluate(() => {
    const a = document.querySelector(".hangar").getBoundingClientRect();
    const b = document.querySelector(".console").getBoundingClientRect();
    return a.top < b.bottom && b.top < a.bottom && (a.right <= b.left || b.right <= a.left);
  });
  assert.equal(side, true);
  assert.deepEqual(problems, []);
});
