// js/archive.js — 아카이브 (archive.html: 갤러리, trpg.html: TRPG)
// <body data-kind="gallery|trpg"> 로 어느 목록인지 구분
// 타일 번호와 순서는 archive/_list 문서에 저장 { gallery: ["1", …], trpg: ["7", …], next: 10 }
// 타일 내용은 archive/{번호} 문서에 저장
//   갤러리: { memo, images: { image } }
//   TRPG:   { title, writer, summary, images: { image } }
import { db } from "./firebase.js";
import { deleteDoc, doc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { COL, bindFields, bindImages, render, saveField, watchCharacter } from "./characters.js";
import { removeFile } from "./supabase.js";
import { bindDialog, errorMessage, h, toast } from "./utils.js";

// 문서가 아직 없을 때 보여줄 기본 타일
const DEFAULTS = { gallery: ["1", "2", "3", "4", "5", "6"], trpg: ["7", "8", "9", "10"] };
const KINDS = Object.keys(DEFAULTS);
const KIND = document.body.dataset.kind === "trpg" ? "trpg" : "gallery";
const LABEL = KIND === "trpg" ? "시나리오" : "이미지";

const listRef = doc(db, COL, "_list");
const withDefaults = (data = {}) => ({ ...DEFAULTS, ...data });

const scrollEl = document.querySelector(".arc-scroll"); // 그라데이션 틀
const listEl = document.querySelector(".arc-list"); // 실제로 스크롤되는 목록
const tiles = new Map(); // id → { tile, stop, data }
let pendingScroll = null; // 방금 추가한 타일 → 그려지면 화면에 보이게

const delBtn = (onclick) =>
  h("button", { type: "button", class: "del-btn admin-only card-del", "aria-label": `${LABEL} 삭제`, title: `${LABEL} 삭제`, onclick }, "×");

const imageSlot = (ratio) =>
  h(
    "div",
    { class: "img-slot arc-image", "data-image": "image" },
    h("img", { alt: "" }),
    h("span", { class: "img-empty" }, ratio),
    h("div", { class: "admin-tools" }, h("button", { type: "button", "data-action": "image" }, "이미지 변경"))
  );

// ----- 타일 -----
function createTile(id, entry) {
  if (KIND === "trpg") {
    return h(
      "li",
      { class: "arc-tile" },
      h("button", { type: "button", class: "tile-open", "aria-label": `시나리오 #${id}`, onclick: () => openScenario(id) }),
      delBtn(() => removeTile(id, entry.data)),
      imageSlot("3 : 2"),
      h("div", { class: "arc-hover", "aria-hidden": "true" }, h("strong", { class: "arc-hover-title" }))
    );
  }
  return h(
    "li",
    { class: "arc-tile" },
    h("button", { type: "button", class: "tile-open", "aria-label": `이미지 #${id} 크게 보기`, onclick: () => openViewer(entry.data) }),
    delBtn(() => removeTile(id, entry.data)),
    imageSlot("243 × 243"),
    h("span", { class: "arc-memo", "data-field": "memo", "data-placeholder": "메모" })
  );
}

function mountTile(id) {
  const entry = { data: {} };
  const tile = (entry.tile = createTile(id, entry));
  bindFields(tile, (field, value) => saveField(id, field, value));
  bindImages(tile, () => id, () => entry.data);
  entry.stop = watchCharacter(id, (d) => {
    entry.data = d;
    render(tile, d);
    if (KIND === "trpg") {
      // 타일 위 제목은 보여주기만 (수정은 상세 창에서)
      tile.querySelector(".arc-hover-title").textContent = d.title || "시나리오 제목";
      tile.querySelector(".tile-open").setAttribute("aria-label", d.title || `시나리오 #${id}`);
    }
    if (current === id) render(scenario, d);
  });
  return entry;
}

function renderAll(data) {
  const ids = data[KIND];
  for (const [id, entry] of tiles) {
    if (ids.includes(id)) continue;
    entry.stop();
    entry.tile.remove();
    tiles.delete(id);
  }

  listEl.dataset.ready = ""; // 불러온 뒤에만 '타일 없음' 표시
  ids.forEach((id, i) => {
    let entry = tiles.get(id);
    if (!entry) {
      entry = mountTile(id);
      tiles.set(id, entry);
    }
    if (listEl.children[i] !== entry.tile) listEl.insertBefore(entry.tile, listEl.children[i] || null);
  });
  updateFade();

  if (pendingScroll && tiles.has(pendingScroll)) reveal(pendingScroll);
}

function reveal(id) {
  pendingScroll = null;
  tiles.get(id).tile.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// ----- 하단 그라데이션: 스크롤이 끝나면 사라짐 -----
function updateFade() {
  const rest = listEl.scrollHeight - listEl.clientHeight - listEl.scrollTop;
  scrollEl.classList.toggle("at-end", rest <= 2);
}
listEl.addEventListener("scroll", updateFade, { passive: true });
new ResizeObserver(updateFade).observe(listEl);

// ----- 추가 · 삭제 -----
// 번호는 지운 타일과 겹치지 않도록 계속 증가 (next)
async function addTile() {
  return runTransaction(db, async (tx) => {
    const data = withDefaults((await tx.get(listRef)).data());
    const used = KINDS.flatMap((k) => data[k]).map(Number);
    const next = Math.max(data.next || 0, ...used, 0) + 1;
    tx.set(listRef, { [KIND]: [...data[KIND], String(next)], next }, { merge: true });
    return String(next);
  });
}

async function removeTile(id, data) {
  if (!confirm(`'${data.title || `${LABEL} #${id}`}' 을(를) 삭제할까요?`)) return;
  try {
    await runTransaction(db, async (tx) => {
      const list = withDefaults((await tx.get(listRef)).data());
      tx.set(listRef, { [KIND]: list[KIND].filter((x) => x !== id) }, { merge: true });
    });
    await deleteDoc(doc(db, COL, id));
    removeFile(data.images?.image?.path);
    if (current === id) scenario.close();
    toast("삭제되었습니다.");
  } catch (err) {
    toast("삭제 실패: " + errorMessage(err), 4000);
  }
}

const addBtn = document.querySelector("[data-add]");
addBtn.addEventListener("click", async () => {
  addBtn.disabled = true;
  try {
    const id = await addTile();
    if (tiles.has(id)) reveal(id);
    else pendingScroll = id;
    toast(`${LABEL}이(가) 추가되었습니다.`);
  } catch (err) {
    toast("추가 실패: " + errorMessage(err), 4000);
  } finally {
    addBtn.disabled = false;
  }
});

// ----- 갤러리: 이미지 크게 보기 -----
const viewerImg = h("img", { class: "viewer-img", alt: "" });
const viewer = bindDialog(
  h(
    "dialog",
    { class: "arc-dialog viewer" },
    h("div", { class: "arc-frame" }, h("button", { type: "button", class: "arc-close", "data-close": "", "aria-label": "닫기" }, "×"), viewerImg)
  )
);

function openViewer(data) {
  const url = data.images?.image?.url;
  if (!url) return; // 이미지가 없으면 열지 않음
  viewerImg.src = url;
  viewerImg.alt = data.memo || "";
  viewer.showModal();
}

// ----- TRPG: 시나리오 상세 (669 × 730) -----
let current = null; // 열려 있는 시나리오 번호
const scenario = bindDialog(
  h(
    "dialog",
    { class: "arc-dialog scenario" },
    h(
      "div",
      { class: "arc-frame" },
      h("button", { type: "button", class: "arc-close", "data-close": "", "aria-label": "닫기" }, "×"),
      h(
        "article",
        { class: "sc-box" },
        imageSlot("669 × 399"),
        h(
          "div",
          { class: "sc-text" },
          h("h1", { class: "sc-title", "data-field": "title", "data-placeholder": "시나리오 제목" }),
          h("span", { class: "sc-writer", "data-field": "writer", "data-placeholder": "라이터 이름" }),
          h("span", { class: "sc-summary", "data-field": "summary", "data-placeholder": "시나리오 개요", "data-multiline": true })
        )
      )
    )
  )
);
document.body.append(viewer, scenario); // showModal은 문서에 붙어 있어야 동작
bindFields(scenario, (field, value) => saveField(current, field, value));
bindImages(scenario, () => current, () => tiles.get(current)?.data || {});
scenario.addEventListener("close", () => {
  scenario.querySelector(":focus")?.blur(); // 수정 중이던 칸 저장
  current = null;
});

function openScenario(id) {
  current = id;
  render(scenario, tiles.get(id)?.data || {});
  scenario.querySelector(".sc-summary").scrollTop = 0;
  scenario.showModal();
}

onSnapshot(
  listRef,
  (snap) => renderAll(withDefaults(snap.data())),
  (err) => {
    console.error(`${COL}/_list 불러오기 실패:`, err);
    renderAll(withDefaults());
  }
);
