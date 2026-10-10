// js/archive.js — 아카이브 (archive.html: 갤러리, trpg.html: TRPG)
import { db } from "./firebase.js";
import { deleteDoc, doc, onSnapshot, runTransaction, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
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
    h("span", { class: "arc-tags admin-only", "data-field": "tags", "data-placeholder": "#태그", spellcheck: "false" }),
    h("span", { class: "arc-memo", "data-field": "memo", "data-placeholder": "메모" })
  );
}

function mountTile(id) {
  const entry = { data: {} };
  const tile = (entry.tile = createTile(id, entry));
  tile.dataset.id = id;
  bindFields(tile, (field, value) => {
    if (field !== "tags") return saveField(id, field, value);
    const tags = formatTags(value);
    tile.querySelector(".arc-tags").textContent = tags; // 같은 값이면 스냅샷이 안 오므로 바로 정리
    saveField(id, field, tags);
  });
  bindImages(tile, () => id, () => entry.data);
  entry.stop = watchCharacter(id, (d) => {
    entry.data = d;
    render(tile, d);
    if (KIND === "trpg") {
  
      tile.querySelector(".arc-hover-title").textContent = d.title || "시나리오 제목";
      tile.querySelector(".tile-open").setAttribute("aria-label", d.title || `시나리오 #${id}`);
    }
    if (current === id) render(scenario, d);
    if (KIND === "gallery") renderTagBar();
  });
  return entry;
}

function renderAll(data) {
  const ids = data[KIND];
  tagOrder = data.tagOrder || [];
  for (const [id, entry] of tiles) {
    if (ids.includes(id)) continue;
    entry.stop();
    entry.tile.remove();
    tiles.delete(id);
  }

  listEl.dataset.ready = ""; 
  ids.forEach((id, i) => {
    let entry = tiles.get(id);
    if (!entry) {
      entry = mountTile(id);
      tiles.set(id, entry);
    }
    if (listEl.children[i] !== entry.tile) listEl.insertBefore(entry.tile, listEl.children[i] || null);
  });
  if (KIND === "gallery") renderTagBar();
  if (picked.some((id) => !tiles.has(id))) setPicked(picked.filter((id) => tiles.has(id))); // 고른 타일이 삭제됨
  updateFade();

  reveal();
}

// 필터 중엔 태그가 불러와져 타일이 보일 때까지 기다림
function reveal() {
  const tile = tiles.get(pendingScroll)?.tile;
  if (!tile || tile.hidden) return;
  pendingScroll = null;
  tile.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// ----- 갤러리: 해시태그 필터 -----
// 태그는 "#풍경 #낙서" 형태의 글자로 저장 (띄어쓰기 · 쉼표 · # 어느 것으로 나눠도 됨)
const parseTags = (text = "") => [...new Set(text.split(/[\s,#]+/).filter(Boolean))];
const formatTags = (text) => parseTags(text).map((t) => "#" + t).join(" ");

let activeTag = null; // 선택된 태그 (null이면 전체)
let tagOrder = []; // 관리자가 정한 태그 순서 (_list 문서). 없는 태그는 뒤에 가나다순
let dragging = false; // 태그를 끄는 중에는 버튼을 다시 그리지 않음
const tagBar = h("div", { class: "arc-tagbar", role: "toolbar", "aria-label": "해시태그 필터", hidden: true });
if (KIND === "gallery") document.querySelector(".cards-head").prepend(tagBar);

const tagChip = (tag, label) =>
  h("button", { type: "button", class: "chip", "data-tag": tag, "aria-pressed": String(activeTag === tag), onclick: () => setTag(tag) }, label);

function sortTags(tags) {
  const rank = (t) => (tagOrder.includes(t) ? tagOrder.indexOf(t) : Infinity);
  return tags.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "ko"));
}

function setTag(tag) {
  activeTag = activeTag === tag ? null : tag; // 같은 태그를 다시 누르면 해제
  renderTagBar();
  listEl.scrollTop = 0;
}

function renderTagBar() {
  const all = sortTags([...new Set([...tiles.values()].flatMap((e) => parseTags(e.data.tags)))]);
  if (activeTag && !all.includes(activeTag)) activeTag = null; // 선택한 태그가 사라지면 전체로
  tagBar.hidden = !all.length;
  if (!dragging) tagBar.replaceChildren(tagChip(null, "전체"), ...all.map((t) => tagChip(t, "#" + t)));
  for (const e of tiles.values()) e.tile.hidden = !!activeTag && !parseTags(e.data.tags).includes(activeTag);
  updateFade();
  reveal();
}

// 관리자: 태그 버튼을 끌어서 순서 바꾸기 (마우스 · 터치 모두 pointer 이벤트로 처리)
tagBar.addEventListener("pointerdown", (e) => {
  const chip = e.target.closest("[data-tag]");
  if (!chip || !document.body.classList.contains("is-admin") || e.button !== 0) return;
  const start = { x: e.clientX, y: e.clientY };

  const move = (ev) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return; // 살짝 흔들린 건 클릭으로
      dragging = true;
      chip.classList.add("dragging");
    }
    const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-tag]");
    if (!over || over === chip || over.parentNode !== tagBar) return;
    const r = over.getBoundingClientRect();
    tagBar.insertBefore(chip, ev.clientX > r.left + r.width / 2 ? over.nextSibling : over);
  };

  const up = () => {
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", up);
    removeEventListener("pointercancel", up);
    if (!dragging) return;
    dragging = false;
    chip.classList.remove("dragging");
    // 놓을 때 생기는 클릭은 무시 (필터가 바뀌지 않게)
    const eat = (ev) => ev.stopPropagation();
    addEventListener("click", eat, { capture: true, once: true });
    setTimeout(() => removeEventListener("click", eat, { capture: true }));
    saveTagOrder([...tagBar.querySelectorAll("[data-tag]")].map((c) => c.dataset.tag));
  };

  addEventListener("pointermove", move);
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);
});

async function saveTagOrder(order) {
  if (order.join() === sortTags([...order]).join()) return; // 그대로 놓음
  tagOrder = order;
  renderTagBar();
  try {
    await setDoc(listRef, { tagOrder: order }, { merge: true });
    toast("태그 순서가 저장되었습니다.");
  } catch (err) {
    toast("저장 실패: " + errorMessage(err), 4000);
  }
}

// ----- 관리자: 두 타일 자리 바꾸기 -----
// '순서 변경' → 타일 두 개를 차례로 고르고 '완료'를 누르면 서로 자리가 바뀜
let picked = []; // 고른 타일 번호 (최대 2개)
const swapStart = h("button", { type: "button", class: "chip", onclick: () => setSwapMode(true) }, "순서 변경");
const swapHint = h("span", { class: "arc-swap-hint" });
const swapDone = h("button", { type: "button", class: "chip is-primary", onclick: () => swapTiles() }, "완료");
const swapCancel = h("button", { type: "button", class: "chip", onclick: () => setSwapMode(false) }, "취소");
const swapBar = h("div", { class: "arc-swap admin-only" }, swapStart, swapHint, swapDone, swapCancel);
document.querySelector(".cards-head").insertBefore(swapBar, document.querySelector("[data-add]"));
setSwapMode(false);

function setSwapMode(on) {
  listEl.classList.toggle("swapping", on);
  swapStart.hidden = on;
  swapHint.hidden = swapDone.hidden = swapCancel.hidden = !on;
  setPicked([]);
}

function setPicked(ids) {
  picked = ids;
  for (const [id, e] of tiles) {
    const n = picked.indexOf(id);
    if (n < 0) delete e.tile.dataset.pick;
    else e.tile.dataset.pick = n + 1;
  }
  swapHint.textContent = ["첫 번째 " + LABEL + " 선택", "바꿀 " + LABEL + " 선택", "완료하기"][picked.length];
  swapDone.disabled = picked.length < 2;
}

listEl.addEventListener("click", (e) => {
  if (!listEl.classList.contains("swapping")) return;
  const id = e.target.closest(".arc-tile")?.dataset.id;
  if (!id) return;
  if (picked.includes(id)) setPicked(picked.filter((x) => x !== id)); // 다시 누르면 선택 해제
  else setPicked([picked[0] ?? id, ...(picked.length ? [id] : [])]); // 두 번째는 새로 누른 것으로 교체
});

addEventListener("keydown", (e) => {
  if (e.key === "Escape" && listEl.classList.contains("swapping")) setSwapMode(false);
});

async function swapTiles() {
  const [a, b] = picked;
  swapDone.disabled = true;
  try {
    await runTransaction(db, async (tx) => {
      const ids = [...withDefaults((await tx.get(listRef)).data())[KIND]];
      const i = ids.indexOf(a), j = ids.indexOf(b);
      if (i < 0 || j < 0) throw new Error(`${LABEL}이(가) 이미 삭제되었습니다.`);
      [ids[i], ids[j]] = [ids[j], ids[i]];
      tx.set(listRef, { [KIND]: ids }, { merge: true });
    });
    setSwapMode(false);
    toast("순서가 바뀌었습니다.");
  } catch (err) {
    swapDone.disabled = false;
    toast("저장 실패: " + errorMessage(err), 4000);
  }
}

// ----- 하단 그라데이션: 스크롤이 끝나면 사라짐 -----
function updateFade() {
  const rest = listEl.scrollHeight - listEl.clientHeight - listEl.scrollTop;
  scrollEl.classList.toggle("at-end", rest <= 2);
}
listEl.addEventListener("scroll", updateFade, { passive: true });
new ResizeObserver(updateFade).observe(listEl);

// ----- 추가 · 삭제 -----
// tag: 필터로 보고 있던 태그 → 새 이미지에 미리 붙여서 필터 안에 바로 보이게
async function addTile(tag) {
  return runTransaction(db, async (tx) => {
    const data = withDefaults((await tx.get(listRef)).data());
    const used = KINDS.flatMap((k) => data[k]).map(Number);
    const next = Math.max(data.next || 0, ...used, 0) + 1;
    tx.set(listRef, { [KIND]: [...data[KIND], String(next)], next }, { merge: true });
    if (tag) tx.set(doc(db, COL, String(next)), { tags: "#" + tag }, { merge: true });
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
    const id = await addTile(KIND === "gallery" ? activeTag : null);
    pendingScroll = id;
    reveal();
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
