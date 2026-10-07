// js/nav.js — 모바일 햄버거 메뉴
const header = document.querySelector(".site-header");
const toggle = document.getElementById("menuToggle");
const panel = document.getElementById("navPanel");

function setOpen(open) {
  header.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
}

if (header && toggle && panel) {
  toggle.addEventListener("click", () => setOpen(!header.classList.contains("is-open")));

  // 링크·로그인 버튼 클릭 시 닫기
  panel.addEventListener("click", (e) => {
    if (e.target.closest("a, .login-btn")) setOpen(false);
  });

  // 바깥 클릭, ESC로 닫기
  document.addEventListener("click", (e) => {
    if (!header.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });

  // 데스크톱 폭으로 돌아가면 상태 초기화
  matchMedia("(min-width: 761px)").addEventListener("change", (e) => {
    if (e.matches) setOpen(false);
  });
}
