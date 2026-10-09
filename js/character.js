// js/character.js
import "./sub.js";
import { bindFields, bindImages, render, saveField, watchCharacter } from "./characters.js";
import { showStory } from "./story.js";
import { showMemo } from "./memo.js";

const root = document.getElementById("character");
const tabLinks = [...root.querySelectorAll("[data-tab]")];
const TABS = tabLinks.map((link) => link.dataset.tab); // 페이지마다 탭 구성이 다름 (AU·TRPG는 엔트리 없음)

// 엔트리 탭이 있는 페이지에서만 불러옴
let showEntry = () => {};
if (TABS.includes("entry")) ({ showEntry } = await import("./entry.js"));

// data-ids가 있으면 그 번호만, 없으면(AU·TRPG처럼 카드를 추가하는 페이지) 양의 정수 아무거나
const IDS = root.dataset.ids?.split(",");
const isValid = (id) => (IDS ? IDS.includes(id) : /^[1-9]\d*$/.test(id));
const listPage = root.querySelector(".char-back").getAttribute("href");
const views = [...root.querySelectorAll("[data-view]")];
const profile = root.querySelector('[data-view="profile"]');

// 파비콘 태그가 있는 페이지(오리지널)에서만 캐릭터별로 바꿈
const favicon = document.getElementById("favicon");
const FAVICONS = { 1: "시릴파비", 2: "녹샤파비", 3: "레미파비", 4: "비제파비" };

let currentId = null;
let data = {};
let unsubscribe = null;

function update() {
  render(profile, data);
  showEntry(currentId, data);
  document.title = `${data.name || "#" + currentId} · 시시비비`;
  if (favicon && FAVICONS[currentId]) favicon.href = `img/${FAVICONS[currentId]}.png`;
}

function route() {
  const [id, rawTab] = location.hash.slice(1).split("/");
  if (!isValid(id)) return location.replace(listPage);
  const tab = TABS.includes(rawTab) ? rawTab : "profile";

  for (const link of tabLinks) {
    const t = link.dataset.tab;
    link.href = t === "profile" ? `#${id}` : `#${id}/${t}`;
    if (t === tab) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  for (const view of views) view.hidden = view.dataset.view !== tab;

  if (id !== currentId) {
    currentId = id;
    data = {};
    update();
    unsubscribe?.();
    unsubscribe = watchCharacter(id, (d) => {
      data = d;
      update();
    });
  }

  // 스토리·메모는 처음 열 때 불러옴
  if (tab === "story") showStory(id);
  if (tab === "memo") showMemo(id);
}

bindFields(profile, (field, value) => saveField(currentId, field, value));
bindImages(profile, () => currentId, () => data);
addEventListener("hashchange", route);
route();