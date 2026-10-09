// js/characters.js
// 캐릭터 데이터
// 저장 위치: <body data-collection="au"> → au 컬렉션 (없으면 characters)
// 화면 요소 규칙:
// [data-field="name"] - 텍스트 필드
// [data-image="main"] - 이미지 자리
import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { onAdminChange } from "./auth.js";
import { uploadFile, removeFile } from "./supabase.js";
import { aspectOf, pickImage } from "./crop.js";
import { errorMessage, toast } from "./utils.js";

export const COL = document.body.dataset.collection || "characters";

const charRef = (id) => doc(db, COL, id);

export function watchCharacter(id, callback) {
  return onSnapshot(
    charRef(id),
    (snap) => callback(snap.data() || {}),
    (err) => console.error(`${COL}/${id} 불러오기 실패:`, err)
  );
}

async function saveTo(ref, patch) {
  try {
    await setDoc(ref, patch, { merge: true });
    toast("저장되었습니다.");
  } catch (err) {
    toast("저장 실패: " + errorMessage(err), 4000);
  }
}

export const saveField = (id, field, value) => saveTo(charRef(id), { [field]: value });

export const savePatch = (id, patch) => saveTo(charRef(id), patch);

// ----- 캐릭터별 목록 (스토리 chapters, 메모 memos …) -----
export const listCol = (id, col) => collection(db, COL, id, col);

export function watchList(id, col, callback) {
  return onSnapshot(
    query(listCol(id, col), orderBy("order")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error(`${COL}/${id}/${col} 불러오기 실패:`, err);
      callback([]);
    }
  );
}

export async function addItem(id, col, data) {
  try {
    const ref = await addDoc(listCol(id, col), { order: Date.now(), ...data });
    return ref.id;
  } catch (err) {
    toast("추가 실패: " + errorMessage(err), 4000);
    return null;
  }
}

export const saveItemField = (id, col, itemId, field, value) =>
  saveTo(doc(listCol(id, col), itemId), { [field]: value });

export async function deleteItem(id, col, itemId) {
  try {
    await deleteDoc(doc(listCol(id, col), itemId));
    toast("삭제되었습니다.");
  } catch (err) {
    toast("삭제 실패: " + errorMessage(err), 4000);
  }
}

// ----- 이미지 -----
// toPatch({ url, path }) → 캐릭터 문서에 합칠 내용 (엔트리 카드 등 images 밖에 저장할 때 사용)
// slot: 이미지 칸 요소 (자르기 비율 계산용)
export async function replaceImage(id, toPatch, oldPath, slot) {
  try {
    const file = await pickImage(aspectOf(slot));
    if (!file) return;
    toast("업로드 중…", 60000);
    const { url, path } = await uploadFile(file, COL);
    await setDoc(charRef(id), toPatch({ url, path }), { merge: true });
    if (oldPath) removeFile(oldPath);
    toast("이미지가 변경되었습니다.");
  } catch (err) {
    console.error(err);
    toast("업로드 실패: " + errorMessage(err), 4000);
  }
}

const changeImage = (id, key, oldPath, slot) => replaceImage(id, (image) => ({ images: { [key]: image } }), oldPath, slot);

// ----- 화면 연결 -----
let isAdmin = false;

function setEditable(el, on) {
  if (!on) return el.removeAttribute("contenteditable");
  try {
    el.contentEditable = "plaintext-only"; // 붙여넣기 시 서식 제거
  } catch {
    el.contentEditable = "true";
  }
}

// 로그인 상태가 바뀌면 화면의 모든 수정 칸을 한 번에 전환 (나중에 생긴 칸은 bindFields에서 처리)
onAdminChange((user) => {
  isAdmin = !!user;
  document.querySelectorAll("[data-field]").forEach((el) => setEditable(el, isAdmin));
});

// save(field, value): 칸 내용이 바뀐 채로 포커스가 빠지면 호출
export function bindFields(root, save) {
  for (const el of root.querySelectorAll("[data-field]")) {
    setEditable(el, isAdmin);
    el.addEventListener("focus", () => (el.dataset.before = el.innerText));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !el.hasAttribute("data-multiline")) {
        e.preventDefault();
        el.blur();
      } else if (e.key === "Escape") {
        el.innerText = el.dataset.before; // 수정 취소
        el.blur();
      }
    });
    el.addEventListener("blur", () => {
      const value = el.innerText.trim();
      if (!value) el.textContent = ""; // 남은 <br> 제거 → placeholder 다시 표시
      if (value === (el.dataset.before || "").trim()) return;
      save(el.dataset.field, value);
    });
  }
}

// getId: 현재 캐릭터 id를 돌려주는 함수 (세부 페이지는 #1 → #2 이동 시 바뀜)
export function bindImages(root, getId, getData) {
  for (const slot of root.querySelectorAll("[data-image]")) {
    slot.querySelector('[data-action="image"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const key = slot.dataset.image;
      changeImage(getId(), key, getData().images?.[key]?.path, slot);
    });
  }
}

export function render(root, data) {
  for (const el of root.querySelectorAll("[data-field]")) {
    if (document.activeElement === el) continue; // 수정 중인 칸은 덮어쓰지 않음
    el.textContent = data[el.dataset.field] || "";
  }
  for (const slot of root.querySelectorAll("[data-image]")) {
    const url = data.images?.[slot.dataset.image]?.url;
    const img = slot.querySelector("img");
    if (url) {
      if (img.getAttribute("src") !== url) img.src = url;
    } else {
      img.removeAttribute("src");
    }
    slot.classList.toggle("has-image", !!url);
  }
}