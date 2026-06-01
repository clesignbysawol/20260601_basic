// backend/server.js
// 작은 정적 파일 서버 + 파일 기반 댓글 API
// 실행: `npm start` -> `node backend/server.js`
// 이 파일은 프로젝트 루트(backend/의 부모)에서 정적 파일을 제공하고
// `backend/comments.json`을 사용해 댓글을 읽고 씁니다.
const { createServer } = require('http');
const { readFile, writeFile, stat } = require('fs/promises');
const path = require('path');

// publicDir: 실제로 정적 파일은 프로젝트 루트에서 제공됩니다.
// (backend/의 부모 폴더를 가리킵니다.)
const publicDir = path.resolve(__dirname, '..');
// dataFile: 댓글을 저장하는 JSON 파일은 backend/ 내부에 둡니다.
const dataFile = path.join(__dirname, 'comments.json');

const mimeTypes = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  json: 'application/json; charset=utf-8',
};

async function ensureDataFile() {
  try {
    await stat(dataFile);
  } catch {
    await writeFile(dataFile, '[]', 'utf8');
  }
}

async function loadComments() {
  // 파일이 없으면 생성하고, JSON을 파싱하여 배열을 반환합니다.
  await ensureDataFile();
  const text = await readFile(dataFile, 'utf8');
  try {
    return JSON.parse(text || '[]');
  } catch {
    // 파일이 손상되었을 경우 빈 배열로 초기화하여 안전하게 동작하도록 합니다.
    return [];
  }
}

async function saveComments(comments) {
  // 댓글 배열을 예쁘게 포맷하여 파일에 저장합니다.
  await writeFile(dataFile, JSON.stringify(comments, null, 2), 'utf8');
}

async function getAllComments() {
  // 현재 구현은 파일 기반 스토어만 지원합니다.
  const comments = await loadComments();
  return comments;
}

async function insertComment(comment) {
  // 새로운 댓글을 맨 앞에 추가하고 저장합니다.
  const comments = await loadComments();
  comments.unshift(comment);
  await saveComments(comments);
  return comment;
}

async function deleteCommentById(id) {
  // id가 일치하지 않는 항목들만 남겨서 덮어씁니다.
  const comments = await loadComments();
  const filtered = comments.filter(c => String(c.id) !== String(id));
  await saveComments(filtered);
}

function sendResponse(res, status, body, contentType) {
  // 공통 응답 헤더(CORS 포함)를 설정하고 응답을 마칩니다.
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

// 메인 요청 핸들러
const server = createServer(async (req, res) => {
  // URL 파싱 및 경로 디코딩
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  // CORS preflight 응답 처리
  if (req.method === 'OPTIONS') {
    return sendResponse(res, 204, '', 'text/plain');
  }

  // API: /api/comments (GET: 목록, POST: 추가)
  if (pathname === '/api/comments') {
    try {
      if (req.method === 'GET') {
        const comments = await getAllComments();
        return sendResponse(res, 200, JSON.stringify(comments), mimeTypes.json);
      }

      if (req.method === 'POST') {
        // 요청 바디를 수집해서 JSON 파싱
        let payload = '';
        for await (const chunk of req) {
          payload += chunk;
        }
        try {
          const comment = JSON.parse(payload);
          // id가 없으면 서버에서 생성
          if (!comment.id) comment.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          const stored = await insertComment(comment);
          return sendResponse(res, 201, JSON.stringify(stored), mimeTypes.json);
        } catch (error) {
          console.error('POST /api/comments error:', error);
          return sendResponse(res, 400, JSON.stringify({ error: 'Invalid JSON or insert failed' }), mimeTypes.json);
        }
      }

      return sendResponse(res, 405, JSON.stringify({ error: 'Method Not Allowed' }), mimeTypes.json);
    } catch (err) {
      console.error('GET /api/comments handler error:', err);
      return sendResponse(res, 500, JSON.stringify({ error: 'Server error' }), mimeTypes.json);
    }
  }

  // API: /api/comments/:id (DELETE)
  if (pathname.startsWith('/api/comments/')) {
    if (req.method === 'DELETE') {
      const id = pathname.split('/').pop();
      if (!id) return sendResponse(res, 400, JSON.stringify({ error: 'Missing id' }), mimeTypes.json);
      try {
        await deleteCommentById(id);
        return sendResponse(res, 200, JSON.stringify({ ok: true }), mimeTypes.json);
      } catch (err) {
        return sendResponse(res, 500, JSON.stringify({ error: 'Could not delete' }), mimeTypes.json);
      }
    }

    return sendResponse(res, 405, JSON.stringify({ error: 'Method Not Allowed' }), mimeTypes.json);
  }

  // 그 외: 정적 파일 제공 (index.html 등)
  let filePath = pathname === '/' ? '/index.html' : pathname;
  if (!path.extname(filePath)) {
    filePath += '.html';
  }

  // 경로를 정규화하여 디렉터리 교차 접근을 방지
  const safePath = path.normalize(path.join(publicDir, filePath));
  if (!safePath.startsWith(publicDir)) {
    return sendResponse(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  }

  try {
    const data = await readFile(safePath);
    const ext = path.extname(safePath).slice(1).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    return sendResponse(res, 200, data, contentType);
  } catch (error) {
    // 파일이 없으면 404
    return sendResponse(res, 404, 'Not Found', 'text/plain; charset=utf-8');
  }
});

const port = process.env.PORT || 3000;
server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the running server or set PORT to a different value.`);
  } else {
    console.error('Server error:', error);
  }
  process.exit(1);
});
server.listen(port, () => {
  console.log(`Static server running at http://localhost:${port}`);
  console.log('Comments API available at http://localhost:' + port + '/api/comments');
  console.log('Supabase integration disabled');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
