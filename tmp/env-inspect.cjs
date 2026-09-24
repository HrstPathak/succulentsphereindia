const fs = require("fs");
const p = ".env.local";
if (!fs.existsSync(p)) { console.log("no .env.local"); process.exit(0); }
const t = fs.readFileSync(p, "utf8");
for (const line of t.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  const key = m[1];
  const val = m[2].trim().replace(/^["']|["']$/g, "");
  if (!/DELHIVERY|WAYBILL|SHIPMENT|CLIENT/i.test(key)) continue;
  if (/^https?:/i.test(val)) {
    const cm = val.match(/[?&]cl=([^&]+)/i);
    const token = /token=[^&]+/i.test(val) ? "(has token)" : "(no token)";
    console.log(key + " -> URL cl=" + (cm ? decodeURIComponent(cm[1]) : "(none)") + " " + token);
  } else {
    console.log(key + " -> (set, len=" + val.length + ")");
  }
}
