// backend/server.js
// 실행: `npm start` -> `node backend/server.js`

const { createServer } = require('http');
const { readFile, writeFile } = require('fs/promises');
const path = require('path');

// 파일 경로 설정
const publicDir = path.resolve(__dirname, '..');
const dataFile = path.join(__dirname, 'comments.json');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
};

// 1. 댓글 데이터 읽기
async function getComments() {
  try {
    const text = await readFile(dataFile, 'utf8');
    if (!text.trim()) return [];
    return JSON.parse(text);
  } catch (error) {
    // 파일이 없거나 내용이 비어있으면 빈 배열 반환
    return []; 
  }
}

// 2. 댓글 데이터 저장하기
async function saveComments(comments) {
  await writeFile(dataFile, JSON.stringify(comments, null, 2), 'utf8');
}

// 3. 요청 바디(데이터) 파싱하기
async function parseBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return JSON.parse(body);
}

const server = createServer(async (req, res) => {
  // CORS 및 기본 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // [중요] 브라우저 캐시 방지: 브라우저가 과거의 화면을 기억하지 않고 항상 최신 파일 데이터를 가져오도록 설정
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);

  // ==========================================
  // [API] 방명록(댓글) 처리
  // ==========================================
  try {
    // 방명록 불러오기 (GET)
    if (pathname === '/api/comments' && req.method === 'GET') {
      const comments = await getComments();
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(comments));
    }

    // 새 방명록 작성하기 (POST)
    if (pathname === '/api/comments' && req.method === 'POST') {
      const newComment = await parseBody(req);
      newComment.id = newComment.id || Date.now().toString(36); 
      
      const comments = await getComments();
      comments.unshift(newComment);
      await saveComments(comments);

      res.statusCode = 201;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(newComment));
    }

    // 방명록 삭제하기 (DELETE)
    if (pathname.startsWith('/api/comments/') && req.method === 'DELETE') {
      const id = pathname.split('/').pop();
      const comments = await getComments();
      
      const filtered = comments.filter(c => String(c.id) !== id);
      await saveComments(filtered);

      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true }));
    }
  } catch (error) {
    console.error('API 처리 중 에러 발생:', error);
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: '서버 에러가 발생했습니다.' }));
  }

  // ==========================================
  // [정적 파일] HTML, CSS, JS, 이미지 등 제공
  // ==========================================
  let filePath = pathname === '/' ? '/index.html' : pathname;
  if (!path.extname(filePath)) {
    filePath += '.html';
  }

  const safePath = path.normalize(path.join(publicDir, filePath));

  try {
    const data = await readFile(safePath);
    const ext = path.extname(safePath).toLowerCase();
    
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.statusCode = 200;
    res.end(data);
  } catch (error) {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`🚀 웹 서버가 실행되었습니다: http://localhost:${port}`);
});
