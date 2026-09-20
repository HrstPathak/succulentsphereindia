const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: 'localhost', port: 3000, path }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location || null, body }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout ' + path)); });
  });
}

(async () => {
  for (const p of ['/', '/account', '/admin']) {
    try {
      const r = await get(p);
      const chunks = [];
      let i = 0;
      const pat = '/_next/static/';
      while ((i = r.body.indexOf(pat, i)) >= 0) {
        const e = r.body.indexOf('.js', i);
        if (e < 0) break;
        chunks.push(r.body.substring(i, e + 3));
        i = e + 3;
      }
      const uniq = [...new Set(chunks)];
      const adminRefs = uniq.filter((u) => u.includes('e34e586c5090b9aa'));
      console.log(p + ' -> status=' + r.status + (r.location ? ' location=' + r.location : '') + ' htmlBytes=' + r.body.length);
      console.log('  jsRefs=' + uniq.length + ' adminChunkRefs=' + adminRefs.length);
      uniq.slice(0, 12).forEach((u) => console.log('  CHUNK: ' + u));
    } catch (e) {
      console.log(p + ' -> ERROR ' + e.message);
    }
  }
})();
