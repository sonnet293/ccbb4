// js/utils.js
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

let toastEl;
let toastTimer;
export function toast(message, ms = 2400) {
  if (!toastEl) {
    toastEl = h("div", { class: "toast", role: "status" });
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
}

// 파일 선택창을 열고 선택된 파일 배열을 돌려줌
export function pickFiles(accept, multiple = false) {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept, multiple });
    input.addEventListener("change", () => resolve([...input.files]));
    input.addEventListener("cancel", () => resolve([]));
    input.click();
  });
}

export function safeUrl(value) {
  try {
    const url = new URL(value, location.href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function pad(n) {
  return String(n).padStart(2, "0");
}

export function formatDateTime(date) {
  if (!date) return "";
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function bindDialog(dialog) {
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.closest("[data-close]")) dialog.close();
  });
  return dialog;
}

export function errorMessage(err) {
  const code = err?.code || "";
  if (code === "permission-denied" || err?.statusCode === "403" || /row-level security|Unauthorized/i.test(err?.message || "")) {
    return "권한이 없습니다.";
  }
  return err?.message || "알 수 없는 오류가 발생했습니다.";
}
