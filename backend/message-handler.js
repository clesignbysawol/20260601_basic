document.addEventListener('DOMContentLoaded', function () {
  function sanitize(value) {
    return value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

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

    let messages = [];

    function renderMessages() {
      if (!messages.length) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
      }
      if (empty) empty.style.display = 'none';
      list.innerHTML = messages.map(msg => `
        <article class="comment-card" data-id="${msg.id}">
          <time>${formatTime(msg.createdAt)}</time>
          <p>${sanitize(msg.text)}</p>
          <button class="delete-btn" aria-label="삭제">✕</button>
        </article>
      `).join('');

      list.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          const article = btn.closest('.comment-card');
          const id = article.getAttribute('data-id');
          messages = messages.filter(m => String(m.id) !== String(id));
          renderMessages();
        });
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const input = form.querySelector('input');
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      const message = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        text,
        createdAt: Date.now()
      };
      messages.unshift(message);
      renderMessages(messages);
      input.value = '';
      input.focus();
    });

    renderMessages();
  });
});
