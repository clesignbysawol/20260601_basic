// HTML 문서가 모두 로드된 후 스크립트 실행
document.addEventListener('DOMContentLoaded', function () {

  // 사용자가 입력한 문자열에서 HTML 태그(<, >)를 문자로 변환
  // 악성 코드 실행 및 HTML 삽입 방지
  function sanitize(value) {
    return value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // 타임스탬프를 사람이 읽을 수 있는 날짜 형식으로 변환
  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 페이지 내 모든 방명록 입력 폼 선택
  const forms = document.querySelectorAll('form.inputbar');

  // 폼마다 개별 방명록 기능 생성
  forms.forEach(form => {

    // 현재 폼이 속한 패널 영역 찾기
    const panel =
      form.closest('.modal-body')?.querySelector('.panel')
      || form.parentElement;

    // 메시지가 없을 때 보여줄 안내 문구
    const empty = panel.querySelector('.empty-state');

    // 메시지 목록 영역 찾기
    let list = panel.querySelector('.message-list');

    // 목록 영역이 없으면 새로 생성
    if (!list) {
      list = document.createElement('div');
      list.className = 'message-list';
      panel.appendChild(list);
    }

    // 방명록 데이터를 저장할 배열
    let messages = [];

    // 방명록 목록을 화면에 출력하는 함수
    function renderMessages() {

      // 메시지가 하나도 없는 경우
      if (!messages.length) {
        list.innerHTML = '';

        // 빈 상태 안내 문구 표시
        if (empty) empty.style.display = 'block';
        return;
      }

      // 메시지가 있으면 안내 문구 숨김
      if (empty) empty.style.display = 'none';

      // messages 배열을 HTML 카드 형태로 변환하여 출력
      list.innerHTML = messages.map(msg => `
        <article class="comment-card" data-id="${msg.id}">
          <time>${formatTime(msg.createdAt)}</time>
          <p>${sanitize(msg.text)}</p>
          <button class="delete-btn" aria-label="삭제">✕</button>
        </article>
      `).join('');

      // 생성된 삭제 버튼에 이벤트 연결
      list.querySelectorAll('.delete-btn').forEach(btn => {

        // 삭제 버튼 클릭 시
        btn.addEventListener('click', function () {

          // 해당 댓글 카드 찾기
          const article = btn.closest('.comment-card');

          // 댓글의 고유 ID 가져오기
          const id = article.getAttribute('data-id');

          // 배열에서 해당 ID를 가진 댓글 제거
          messages = messages.filter(
            m => String(m.id) !== String(id)
          );

          // 변경된 목록 다시 출력
          renderMessages();
        });
      });
    }

    // 방명록 등록 버튼 클릭(폼 제출) 시 실행
    form.addEventListener('submit', function (e) {

      // 기본 폼 제출(새로고침) 방지
      e.preventDefault();

      // 입력창 찾기
      const input = form.querySelector('input');

      if (!input) return;

      // 입력값 앞뒤 공백 제거
      const text = input.value.trim();

      // 빈 문자열이면 등록하지 않음
      if (!text) return;

      // 새 메시지 객체 생성
      const message = {

        // 댓글마다 고유 ID 생성
        id:
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 8),

        // 사용자가 입력한 내용
        text,

        // 작성 시간 저장
        createdAt: Date.now()
      };

      // 최신 댓글이 위에 오도록 배열 맨 앞에 추가
      messages.unshift(message);

      // 화면 갱신
      renderMessages();

      // 입력창 비우기
      input.value = '';

      // 다시 입력할 수 있도록 포커스 이동
      input.focus();
    });

    // 초기 상태 렌더링
    renderMessages();
  });
});