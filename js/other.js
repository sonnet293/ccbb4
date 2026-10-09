// js/other.js — 기타 페이지 (좌측 메모·링크 박스 3개 + 우측 폴라로이드 2장)
// 저장 위치: other/main 문서 { note0Title, note0Body, note0Link …, photo0Date, photo0Name …, images: { photo0, photo1 } }
// 링크 칸(noteNLink)에 주소가 있으면 박스 전체가 링크가 됨 (관리자는 글 수정을 위해 화살표만 링크)
import "./sub.js";
import { bindFields, bindImages, render, saveField, watchCharacter } from "./characters.js";
import { safeUrl } from "./utils.js";

const DOC_ID = "main";
const root = document.getElementById("etc");
let data = {};

function renderLinks() {
  for (const note of root.querySelectorAll("[data-note]")) {
    const go = note.querySelector(".note-go");
    const url = safeUrl(data[`note${note.dataset.note}Link`] || "");
    note.classList.toggle("is-link", !!url);
    if (!url) {
      go.removeAttribute("href");
      go.removeAttribute("target");
      go.removeAttribute("rel");
      continue;
    }
    go.href = url;
    // 다른 사이트 주소는 새 탭으로
    if (new URL(url).origin !== location.origin) {
      go.target = "_blank";
      go.rel = "noopener";
    } else {
      go.removeAttribute("target");
      go.removeAttribute("rel");
    }
  }
}

bindFields(root, (field, value) => saveField(DOC_ID, field, value));
bindImages(root, () => DOC_ID, () => data);
watchCharacter(DOC_ID, (d) => {
  data = d;
  render(root, data);
  renderLinks();
});
