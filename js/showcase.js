// js/showcase.js — 메인 이미지 & 배너
// 파일은 Supabase Storage, URL/링크 정보는 Firestore(site/config)에 저장합니다.
import { db } from "./firebase.js";
import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { uploadFile, removeFile } from "./supabase.js";
import { errorMessage, pickFiles, safeUrl, toast } from "./utils.js";

const configRef = doc(db, "site", "config");
let config = {};

const slots = [...document.querySelectorAll("[data-slot]")];

function render() {
  for (const el of slots) {
    const data = config[el.dataset.slot] || {};
    const img = el.querySelector("img");
    if (data.url) {
      if (img.getAttribute("src") !== data.url) img.src = data.url;
      el.classList.add("has-image");
    } else {
      img.removeAttribute("src");
      el.classList.remove("has-image");
    }
    const anchor = el.querySelector("a");
    if (anchor) {
      const link = data.link ? safeUrl(data.link) : null;
      if (link) anchor.href = link;
      else anchor.removeAttribute("href");
    }
  }
}

onSnapshot(
  configRef,
  (snap) => {
    config = snap.data() || {};
    render();
  },
  (err) => console.error("site/config 불러오기 실패:", err)
);

async function changeImage(key) {
  const [file] = await pickFiles("image/*");
  if (!file) return;
  try {
    toast("업로드 중…", 60000);
    const oldPath = config[key]?.path;
    const { url, path } = await uploadFile(file, key === "main" ? "main" : "banners");
    await setDoc(configRef, { [key]: { url, path } }, { merge: true });
    if (oldPath) removeFile(oldPath);
    toast("이미지가 변경되었습니다.");
  } catch (err) {
    console.error(err);
    toast("업로드 실패: " + errorMessage(err), 4000);
  }
}

async function changeLink(key) {
  const value = prompt("배너를 눌렀을 때 이동할 주소 (https://…)\n비워두면 링크가 제거됩니다.", config[key]?.link || "");
  if (value === null) return;
  const link = value.trim();
  if (link && !safeUrl(link)) return toast("http(s) 주소만 입력할 수 있습니다.");
  try {
    await setDoc(configRef, { [key]: { link } }, { merge: true });
    toast(link ? "링크가 저장되었습니다." : "링크가 제거되었습니다.");
  } catch (err) {
    toast("저장 실패: " + errorMessage(err), 4000);
  }
}

for (const el of slots) {
  const key = el.dataset.slot;
  el.querySelector('[data-action="image"]')?.addEventListener("click", () => changeImage(key));
  el.querySelector('[data-action="link"]')?.addEventListener("click", () => changeLink(key));
}
