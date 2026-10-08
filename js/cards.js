// js/cards.js — 캐릭터 카드 목록 (original.html)
import { bindFields, bindImages, render, saveField, watchCharacter } from "./characters.js";
import { h } from "./utils.js";

function createCard(id) {
  return h(
    "li",
    { class: "card" },
    h("a", { class: "card-link", href: `character.html#${id}`, "aria-label": `#${id}` }),
    h(
      "div",
      { class: "img-slot card-thumb", "data-image": "card" },
      h("img", { alt: "" }),
      h("span", { class: "img-empty" }, "216 × 216"),
      h("div", { class: "admin-tools" }, h("button", { type: "button", "data-action": "image" }, "이미지"))
    ),
    h(
      "div",
      { class: "card-info" },
      h("h3", { "data-field": "name", "data-placeholder": "이름" }),
      h("span", { "data-field": "summary", "data-placeholder": "내용", "data-multiline": true })
    )
  );
}

for (const list of document.querySelectorAll(".card-list[data-ids]")) {
  const ids = list.dataset.ids.split(",").map((s) => s.trim()).filter(Boolean);

  for (const id of ids) {
    const card = createCard(id);
    list.append(card);

    let data = {};
    bindFields(card, (field, value) => saveField(id, field, value));
    bindImages(card, () => id, () => data);
    watchCharacter(id, (d) => {
      data = d;
      render(card, d);
      card.querySelector(".card-link").setAttribute("aria-label", d.name || `#${id}`);
    });
  }
}