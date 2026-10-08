// js/character.js
import "./sub.js";
import { bindFields, bindImages, render, saveField, watchCharacter } from "./characters.js";
import { showStory } from "./story.js";
import { showMemo } from "./memo.js";
import { showEntry } from "./entry.js";

const IDS = ["1", "2", "3", "4"];
const TABS = ["profile", "story", "memo", "entry"];

const root = document.getElementById("character");
const tabLinks = [...root.querySelectorAll("[data-tab]")];
const views = [...root.querySelectorAll("[data-view]")];
const profile = root.querySelector('[data-view="profile"]');

let currentId = null;
let data = {};
let unsubscribe = null;

function update() {
  render(profile, data);
  showEntry(currentId, data);
  document.title = `${data.name || "#" + currentId} · 시시비비`;
}

function route() {
  const [id, rawTab] = location.hash.slice(1).split("/");
  if (!IDS.includes(id)) return location.replace("original.html");
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