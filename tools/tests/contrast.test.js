/* WCAG AA text contrast for both themes, read straight from tokens.css. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { themes, contrast } from "./helpers.js";

const textPairs = [
  ["--fg", "--bg"],
  ["--fg", "--bg-elev"],
  ["--fg", "--bg-inset"],
  ["--fg-muted", "--bg"],
  ["--fg-muted", "--bg-elev"],
  ["--fg-muted", "--bg-inset"],
  ["--fg-subtle", "--bg"],
  ["--fg-subtle", "--bg-elev"],
  ["--fg-subtle", "--bg-inset"],
  ["--accent", "--bg"],
  ["--accent", "--bg-elev"],
  ["--accent", "--bg-inset"],
  ["--on-accent", "--accent"],
  ["--on-accent", "--accent-strong"],
  ["--beam-text", "--bg-elev"],
  ["--beam-text", "--bg"],
  ["--success", "--bg-elev"],
  ["--error", "--bg-elev"],
];

for (const theme of ["light", "dark"]) {
  const t = themes[theme];

  test(`${theme}: every semantic colour resolves to a hex literal`, () => {
    for (const [a, b] of textPairs) {
      assert.match(t[a] ?? "", /^#/, `${a} is not a hex colour in ${theme}`);
      assert.match(t[b] ?? "", /^#/, `${b} is not a hex colour in ${theme}`);
    }
  });

  test(`${theme}: text pairs meet 4.5:1`, () => {
    const failures = textPairs
      .map(([fg, bg]) => [fg, bg, contrast(t[fg], t[bg])])
      .filter(([, , ratio]) => ratio < 4.5)
      .map(([fg, bg, ratio]) => `${fg} on ${bg}: ${ratio.toFixed(2)}`);
    assert.deepEqual(failures, []);
  });

  test(`${theme}: focus ring is visible against the page (3:1)`, () => {
    assert.ok(contrast(t["--ring"], t["--bg"]) >= 3);
    assert.ok(contrast(t["--ring"], t["--bg-elev"]) >= 3);
  });
}

test("the OS-dark block and the explicit dark block declare the same tokens", () => {
  assert.deepEqual(themes.rawOsDark, themes.rawDark);
});

test("board colours give pads, ship numbers and ship labels enough contrast on the board", () => {
  const t = themes.light; /* board tokens are theme independent */
  assert.ok(contrast(t["--pad"], t["--board-bg"]) >= 4.5, "pad line on board");
  assert.ok(contrast(t["--ship-text"], t["--ship-bg"]) >= 4.5, "ship number on ship");
  assert.ok(contrast(t["--board-success"], t["--board-bg"]) >= 3, "success glow on board");
});
