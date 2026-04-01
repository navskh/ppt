const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3999;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  // POST /save-scripts — 스크립트 저장 + git push
  if (req.method === 'POST' && req.url === '/save-scripts') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { dir, content } = JSON.parse(body);
        const filePath = path.join(ROOT, dir, 'scripts.js');

        // 파일 저장
        fs.writeFileSync(filePath, content, 'utf8');

        // git push
        execSync('git add -A && git commit -m "update: 발표 스크립트 수정" && git push', {
          cwd: ROOT,
          stdio: 'pipe',
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: '저장 + push 완료' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, message: e.message }));
      }
    });
    return;
  }

  // 정적 파일 서빙
  let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
  if (filePath.endsWith('/')) filePath += 'index.html';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  PPT 서버 실행 중: http://localhost:${PORT}\n`);
});
