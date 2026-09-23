/* Brace + CSS comment balance checker for globals.css */
const fs = require("fs");
const c = fs.readFileSync("src/styles/globals.css", "utf8");
const lines = c.split("\n");

// 1) CSS comment balance
let inComment = false;
let openLine = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  for (let j = 0; j < l.length; j++) {
    if (!inComment && l[j] === "/" && l[j + 1] === "*") { inComment = true; openLine = i + 1; }
    if (inComment && l[j] === "*" && l[j + 1] === "/") { inComment = false; }
  }
}
if (inComment) console.log("UNCLOSED COMMENT starting at line", openLine);
else console.log("comments balanced");

// 2) Brace balance WITH comment-string awareness (a { / } inside a comment or
//    string literal does not count). Reports the first line where depth < 0.
inComment = false;
let depth = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  let inStr = null;
  for (let j = 0; j < l.length; j++) {
    const ch = l[j];
    if (inComment) {
      if (ch === "*" && l[j + 1] === "/") { inComment = false; j++; }
      continue;
    }
    if (inStr) {
      if (ch === "\\") { j++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = ch; continue; }
    if (ch === "/" && l[j + 1] === "*") { inComment = true; j++; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
  if (depth < 0) { console.log(`NEGATIVE DEPTH at line ${i + 1}: ${l.trim().substring(0, 80)}`); break; }
}
console.log("final brace depth:", depth);
console.log("generated section starts at line", lines.findIndex((l) => /DARK MODE LAYER/.test(l)) + 1);


