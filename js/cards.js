// js/cards.js — 캐릭터 카드 목록 (original.html, au.html)
import { bindFields, bindImages, render, saveField, watchCharacter } from "./characters.js";
import { h } from "./utils.js";

function createCard(id, href, onDelete) {
  return h(
    "li",
    { class: "card" },
    h("a", { class: "card-link", href: `${href}#${id}`, "aria-label": `#${id}` }),
    onDelete &&
      h("button", { type: "button", class: "del-btn admin-only card-del", "aria-label": "카드 삭제", title: "카드 삭제", onclick: onDelete }, "×"),
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

// 카드 하나를 만들고 데이터 연결. onDelete(data)가 있으면 관리자용 삭제(×) 버튼 표시
// stop()은 실시간 연결 해제 (카드를 지울 때 호출)
export function mountCard(id, { href = "character.html", onDelete } = {}) {
  let data = {};
  const card = createCard(id, href, onDelete && (() => onDelete(data)));
  bindFields(card, (field, value) => saveField(id, field, value));
  bindImages(card, () => id, () => data);
  const stop = watchCharacter(id, (d) => {
    data = d;
    render(card, d);
    card.querySelector(".card-link").setAttribute("aria-label", d.name || `#${id}`);
  });
  return { card, stop };
}

for (const list of document.querySelectorAll(".card-list[data-ids]")) {
  const ids = list.dataset.ids.split(",").map((s) => s.trim()).filter(Boolean);
  for (const id of ids) list.append(mountCard(id).card);
}
