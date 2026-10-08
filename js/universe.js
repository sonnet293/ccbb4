// js/universe.js — 세계관 페이지 (#universe: 세계관 개요, #story: 스토리 라인)
// 개요·스토리는 같은 다이어리 레이아웃: 책갈피를 누르면 안쪽 페이지(제목·내용·이미지)가 바뀜
// 저장 위치: universe 컬렉션의 "universe-0", "story-2" … 문서 (책 이름-책갈피 번호)
import "./sub.js";
import { bindFields, bindImages, render, saveField, watchCharacter } from "./characters.js";
import { h } from "./utils.js";

const BOOKS = {
  universe: ["설립목적", "구전설화"],
  story: ["11세", "18세", "26세", "현재"],
};

const views = [...document.querySelectorAll("[data-view]")];
const VIEWS = views.map((view) => view.dataset.view);
const books = {};

function createBook(view, labels) {
  const tabs = labels.map((label, i) =>
    h("button", { type: "button", class: "book-tab", role: "tab", "data-index": i }, label)
  );
  const page = h(
    "div",
    { class: "book-page", role: "tabpanel" },
    h(
      "div",
      { class: "book-text" },
      h("h2", { class: "book-title", "data-field": "title", "data-placeholder": "제목" }),
      h("span", { class: "book-body", "data-field": "body", "data-placeholder": "내용", "data-multiline": true })
    ),
    h(
      "div",
      { class: "img-slot book-image", "data-image": "image" },
      h("img", { alt: "" }),
      h("span", { class: "img-empty" }, "410 × 486"),
      h("div", { class: "admin-tools" }, h("button", { type: "button", "data-action": "image" }, "이미지 변경"))
    )
  );
  view.append(h("div", { class: "book" }, h("div", { class: "book-tabs", role: "tablist" }, tabs), page));

  const book = { docId: null, data: {}, unsubscribe: null };

  function open(index) {
    tabs.forEach((tab, i) => tab.setAttribute("aria-selected", String(i === index)));
    const docId = `${view.dataset.view}-${index}`;
    if (docId === book.docId) return;
    book.docId = docId;
    book.data = {};
    render(page, book.data);

    // 다이어리 넘기듯 내용 다시 등장
    page.classList.remove("is-turning");
    void page.offsetWidth;
    page.classList.add("is-turning");

    book.unsubscribe?.();
    book.unsubscribe = watchCharacter(docId, (d) => {
      book.data = d;
      render(page, d);
    });
  }

  tabs.forEach((tab, i) => tab.addEventListener("click", () => open(i)));
  bindFields(page, (field, value) => saveField(book.docId, field, value));
  bindImages(page, () => book.docId, () => book.data);
  open(0);
  return book;
}

function route() {
  const hash = location.hash.slice(1);
  const current = VIEWS.includes(hash) ? hash : "home";
  for (const view of views) view.hidden = view.dataset.view !== current;
  // 책은 처음 열 때 만듦
  if (BOOKS[current] && !books[current]) {
    books[current] = createBook(views.find((view) => view.dataset.view === current), BOOKS[current]);
  }
  scrollTo(0, 0);
}

addEventListener("hashchange", route);
route();
