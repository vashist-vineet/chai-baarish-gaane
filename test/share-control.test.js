import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("share button markup has neutral label, accessible name, and SVG icon", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const shareButtonMatch = html.match(/<button id="shareButton"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(shareButtonMatch, "index.html must have #shareButton");

  const buttonTag = html.match(/<button id="shareButton"[^>]*>/)[0];
  assert.match(buttonTag, /aria-label="Share this moment"/, "button must have aria-label 'Share this moment'");

  const innerContent = shareButtonMatch[1];
  assert.match(innerContent, /<svg\b[^>]*class="share-icon"[^>]*>/, "button must contain a share SVG icon");
  assert.match(innerContent, /<span>Share this moment<\/span>/, "button text must be 'Share this moment'");
  assert.doesNotMatch(innerContent, /share this (baarish|sardi|bahar|patjhad|registan|samundar)/, "button must not have environment-specific label in markup");
});

test("all six environments have valid share copy and ENVIRONMENTS shareLabel is neutral", () => {
  const scriptContent = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");

  const shareCopyBlockMatch = scriptContent.match(/const shareCopy = \{([\s\S]*?)\};/);
  assert.ok(shareCopyBlockMatch, "script.js must define shareCopy block");
  const shareCopyBlock = shareCopyBlockMatch[1];

  const expectedEnvironments = ["monsoon", "winter", "spring", "autumn", "desert", "coast"];
  for (const env of expectedEnvironments) {
    const regex = new RegExp(`${env}:\\s*["']([^"']+)["']`);
    const match = shareCopyBlock.match(regex);
    assert.ok(match, `shareCopy must define entry for ${env}`);
    assert.ok(match[1].length > 10, `shareCopy for ${env} must not be empty`);
    assert.match(match[1], /Found a tiny corner of the internet for chai,/, `shareCopy for ${env} must follow phrasing convention`);
  }

  // Specifically verify coast shareCopy
  const coastMatch = shareCopyBlock.match(/coast:\s*["']([^"']+)["']/);
  assert.ok(coastMatch, "coast must be defined in shareCopy");
  assert.match(coastMatch[1], /samundar/, "coast shareCopy must contain 'samundar'");

  // Verify ENVIRONMENTS shareLabel across all environments
  for (const env of expectedEnvironments) {
    assert.match(scriptContent, /shareLabel:\s*"Share this moment"/, "ENVIRONMENTS must use 'Share this moment'");
  }
});

test("applyEnvironmentUi does not overwrite #shareButton textContent", () => {
  const scriptContent = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");
  assert.doesNotMatch(
    scriptContent,
    /els\.share\.textContent\s*=\s*config\.shareLabel/,
    "applyEnvironmentUi must not overwrite els.share.textContent"
  );
});

test("radio-console mobile centering uses margin-inline auto and no negative horizontal offset", () => {
  const css = fs.readFileSync(new URL("../style.css", import.meta.url), "utf8");
  const mobileQuery = css.match(/@media\s*\(max-width:\s*760px\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(mobileQuery, "style.css must have @media (max-width: 760px)");

  const mobileCss = mobileQuery[1];
  assert.match(mobileCss, /\.radio-console\s*\{[^}]*margin-inline:\s*auto/, "mobile .radio-console must center with margin-inline: auto");
  assert.doesNotMatch(mobileCss, /right:\s*50%/, "mobile .radio-console must not use right: 50% which causes negative horizontal offset");
  assert.doesNotMatch(mobileCss, /transform:\s*translateX\(50%\)/, "mobile .radio-console must not use translateX(50%) centering hack");
});
