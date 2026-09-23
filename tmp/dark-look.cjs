const fs = require("fs");
const path = require("path");
const inv = JSON.parse(fs.readFileSync(path.join(__dirname, "dark-inventory.json"), "utf8"));

function rgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function hsl(hex) {
  const [r0, g0, b0] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r0, g0, b0), min = Math.min(r0, g0, b0);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r0) h = ((g0 - b0) / d + (g0 < b0 ? 6 : 0)) / 6;
  else if (max === g0) h = ((b0 - r0) / d + 2) / 6;
  else h = ((r0 - g0) / d + 4) / 6;
  return [Math.round(h * 360), +(s * 100).toFixed(0), Math.round(l * 100)];
}

for (const prop of ["bg", "text", "border"]) {
  const rows = inv.hex.filter((r) => r.prop === prop).sort((a, b) => a.luma - b.luma);
  console.log(`\n================= ${prop} (${rows.length} distinct, sorted by luma) =================`);
  console.log("luma  sat   H   S   L   hex       xN   sample files");
  for (const r of rows) {
    const [h, s, l] = hsl(r.hex);
    console.log(
      `${String(r.luma).padStart(4)}  ${String(r.sat).padEnd(5)} ${String(h).padStart(3)} ${String(s).padStart(3)} ${String(l).padStart(3)}  ${r.hex.padEnd(9)} x${String(r.count).padEnd(3)}  ${r.files[0].split("/").slice(-2).join("/")}`
    );
  }
}
