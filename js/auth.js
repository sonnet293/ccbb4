// js/auth.js
// 이메일 로그인(관리자 전용). 회원가입 없음 — 계정은 Firebase 콘솔에서 직접 만듭니다.
import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { bindDialog, toast } from "./utils.js";

const listeners = new Set();
let currentUser = null;

export function onAdminChange(callback) {
  listeners.add(callback);
  callback(currentUser);
}

const dialog = document.createElement("dialog");
dialog.className = "modal";
dialog.innerHTML = `
  <form class="modal-body login-form" method="dialog">
    <header class="modal-head">
      <h3>관리자 로그인</h3>
      <button type="button" class="icon-btn" data-close aria-label="닫기">×</button>
    </header>
    <input type="email" name="email" placeholder="이메일" required autocomplete="username">
    <input type="password" name="password" placeholder="비밀번호" required autocomplete="current-password">
    <p class="form-error" aria-live="polite"></p>
    <div class="form-actions">
      <button type="button" class="ghost" data-close>취소</button>
      <button type="submit" class="primary">로그인</button>
    </div>
  </form>`;
document.body.append(dialog);
bindDialog(dialog);

const form = dialog.querySelector("form");
const errorEl = dialog.querySelector(".form-error");
const loginBtn = document.getElementById("loginBtn");

const ERRORS = {
  "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
  "auth/user-disabled": "사용이 중지된 계정입니다.",
  "auth/too-many-requests": "시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
  "auth/network-request-failed": "네트워크 오류가 발생했습니다.",
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  errorEl.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
    form.reset();
    dialog.close();
    toast("로그인되었습니다.");
  } catch (err) {
    errorEl.textContent = ERRORS[err.code] || "로그인에 실패했습니다.";
  } finally {
    submit.disabled = false;
  }
});

loginBtn?.addEventListener("click", async () => {
  if (currentUser) {
    await signOut(auth);
    toast("로그아웃되었습니다.");
  } else {
    errorEl.textContent = "";
    dialog.showModal();
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  document.body.classList.toggle("is-admin", !!user);
  if (loginBtn) loginBtn.textContent = user ? "로그아웃" : "로그인";
  listeners.forEach((cb) => cb(user));
});
