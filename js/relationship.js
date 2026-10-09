// js/relationship.js — 관계란 카드 목록 (relationship.html)
// 카드 번호와 순서는 relationship/_list 문서에 저장 { ids: ["1", …], next: 4 }
// 카드 내용은 relationship/{번호} 문서에 저장 { title, tags, body, images: { image } }
// 카드를 누르면 relationship-detail.html#{번호} 로 이동 (이미지 · 해시태그는 상세 페이지와 같이 씀)
import { db } from "./firebase.js";
import { deleteDoc, doc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { COL, bindFields, bindImages, render, saveField, watchCharacter } from "./characters.js";
import { removeFile } from "./supabase.js";
import { errorMessage, h, toast } from "./utils.js";

// 문서가 아직 없을 때 보여줄 기본 카드 (2 × 2)
const DEFAULT_IDS = ["1", "2", "3", "4"];

const listRef = doc(db, COL, "_list");
const withDefaults = (data = {}) => ({ ids: DEFAULT_IDS, ...data });

const listEl = document.querySelector(".rel-list");
const cards = new Map(); // id → { card, stop }
let pendingScroll = null; // 방금 추가한 카드 → 그려지면 화면에 보이게

function createCard(id, onDelete) {
  return h(
    "li",
    { class: "rel-card" },
    h("a", { class: "card-link", href: `relationship-detail.html#${id}`, "aria-label": `#${id}` }),
    h("button", { type: "button", class: "del-btn admin-only card-del", "aria-label": "카드 삭제", title: "카드 삭제", onclick: onDelete }, "×"),
    h(
      "div",
      { class: "img-slot rel-image", "data-image": "image" },
      h("img", { alt: "" }),
      h("span", { class: "img-empty" }, "3 : 2"),
      h("div", { class: "admin-tools" }, h("button", { type: "button", "data-action": "image" }, "이미지"))
    ),
    h(
      "div",
      { class: "rel-text" },
      h("h2", { class: "rel-title", "data-field": "title", "data-placeholder": "제목" }),
      h("span", { class: "rel-tags", "data-field": "tags", "data-placeholder": "#해시태그" }),
      h("span", { class: "rel-body", "data-field": "body", "data-placeholder": "내용", "data-multiline": true })
    )
  );
}

function mountCard(id) {
  let data = {};
  const card = createCard(id, () => removeCard(id, data));
  bindFields(card, (field, value) => saveField(id, field, value));
  bindImages(card, () => id, () => data);
  const stop = watchCharacter(id, (d) => {
    data = d;
    render(card, d);
    card.querySelector(".card-link").setAttribute("aria-label", d.title || `#${id}`);
  });
  return { card, stop };
}

function renderAll({ ids }) {
  for (const [id, entry] of cards) {
    if (ids.includes(id)) continue;
    entry.stop();
    entry.card.remove();
    cards.delete(id);
  }

  listEl.dataset.ready = ""; // 불러온 뒤에만 '카드 없음' 표시
  ids.forEach((id, i) => {
    let entry = cards.get(id);
    if (!entry) {
      entry = mountCard(id);
      cards.set(id, entry);
    }
    if (listEl.children[i] !== entry.card) listEl.insertBefore(entry.card, listEl.children[i] || null);
  });

  if (pendingScroll && cards.has(pendingScroll)) reveal(pendingScroll);
}

function reveal(id) {
  pendingScroll = null;
  cards.get(id).card.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// 번호는 지운 카드와 겹치지 않도록 계속 증가 (next)
async function addCard() {
  return runTransaction(db, async (tx) => {
    const data = withDefaults((await tx.get(listRef)).data());
    const next = Math.max(data.next || 0, ...data.ids.map(Number), 0) + 1;
    tx.set(listRef, { ids: [...data.ids, String(next)], next }, { merge: true });
    return String(next);
  });
}

async function removeCard(id, data) {
  if (!confirm(`'${data.title || `관계 #${id}`}' 카드를 삭제할까요?`)) return;
  try {
    await runTransaction(db, async (tx) => {
      const list = withDefaults((await tx.get(listRef)).data());
      tx.set(listRef, { ids: list.ids.filter((x) => x !== id) }, { merge: true });
    });
    await deleteDoc(doc(db, COL, id));
    removeFile(data.images?.image?.path);
    toast("삭제되었습니다.");
  } catch (err) {
    toast("삭제 실패: " + errorMessage(err), 4000);
  }
}

const addBtn = document.querySelector("[data-add]");
addBtn.addEventListener("click", async () => {
  addBtn.disabled = true;
  try {
    const id = await addCard();
    if (cards.has(id)) reveal(id);
    else pendingScroll = id;
    toast("카드가 추가되었습니다.");
  } catch (err) {
    toast("추가 실패: " + errorMessage(err), 4000);
  } finally {
    addBtn.disabled = false;
  }
});

onSnapshot(
  listRef,
  (snap) => renderAll(withDefaults(snap.data())),
  (err) => {
    console.error(`${COL}/_list 불러오기 실패:`, err);
    renderAll(withDefaults());
  }
);
