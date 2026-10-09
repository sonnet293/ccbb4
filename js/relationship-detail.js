// js/relationship-detail.js — 관계 상세 페이지 (relationship-detail.html#{번호})
// 저장 위치: relationship/{번호} 문서 { pairName, pair, tags, story, cast, images: { image } }
// 이미지 · 해시태그는 목록 카드(relationship.html)와 같이 씀
import "./sub.js";
import { bindFields, bindImages, render, saveField, watchCharacter } from "./characters.js";
import { h } from "./utils.js";

const root = document.getElementById("pair");
const tagsEl = root.querySelector(".pair-tags");
const listPage = root.querySelector(".pair-back").getAttribute("href");

let currentId = null;
let data = {};
let unsubscribe = null;

// "#친구 #라이벌" → <h5>#친구</h5><h5>#라이벌</h5>
function renderTags(text = "") {
  const tags = text.split(/\s+/).filter(Boolean);
  tagsEl.replaceChildren(...tags.map((tag) => h("h5", {}, tag)));
}

function update() {
  render(root, data);
  renderTags(data.tags);
  document.title = `${data.pairName || data.pair || "#" + currentId} · 시시비비`;
}

function route() {
  const id = location.hash.slice(1);
  if (!/^[1-9]\d*$/.test(id)) return location.replace(listPage);
  if (id === currentId) return;
  currentId = id;
  data = {};
  update();
  unsubscribe?.();
  unsubscribe = watchCharacter(id, (d) => {
    data = d;
    update();
  });
  scrollTo(0, 0);
}

bindFields(root, (field, value) => saveField(currentId, field, value));
bindImages(root, () => currentId, () => data);
addEventListener("hashchange", route);
route();
