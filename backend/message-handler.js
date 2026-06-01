// client-side message-handler (브라우저에서 실행)
// 역할: 모달 내 입력폼을 찾아 댓글을 렌더링하고, 서버 API(`/api/comments`)와 통신합니다.
document.addEventListener('DOMContentLoaded', function () {
  const apiPath = '/api/comments';

  // 간단한 HTML 이스케이프 (XSS 방지용)
  function sanitize(value) {
    return value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // 타임스탬프를 한국 로케일 문자열로 포맷
  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  // 모든 입력 폼(모달 내)을 찾고 각각 처리
  const forms = document.querySelectorAll('form.inputbar');
  forms.forEach(form => {
    const panel = form.closest('.modal-body')?.querySelector('.panel') || form.parentElement;
    const empty = panel.querySelector('.empty-state');
    let list = panel.querySelector('.message-list');
    if (!list) {
      list = document.createElement('div');
      list.className = 'message-list';
      panel.appendChild(list);
    }

    // 모달 제목에서 수신자 이름을 추출 (예: "은찬에게 메시지 보내기")
    const modal = form.closest('.modal');
    const titleEl = modal ? modal.querySelector('.modal-title') : null;
    let recipient = 'unknown';
    if (titleEl) {
      const m = titleEl.textContent.match(/^(.*?)에게/);
      if (m) recipient = m[1].trim();
    }

    // 로컬 저장소 키: recipient별로 분리 저장
    const storageKey = `messages-${recipient}`;

    // 메시지 배열을 받아 DOM으로 렌더링
    function renderMessages(messages) {
      if (!messages || !messages.length) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
      }
      if (empty) empty.style.display = 'none';
      list.innerHTML = messages.map(msg => `
        <article class="comment-card" data-id="${msg.id || ''}">
          <time>${formatTime(msg.createdAt)}</time>
          <p>${sanitize(msg.text)}</p>
          <button class="delete-btn" aria-label="삭제">✕</button>
        </article>
      `).join('');

      // 삭제 버튼 클릭 시: UI에서 제거하고 서버 DELETE 호출, 로컬스토리지도 갱신
      list.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
          const article = btn.closest('.comment-card');
          const id = article?.getAttribute('data-id');
          if (article) article.remove();
          if (id) {
            try {
              await fetch(`${apiPath}/${encodeURIComponent(id)}`, { method: 'DELETE' });
            } catch (err) {
              // 네트워크 실패 시에도 UI에서 제거된 상태 유지 (로컬스토리지로 복구 가능)
            }
          }
          const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
          const filtered = current.filter(m => String(m.id || m.createdAt) !== String(id));
          localStorage.setItem(storageKey, JSON.stringify(filtered));
        });
      });
    }

    // 저장된 메시지를 가져옵니다. 우선 서버에서 불러오고 실패하면 localStorage를 사용합니다.
    async function getSavedMessages() {
      try {
        const response = await fetch(apiPath);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) return data.filter(c => c.recipient === recipient);
        }
      } catch (err) {
        // 네트워크 실패 시 localStorage로 폴백
      }
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    }

    // 메시지 저장: 서버에 POST, 실패 시 localStorage에 저장
    async function saveMessage(message) {
      try {
        const response = await fetch(apiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });
        if (response.ok) return;
      } catch (err) {
        // 네트워크 실패
      }
      const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
      current.unshift(message);
      localStorage.setItem(storageKey, JSON.stringify(current));
    }

    // 로드해서 렌더링 (내림차순 정렬)
    async function loadAndRender() {
      const msgs = await getSavedMessages();
      renderMessages(msgs.sort((a,b)=> b.createdAt - a.createdAt));
      return msgs;
    }

    // 폼 제출: 즉시 UI에 반영하고 비동기로 서버에 저장
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const input = form.querySelector('input');
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      const message = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        text,
        recipient,
        createdAt: Date.now()
      };
      const messages = await loadAndRender();
      messages.unshift(message);
      renderMessages(messages);
      input.value = '';
      input.focus();
      saveMessage(message);
    });

    // 초기 로드
    loadAndRender();
  });
});
