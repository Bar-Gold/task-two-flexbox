/* The brief ("מטלה 2"), turned into checks. Static: no browser needed.
   game.test.js covers the behaviour in a real Chrome. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  doc,
  html,
  css,
  js,
  read,
  exists,
  levels,
  properties,
  propertyByName,
  solutionOf,
  startOf,
  htmlAssetRefs,
  cssAssetRefs,
  fontCssRefs,
} from "./helpers.js";

/* ------------------------------------------------------------- levels */

test("at least 6 levels", () => {
  assert.ok(levels.length >= 6, `found ${levels.length}`);
});

test("every level has a title, an instruction, a hint, ships, controls and a solution", () => {
  for (const [i, level] of levels.entries()) {
    const at = `level ${i + 1}`;
    assert.ok(level.title.trim().length > 0, `${at}: title`);
    assert.ok(level.instruction.trim().length >= 20, `${at}: instruction too short`);
    assert.ok(level.hint.trim().length >= 20, `${at}: hint too short`);
    assert.ok(Number.isInteger(level.ships) && level.ships >= 2, `${at}: ships`);
    assert.ok(["fighter", "freighter"].includes(level.shipType), `${at}: shipType`);
    assert.ok(Array.isArray(level.controls) && level.controls.length >= 1, `${at}: controls`);
    assert.ok(Object.keys(level.solution).length >= 1, `${at}: solution`);
  }
});

test("every solution and start value is a known property with a known value", () => {
  for (const [i, level] of levels.entries()) {
    for (const [name, value] of [...Object.entries(level.solution), ...Object.entries(level.start)]) {
      const prop = propertyByName(name);
      assert.ok(prop, `level ${i + 1}: unknown property ${name}`);
      assert.ok(prop.values.includes(value), `level ${i + 1}: ${name}: ${value} is not offered`);
    }
    for (const name of level.controls) assert.ok(propertyByName(name), `level ${i + 1}: unknown control ${name}`);
  }
});

test("every level can be solved with the controls it shows", () => {
  for (const [i, level] of levels.entries()) {
    for (const name of Object.keys(level.solution)) {
      assert.ok(level.controls.includes(name), `level ${i + 1}: solution needs ${name} but it is not a control`);
    }
    assert.ok(level.controls.includes("display"), `level ${i + 1}: display must always be controllable`);
  }
});

test("no level is already solved when it starts", () => {
  for (const [i, level] of levels.entries()) {
    const start = startOf(level);
    const solution = solutionOf(level);
    const differs = Object.keys(solution).some((k) => start[k] !== solution[k]);
    assert.ok(differs, `level ${i + 1} starts in its solved state`);
  }
});

test("the game uses display: flex, flex-direction, justify-content, align-items and flex-wrap", () => {
  const used = new Set(levels.flatMap((l) => Object.keys(l.solution)));
  for (const name of ["display", "flex-direction", "justify-content", "align-items", "flex-wrap"]) {
    assert.ok(used.has(name), `no level's solution uses ${name}`);
  }
  assert.ok(levels.some((l) => l.solution.display === "flex"), "one level should teach display: flex explicitly");
});

test("at least one level requires flex-wrap: wrap", () => {
  assert.ok(levels.some((l) => l.solution["flex-wrap"] === "wrap"));
});

test("at least three levels need more than one property", () => {
  const multi = levels.filter((l) => Object.keys(l.solution).length > 1);
  assert.ok(multi.length >= 3, `only ${multi.length} multi-property levels`);
});

test("no two levels ask for the same combination", () => {
  const seen = new Map();
  for (const [i, level] of levels.entries()) {
    const key = JSON.stringify(Object.entries(solutionOf(level)).sort());
    assert.ok(!seen.has(key), `level ${i + 1} repeats level ${seen.get(key)}`);
    seen.set(key, i + 1);
  }
});

test("no two consecutive single-property levels differ only in the value of the same property", () => {
  for (let i = 1; i < levels.length; i += 1) {
    const a = Object.keys(levels[i - 1].solution);
    const b = Object.keys(levels[i].solution);
    if (a.length === 1 && b.length === 1) {
      assert.notEqual(a[0], b[0], `levels ${i} and ${i + 1} both only change ${a[0]}`);
    }
  }
});

test("wrap levels actually overflow one line, so wrap changes the layout", () => {
  const inner = 292; /* 320 - 2*2 border - 2*12 padding */
  for (const [i, level] of levels.entries()) {
    if (level.solution["flex-wrap"] !== "wrap") continue;
    const size = level.shipType === "freighter" ? { w: 80, h: 64 } : { w: 48, h: 48 };
    const column = (level.solution["flex-direction"] || "row").startsWith("column");
    const perLine = Math.floor(inner / (column ? size.h : size.w));
    assert.ok(level.ships > perLine, `level ${i + 1}: ${level.ships} ships fit on one line, wrap would do nothing`);
  }
});

test("non-wrap levels fit on one line, so the board never has to clip a solution", () => {
  const inner = 292;
  for (const [i, level] of levels.entries()) {
    if (level.solution["flex-wrap"] === "wrap") continue;
    const size = level.shipType === "freighter" ? { w: 80, h: 64 } : { w: 48, h: 48 };
    const column = (level.solution["flex-direction"] || "row").startsWith("column");
    const needed = level.ships * (column ? size.h : size.w);
    assert.ok(needed <= inner, `level ${i + 1}: solution needs ${needed}px in ${inner}px`);
  }
});

test("instructions mention the ship number when order matters", () => {
  for (const [i, level] of levels.entries()) {
    const dir = level.solution["flex-direction"] || "";
    if (dir.endsWith("-reverse")) {
      assert.match(level.instruction, /1/, `level ${i + 1} reverses order but never mentions ship 1`);
    }
  }
});

/* ------------------------------------------------------------ markup */

test("document is Hebrew RTL with a UTF-8 charset and a sane viewport", () => {
  const root = doc.querySelector("html");
  assert.equal(root.getAttribute("lang"), "he");
  assert.equal(root.getAttribute("dir"), "rtl");
  assert.ok(doc.querySelector('meta[charset="utf-8"]'));
  const viewport = doc.querySelector('meta[name="viewport"]').getAttribute("content");
  assert.match(viewport, /width=device-width/);
  assert.doesNotMatch(viewport, /user-scalable=no|maximum-scale=1(\b|$)/);
});

test("the board is LTR so flex-start and row behave as documented", () => {
  assert.equal(doc.querySelector("#board").getAttribute("dir"), "ltr");
});

test("landmarks and headings", () => {
  assert.equal(doc.querySelectorAll("h1").length, 1);
  assert.equal(doc.querySelectorAll("main").length, 1);
  assert.ok(doc.querySelector("header"));
  assert.ok(doc.querySelector("footer"));
  assert.ok(doc.querySelector("nav"));
  const levelsOfHeadings = [...doc.querySelectorAll("h1, h2, h3, h4")].map((h) => Number(h.tagName[1]));
  for (let i = 1; i < levelsOfHeadings.length; i += 1) {
    assert.ok(levelsOfHeadings[i] - levelsOfHeadings[i - 1] <= 1, "heading levels skip");
  }
});

test("Flexbox properties are controlled with real HTML form controls", () => {
  for (const prop of properties) {
    const fieldset = doc.querySelector(`fieldset[data-prop="${prop.name}"]`);
    assert.ok(fieldset, `no fieldset for ${prop.name}`);
    assert.ok(fieldset.querySelector("legend"), `${prop.name}: no legend`);
    for (const value of prop.values) {
      const input = fieldset.querySelector(`input[type="radio"][name="${prop.name}"][value="${value}"]`);
      assert.ok(input, `${prop.name}: no radio for ${value}`);
      const id = input.getAttribute("id");
      assert.ok(id && doc.querySelector(`label[for="${id}"]`), `${prop.name}: ${value} has no label`);
    }
    const radios = fieldset.querySelectorAll(`input[type="radio"][name="${prop.name}"]`);
    assert.equal(radios.length, prop.values.length, `${prop.name}: extra radios`);
  }
});

test("check, reset, next, hint, restart, theme and level map exist", () => {
  for (const id of ["check", "reset", "next", "hint-toggle", "restart", "theme-toggle", "level-map", "level-indicator", "attempts", "score", "feedback", "success", "pads", "dock", "code"]) {
    assert.ok(doc.querySelector(`#${id}`), `missing #${id}`);
  }
  assert.equal(doc.querySelector("#check").getAttribute("type"), "submit");
  assert.equal(doc.querySelector("#reset").getAttribute("type"), "button");
});

test("feedback regions are announced to assistive tech", () => {
  assert.equal(doc.querySelector("#feedback").getAttribute("aria-live"), "polite");
  assert.equal(doc.querySelector("#success").getAttribute("aria-live"), "polite");
});

test("the level indicator reads 'שלב N מתוך M'", () => {
  assert.match(doc.querySelector("#level-indicator").text, /שלב \d+ מתוך \d+/);
  assert.match(read("js/game.js"), /'שלב ' \+ \(state\.levelIndex \+ 1\) \+ ' מתוך ' \+ LEVELS\.length/);
});

test("every svg is hidden from assistive tech and every button has a name", () => {
  for (const svg of doc.querySelectorAll("svg")) {
    assert.equal(svg.getAttribute("aria-hidden"), "true");
  }
  for (const button of doc.querySelectorAll("button")) {
    const named = button.text.trim().length > 0 || button.getAttribute("aria-label");
    assert.ok(named, `unnamed button: ${button.outerHTML.slice(0, 80)}`);
  }
});

test("no inline styles or style elements; CSS comes from the stylesheets", () => {
  assert.equal(doc.querySelectorAll("style").length, 0);
  assert.equal(doc.querySelectorAll("[style]").length, 0);
});

test("credits name both authors", () => {
  assert.match(html, /בר גולדשטיין/);
  assert.match(html, /בנימין ברודי/);
});

/* -------------------------------------------------------- constraints */

test("no external JavaScript or CSS: every script and stylesheet is local", () => {
  for (const script of doc.querySelectorAll("script")) {
    const src = script.getAttribute("src");
    assert.ok(src, "inline scripts are not used");
    assert.match(src, /^js\//, `external script ${src}`);
  }
  for (const link of doc.querySelectorAll("link[rel=stylesheet]")) {
    assert.doesNotMatch(link.getAttribute("href"), /^https?:/);
  }
  assert.doesNotMatch(css, /@import/);
  assert.doesNotMatch(css, /url\(\s*['"]?https?:/);
});

test("no JavaScript libraries: game code does not import or load anything", () => {
  assert.doesNotMatch(js, /\bimport\b|\brequire\(/);
  assert.doesNotMatch(js, /createElement\(['"]script['"]\)/);
  const urls = [...js.matchAll(/https?:\/\/[^\s'"]+/g)].map((m) => m[0]);
  assert.deepEqual(urls.filter((u) => u !== "http://www.w3.org/2000/svg"), [], "network URLs in game code");
});

test("no CSS Grid anywhere", () => {
  assert.doesNotMatch(css, /display\s*:\s*(inline-)?grid/);
  assert.doesNotMatch(css, /grid-template|grid-area|grid-column|grid-row|\bgap-grid/);
  assert.doesNotMatch(js, /['"]grid['"]|grid-template/);
});

test("the board is a fixed 320x320px in CSS, not a relative unit", () => {
  const rule = css.match(/\.board\s*\{[^}]*\}/)[0];
  assert.match(rule, /width:\s*320px/);
  assert.match(rule, /height:\s*320px/);
  assert.match(rule, /flex:\s*none/);
  assert.doesNotMatch(css, /\.board\s*\{[^}]*(max-width|width:\s*\d+(vw|%))/);
  assert.doesNotMatch(css, /\.board\b[^{]*\{[^}]*transform:\s*scale/);
});

test("responsive: mobile-first with min-width breakpoints, and reduced motion is respected", () => {
  const queries = css.match(/@media\s*\(min-width:[^)]+\)/g) || [];
  assert.ok(queries.length >= 2, `only ${queries.length} min-width queries`);
  assert.doesNotMatch(css, /@media\s*\(max-width/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /:focus-visible/);
});

test("both themes are declared and the toggle wins in both directions", () => {
  assert.match(css, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)/);
  assert.match(css, /:root\[data-theme="dark"\]/);
});

test("every local asset referenced from HTML, CSS and fonts.css exists", () => {
  for (const ref of htmlAssetRefs()) assert.ok(exists(ref), `missing ${ref}`);
  for (const { path, file } of cssAssetRefs()) assert.ok(exists(path), `${file}: missing ${path}`);
  for (const { path } of fontCssRefs()) assert.ok(exists(path), `fonts.css: missing ${path}`);
});

test("fonts are self-hosted with their licences", () => {
  assert.ok(exists("assets/fonts/OFL-Rubik.txt"));
  assert.ok(exists("assets/fonts/OFL-JetBrainsMono.txt"));
  assert.ok(fontCssRefs().length >= 3);
});

test("no page navigation between levels: a single HTML file, no links to other pages", () => {
  for (const a of doc.querySelectorAll("a[href]")) {
    assert.match(a.getAttribute("href"), /^#/, `link leaves the page: ${a.getAttribute("href")}`);
  }
  assert.doesNotMatch(js, /location\.(href|assign|replace)|window\.open/);
});
