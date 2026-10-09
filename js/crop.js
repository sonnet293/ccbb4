// js/crop.js — 이미지 선택 후 자르기
// pickImage(aspect): 파일을 고르고 자르기 창을 띄워 자른 File을 돌려줌 (취소하면 null)
// aspect: 이미지 칸의 가로/세로 비율 (주면 "칸 맞춤" 비율이 기본 선택됨)
import { bindDialog, h, pickFiles } from "./utils.js";

const MAX_SIDE = 2400; // 결과 이미지 긴 변 최대 크기(px)
const MIN = 24; // 자르기 영역 최소 크기(화면 px)
const HANDLES = ["nw", "ne", "sw", "se"];

let ui;
let finish; // 현재 열린 자르기 창의 resolve

export async function pickImage(aspect) {
  const [file] = await pickFiles("image/*");
  if (!file) return null;
  if (/gif|svg/.test(file.type)) return file; // 움직이는 GIF·SVG는 자르면 깨지므로 그대로
  return cropImage(file, aspect);
}

// 칸 요소의 화면 크기로 비율 계산
export function aspectOf(el) {
  const w = el?.clientWidth;
  const hgt = el?.clientHeight;
  return w && hgt ? w / hgt : null;
}

function buildUI() {
  const img = h("img", { class: "crop-img", alt: "", draggable: "false" });
  const box = h("div", { class: "crop-box" }, HANDLES.map((d) => h("span", { class: `crop-handle ${d}`, "data-handle": d })));
  const stage = h("div", { class: "crop-stage" }, img, box);
  const ratios = h("div", { class: "crop-ratios" });
  const original = h("button", { type: "button", class: "ghost" }, "자르지 않기");
  const apply = h("button", { type: "button", class: "primary" }, "적용");
  const dialog = h(
    "dialog",
    { class: "modal modal-wide crop-modal" },
    h(
      "div",
      { class: "modal-body" },
      h("header", { class: "modal-head" }, h("h3", {}, "이미지 자르기"), h("button", { type: "button", class: "icon-btn", "data-close": true, "aria-label": "닫기" }, "×")),
      h("div", { class: "crop-wrap" }, stage),
      ratios,
      h("div", { class: "form-actions" }, original, apply)
    )
  );
  document.body.append(dialog);
  bindDialog(dialog);

  const state = { img, box, stage, ratios, dialog, rect: null, ratio: null, size: null, file: null };
  dialog.addEventListener("close", () => done(null));
  original.addEventListener("click", () => done(state.file));
  apply.addEventListener("click", async () => {
    apply.disabled = true;
    try {
      done(await makeFile(state));
    } finally {
      apply.disabled = false;
    }
  });
  bindDrag(state);

  // 창 크기가 바뀌면 자르기 영역도 같은 비율로 맞춤
  new ResizeObserver(() => {
    const { clientWidth: W, clientHeight: H } = img;
    if (!state.rect || !state.size || !W) return;
    const k = W / state.size.W;
    const r = state.rect;
    state.size = { W, H };
    state.rect = { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k };
    draw(state);
  }).observe(img);
  return state;
}

function done(value) {
  const fn = finish;
  finish = null;
  if (!fn) return;
  URL.revokeObjectURL(ui.img.src);
  if (ui.dialog.open) ui.dialog.close();
  fn(value);
}

function cropImage(file, aspect) {
  ui ||= buildUI();
  return new Promise((resolve, reject) => {
    finish = resolve;
    ui.file = file;
    ui.rect = null;
    ui.img.onload = () => {
      ui.dialog.showModal();
      const options = [
        aspect && ["칸 맞춤", aspect],
        ["1:1", 1],
        ["자유", null],
      ].filter(Boolean);
      ui.ratios.replaceChildren(
        ...options.map(([label, value]) =>
          h("button", { type: "button", class: "chip", onclick: (e) => setRatio(ui, value, e.currentTarget) }, label)
        )
      );
      setRatio(ui, options[0][1], ui.ratios.firstChild);
    };
    ui.img.onerror = () => {
      finish = null;
      URL.revokeObjectURL(ui.img.src);
      reject(new Error("이미지를 불러올 수 없습니다."));
    };
    ui.img.src = URL.createObjectURL(file);
  });
}

// 비율을 바꾸면 그 비율로 들어가는 가장 큰 영역을 가운데에 배치
function setRatio(s, ratio, button) {
  for (const b of s.ratios.children) b.classList.toggle("active", b === button);
  s.ratio = ratio;
  const W = s.img.clientWidth;
  const H = s.img.clientHeight;
  s.size = { W, H };
  let w = W;
  let hgt = H;
  if (ratio) {
    if (W / H > ratio) w = H * ratio;
    else hgt = W / ratio;
  }
  s.rect = { x: (W - w) / 2, y: (H - hgt) / 2, w, h: hgt };
  draw(s);
}

function draw({ box, rect }) {
  Object.assign(box.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
}

function bindDrag(s) {
  let start = null;
  s.stage.addEventListener("pointerdown", (e) => {
    const mode = e.target.dataset.handle || (e.target === s.box ? "move" : null);
    if (!mode || !s.rect) return;
    e.preventDefault();
    start = { mode, px: e.clientX, py: e.clientY, ...s.rect };
    s.stage.setPointerCapture(e.pointerId);
  });
  s.stage.addEventListener("pointermove", (e) => {
    if (!start) return;
    const dx = e.clientX - start.px;
    const dy = e.clientY - start.py;
    const { W, H } = s.size;
    if (start.mode === "move") {
      s.rect.x = clamp(start.x + dx, 0, W - start.w);
      s.rect.y = clamp(start.y + dy, 0, H - start.h);
    } else {
      s.rect = resize(start, dx, dy, s.ratio, W, H);
    }
    draw(s);
  });
  const end = () => (start = null);
  s.stage.addEventListener("pointerup", end);
  s.stage.addEventListener("pointercancel", end);
}

// 잡은 모서리의 반대쪽 모서리를 고정하고 크기 조절
function resize(start, dx, dy, ratio, W, H) {
  const left = start.mode.includes("w");
  const top = start.mode.includes("n");
  const ax = left ? start.x + start.w : start.x; // 고정점
  const ay = top ? start.y + start.h : start.y;
  const maxW = left ? ax : W - ax;
  const maxH = top ? ay : H - ay;
  let w = start.w + (left ? -dx : dx);
  let hgt = start.h + (top ? -dy : dy);
  if (ratio) {
    w = clamp(Math.max(w, hgt * ratio), MIN, Math.min(maxW, maxH * ratio));
    hgt = w / ratio;
  } else {
    w = clamp(w, MIN, maxW);
    hgt = clamp(hgt, MIN, maxH);
  }
  return { x: left ? ax - w : ax, y: top ? ay - hgt : ay, w, h: hgt };
}

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

async function makeFile({ img, rect, size, file }) {
  const scale = img.naturalWidth / size.W;
  const sw = rect.w * scale;
  const sh = rect.h * scale;
  const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const canvas = h("canvas", { width: Math.max(1, Math.round(sw * k)), height: Math.max(1, Math.round(sh * k)) });
  canvas.getContext("2d").drawImage(img, rect.x * scale, rect.y * scale, sw, sh, 0, 0, canvas.width, canvas.height);
  // PNG·WebP는 투명도 유지, 나머지는 JPG
  const type = /png|webp/.test(file.type) ? file.type : "image/jpeg";
  const blob = await new Promise((r) => canvas.toBlob(r, type, 0.92));
  const ext = { "image/png": ".png", "image/webp": ".webp" }[type] || ".jpg";
  return new File([blob], file.name.replace(/\.[^.]*$/, "") + ext, { type });
}
