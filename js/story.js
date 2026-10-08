// js/story.js
import { createCharList } from "./char-list.js";
import { h } from "./utils.js";

const story = createCharList({
  col: "chapters",
  listEl: document.getElementById("storyList"),
  emptyEl: document.getElementById("storyEmpty"),
  addBtn: document.getElementById("storyAdd"),
  defaults: { period: "", title: "", body: "" },
  focus: ".chapter-title",
  deleteLabel: (el) => el.querySelector(".chapter-title").textContent || "이 챕터",
  create: () =>
    h(
      "article",
      { class: "chapter" },
      h(
        "div",
        { class: "chapter-head" },
        h("span", { class: "chapter-star", "aria-hidden": "true" }, "✦"),
        h("span", { class: "chapter-period", "data-field": "period", "data-placeholder": "시기" }),
        h("button", { type: "button", class: "del-btn admin-only", "data-action": "delete", "aria-label": "챕터 삭제", title: "챕터 삭제" }, "×")
      ),
      h(
        "div",
        { class: "chapter-main" },
        h("h3", { class: "chapter-title", "data-field": "title", "data-placeholder": "챕터 이름" }),
        h("div", { class: "chapter-text", "data-field": "body", "data-placeholder": "본문", "data-multiline": true })
      )
    ),
});

export const showStory = (id) => story.show(id);
