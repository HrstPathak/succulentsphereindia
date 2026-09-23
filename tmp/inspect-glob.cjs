const fs = require('fs');
const globs = fs.readFileSync('src/styles/globals.css', 'utf8');
const lines = globs.split(/\r?\n/);
console.log('globals lines:', lines.length);
console.log('--- grep in globals ===');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/dark mode layer|generated .* do not hand-edit|HERO EXCEPTIONS|FROSTED-GLASS|\.dark {|\.dark :root|ss-glass|scrollbar-none/.test(line)) {
    console.log(i + 1, '|', line.substring(0, 100));
  }
}
console.log('--- tail of globals ===');
for (let i = Math.max(0, lines.length - 10); i < lines.length; i++) {
  console.log(i + 1, '|', lines[i]);
}

const layer = fs.readFileSync('tmp/dark-layer.css', 'utf8');
const llines = layer.split(/\r?\n/);
console.log('\n== dark-layer lines:', llines.length);
console.log('--- head ===');
for (let i = 0; i < 6; i++) console.log(llines[i]);
console.log('--- tail ===');
for (let i = Math.max(0, llines.length - 4); i < llines.length; i++) console.log(llines[i]);
