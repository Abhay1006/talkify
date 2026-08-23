/*
 * Fails if any text/background pair the UI renders drops below WCAG AA (4.5:1).
 *
 * Token values are read out of index.css rather than duplicated here, so the
 * check cannot drift away from what actually ships. Run: npm run check:contrast
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const cssPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/index.css");
const css = fs.readFileSync(cssPath, "utf8");

// Pull one declaration block by its selector, then the custom properties in it.
const block = (selector) => {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const end = css.indexOf("\n}", open);
  const body = css.slice(open, end);
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8});/g)].map((m) => [m[1], m[2]])
  );
};

// Dark overrides only the tokens that change, so layer it over light.
const light = block(":root {");
const dark = { ...light, ...block(':root[data-theme="dark"]') };

const hex = (h) => {
  h = h.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (h) => {
  const [r, g, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [L(a), L(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground token, background token, where it appears]. Every pair is body
// text at 13px or smaller, so large-text's relaxed 3:1 never applies.
const PAIRS = [
  ["--text", "--bg", "message body"],
  ["--text", "--bg-chrome", "topbar brand / chat title"],
  ["--text", "--bg-sunken", "conversation name"],
  ["--text", "--bg-active", "selected conversation"],
  ["--text-muted", "--bg", "form labels, auth subtitle"],
  ["--text-muted", "--bg-chrome", "topbar username, presence"],
  ["--text-muted", "--bg-sunken", "sidebar empty state"],
  ["--text-faint", "--bg", "message timestamps"],
  ["--text-faint", "--bg-sunken", "sidebar heading"],
  ["--accent", "--bg", "links"],
  ["--accent", "--bg-chrome", "logout link"],
  ["--accent-text", "--accent", "primary button label"],
  ["--ok", "--bg", "online text"],
  ["--ok", "--bg-chrome", "online in chat header"],
  ["--danger", "--bg", "field errors"],
];

const AA = 4.5;
let failed = 0;

for (const [name, tokens] of [["light", light], ["dark", dark]]) {
  console.log(`\n${name}`);
  for (const [fg, bg, label] of PAIRS) {
    const fgHex = tokens[fg];
    const bgHex = tokens[bg];
    if (!fgHex || !bgHex) throw new Error(`missing token in ${name}: ${fg} or ${bg}`);
    const r = ratio(fgHex, bgHex);
    const ok = r >= AA;
    if (!ok) failed++;
    console.log(
      `  ${ok ? "pass" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  ${label}` +
        `  (${fg} ${fgHex} on ${bg} ${bgHex})`
    );
  }
}

if (failed) {
  console.error(`\n${failed} pair(s) below WCAG AA (${AA}:1).`);
  process.exit(1);
}
console.log(`\nAll ${PAIRS.length * 2} pairs meet WCAG AA (${AA}:1).`);
