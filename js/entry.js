// js/entry.js
import { onAdminChange } from "./auth.js";
import { bindFields, render, replaceImage, savePatch } from "./characters.js";
import { h, toast } from "./utils.js";

export const TYPES = {
  노말: "#949495", 불: "#e56c3e", 물: "#5185c5", 전기: "#fbb917", 풀: "#66a945",
  얼음: "#6dc8eb", 격투: "#e09c40", 독: "#735198", 땅: "#9c7743", 바위: "#bfb889",
  비행: "#a2c3e7", 에스퍼: "#dd6b7b", 벌레: "#9fa244", 고스트: "#684870",
  드래곤: "#535ca8", 악: "#4c4948", 강철: "#69a9c7", 페어리: "#dab4d4",
};

const COUNT = 6;
const DEFAULT_BALL = "img/몬스터볼.png"; // 이름 옆 아이콘 기본값 (관리자는 카드마다 교체 가능)
const MAX_TYPES = 2;

// 이미지가 없을 때 보이는 몬스터볼 (124*124)
const EMPTY_BALL = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M0 0h24v24H0z" fill="none" />
  <path fill="#e3e6eb" d="M14.5 12a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 1 5 0m7.5 0c0 5.52-4.48 10-10 10S2 17.52 2 12S6.48 2 12 2s10 4.48 10 10m-2 0h-4c0-2.21-1.79-4-4-4s-4 1.79-4 4H4c0 4.41 3.59 8 8 8s8-3.59 8-8" />
</svg>`;

const view = document.querySelector('[data-view="entry"]');
const stage = view.querySelector(".entry-stage");
const prevBtn = view.querySelector('[data-go="prev"]');
const nextBtn = view.querySelector('[data-go="next"]');
const dotsEl = view.querySelector(".entry-dots");

let charId = null;
let entries = {};
let current = 0;

const typesOf = (i) => (entries[i]?.types || []).filter((t) => TYPES[t]);
const save = (i, patch) => savePatch(charId, { entry: { [i]: patch } });

function typePill(type, props = {}) {
  return h("span", { class: "type-pill", style: `--type: ${TYPES[type]}`, ...props }, type);
}

// ----- 카드 -----
function buildCard(i) {
  const empty = h("span", { class: "img-empty" });
  empty.innerHTML = EMPTY_BALL;

  const ball = h("img", { src: DEFAULT_BALL, alt: "", width: "20", height: "20" });
  const pills = h("div", { class: "entry-pills" });
  const card = h(
    "article",
    { class: "entry-card", "aria-label": `${i + 1}번째 카드`, onclick: () => i !== current && go(i) },
    h(
      "div",
      { class: "entry-inner" },
      h(
        "header",
        { class: "entry-head" },
        h("button", { type: "button", class: "entry-ball-btn", title: "아이콘 변경", "aria-label": "아이콘 변경", disabled: true, onclick: () => changeBall(i) }, ball),
        h("span", { class: "entry-name", "data-field": "name", "data-placeholder": "포켓몬 이름" })
      ),
      h(
        "div",
        { class: "img-slot entry-photo", "data-image": "photo" },
        h("img", { alt: "" }),
        empty,
        h("div", { class: "admin-tools" }, h("button", { type: "button", onclick: () => changePhoto(i) }, "이미지 변경"))
      ),
      h("div", { class: "entry-types" }, pills),
      h("div", { class: "entry-story", "data-field": "story", "data-placeholder": "스토리", "data-multiline": true })
    )
  );
  bindFields(card, (field, value) => save(i, { [field]: value }));
  card.inner = card.firstChild;
  card.pills = pills;
  card.ball = ball;
  return card;
}

function changeBall(i) {
  replaceImage(
    charId,
    (image) => ({ entry: { [i]: { images: { ball: image } } } }),
    entries[i]?.images?.ball?.path,
    cards[i].ball
  );
}

function changePhoto(i) {
  replaceImage(
    charId,
    (image) => ({ entry: { [i]: { images: { photo: image } } } }),
    entries[i]?.images?.photo?.path,
    cards[i].querySelector(".entry-photo")
  );
}

function renderTypes(i) {
  const types = typesOf(i);
  cards[i].pills.replaceChildren(
    ...types.map((t) => typePill(t)),
    h(
      "button",
      { type: "button", class: "chip admin-only entry-type-edit", onclick: () => togglePicker(i) },
      types.length ? "타입 변경" : "+ 타입"
    )
  );
}

const cards = Array.from({ length: COUNT }, (_, i) => buildCard(i));
stage.querySelector(".entry-track").append(...cards);

// ----- 타입 검색 · 선택 (카드 하나에만 열림) -----
const search = h("input", { type: "search", placeholder: "타입 검색", "aria-label": "타입 검색", autocomplete: "off" });
const options = h("div", { class: "type-options" });
const picker = h(
  "div",
  { class: "type-picker", hidden: true },
  search,
  options,
  h("p", { class: "type-picker-note" }, `최대 ${MAX_TYPES}개 · 다시 누르면 해제`)
);
let pickerFor = null;

function togglePicker(i) {
  if (!picker.hidden && pickerFor === i) return closePicker();
  pickerFor = i;
  cards[i].querySelector(".entry-types").append(picker);
  picker.hidden = false;
  search.value = "";
  renderPicker();
  search.focus();
}

function closePicker() {
  picker.hidden = true;
  pickerFor = null;
}

function renderPicker() {
  const q = search.value.trim();
  const selected = typesOf(pickerFor);
  const list = Object.keys(TYPES).filter((t) => t.includes(q));
  options.replaceChildren(
    ...list.map((t) =>
      h(
        "button",
        { type: "button", class: "type-pill type-option", style: `--type: ${TYPES[t]}`, "aria-pressed": String(selected.includes(t)), onclick: () => toggleType(t) },
        t
      )
    )
  );
  if (!list.length) options.append(h("p", { class: "type-none" }, "검색 결과가 없습니다."));
}

function toggleType(type) {
  const i = pickerFor;
  const types = typesOf(i);
  const next = types.includes(type) ? types.filter((t) => t !== type) : [...types, type];
  if (next.length > MAX_TYPES) return toast(`타입은 최대 ${MAX_TYPES}개까지 지정할 수 있습니다.`);
  entries = { ...entries, [i]: { ...entries[i], types: next } }; // 저장 응답 전에 먼저 반영
  renderTypes(i);
  renderPicker();
  save(i, { types: next });
}

search.addEventListener("input", renderPicker);
search.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    options.querySelector("button")?.click(); // 검색 결과 첫 번째 선택
  } else if (e.key === "Escape") {
    closePicker();
  }
});
document.addEventListener("pointerdown", (e) => {
  if (!picker.hidden && !picker.contains(e.target) && !e.target.closest(".entry-type-edit")) closePicker();
});
onAdminChange((user) => {
  if (!user) closePicker();
  for (const card of cards) card.querySelector(".entry-ball-btn").disabled = !user;
});

// ----- 이동 -----
// 점 하나 = 몬스터볼이 굴러가는 자리. 몬스터볼은 CSS에서 --at(현재 번호)만큼 이동 · 회전
const dots = cards.map((_, i) =>
  h("button", { type: "button", class: "entry-dot", "aria-label": `${i + 1}번째 카드로`, onclick: () => go(i) })
);
dotsEl.prepend(...dots);

function go(i) {
  i = Math.max(0, Math.min(COUNT - 1, i));
  if (i === current) return;
  current = i;
  closePicker();
  layout();
}

// 현재 카드와의 거리(-2~2)로 위치를 정함: 0 가운데, ±1 양옆(흐리게), ±2 숨김
function layout() {
  cards.forEach((card, i) => {
    const d = Math.max(-2, Math.min(2, i - current));
    card.style.setProperty("--d", d);
    card.classList.toggle("is-current", d === 0);
    card.classList.toggle("is-side", Math.abs(d) === 1);
    card.inner.inert = d !== 0; // 옆 카드는 클릭하면 이동만, 안쪽 칸은 수정 · 포커스 불가
  });
  dots.forEach((dot, i) => (i === current ? dot.setAttribute("aria-current", "true") : dot.removeAttribute("aria-current")));
  view.style.setProperty("--at", current);
  prevBtn.disabled = current === 0;
  nextBtn.disabled = current === COUNT - 1;
}

prevBtn.addEventListener("click", () => go(current - 1));
nextBtn.addEventListener("click", () => go(current + 1));

view.addEventListener("keydown", (e) => {
  if (e.target.closest("[contenteditable], input")) return;
  if (e.key === "ArrowLeft") go(current - 1);
  else if (e.key === "ArrowRight") go(current + 1);
});

// 터치 스와이프
let touchX = null;
stage.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch") touchX = e.clientX;
});
stage.addEventListener("pointerup", (e) => {
  if (touchX == null) return;
  const dx = e.clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50) go(current + (dx < 0 ? 1 : -1));
});
stage.addEventListener("pointercancel", () => (touchX = null));

layout();

// character.js에서 캐릭터 데이터가 바뀔 때마다 호출
export function showEntry(id, data) {
  if (id !== charId) {
    charId = id;
    current = 0;
    closePicker();
    layout();
  }
  entries = data.entry || {};
  cards.forEach((card, i) => {
    render(card, entries[i] || {});
    const ballUrl = entries[i]?.images?.ball?.url || DEFAULT_BALL;
    if (card.ball.getAttribute("src") !== ballUrl) card.ball.src = ballUrl;
    renderTypes(i);
  });
  if (!picker.hidden) renderPicker();
}