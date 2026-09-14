/* html-validate and stylelint, run in-process so `npm test` is one command. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { HtmlValidate, FileSystemConfigLoader } from "html-validate";
import stylelint from "stylelint";
import { ROOT, cssFiles } from "./helpers.js";

test("index.html passes html-validate (recommended + void-style)", async () => {
  const validator = new HtmlValidate(new FileSystemConfigLoader({ root: true, extends: [] }));
  const report = await validator.validateFile(join(ROOT, "index.html"));
  const problems = report.results.flatMap((r) =>
    r.messages.map((m) => `${m.line}:${m.column} ${m.ruleId}: ${m.message}`)
  );
  assert.equal(problems.length, 0, problems.join("\n"));
});

test("stylesheets pass stylelint (standard + BEM class names)", async () => {
  const result = await stylelint.lint({
    files: cssFiles.map((f) => join(ROOT, f)),
    configFile: join(ROOT, ".stylelintrc.json"),
  });
  const problems = result.results.flatMap((r) =>
    r.warnings.map((w) => `${r.source}:${w.line}:${w.column} ${w.rule}: ${w.text}`)
  );
  assert.equal(problems.length, 0, problems.join("\n"));
});
