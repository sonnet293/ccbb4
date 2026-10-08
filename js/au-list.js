// js/au-list.js — AU · TRPG 카드 목록 (au.html)
// 줄마다 들어갈 카드 번호와 순서는 au/_list 문서에 저장 { au: ["1", …], trpg: ["5", …], next: 9 }
// 카드 내용은 다른 캐릭터처럼 au/{번호} 문서에 저장
import { db } from "./firebase.js";
import {
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { COL, listCol } from "./characters.js";
import { mountCard } from "./cards.js";
import { removeFile } from "./supabase.js";
import { errorMessage, toast } from "./utils.js";

// 문서가 아직 없을 때 보여줄 기본 카드
const DEFAULTS = { au: ["1", "2", "3", "4"], trpg: ["5", "6", "7", "8"] };
const KINDS = Object.keys(DEFAULTS);
const LABELS = { au: "AU", trpg: "TRPG" };

const listRef = doc(db, COL, "_list");
const withDefaults = (data = {}) => ({ ...DEFAULTS, ...data });

const lists = Object.fromEntries(KINDS.map((kind) => [kind, document.querySelector(`.card-list[data-kind="${kind}"]`)]));
const cards = new Map(); // id → { card, stop }
let pendingScroll = null; // 방금 추가한 카드 → 그려지면 화면에 보이게

function renderAll(data) {
  const all = new Set(KINDS.flatMap((kind) => data[kind]));

  for (const [id, entry] of cards) {
    if (all.has(id)) continue;
    entry.stop();
    entry.card.remove();
    cards.delete(id);
  }

  for (const kind of KINDS) {
    const listEl = lists[kind];
    listEl.dataset.ready = ""; // 불러온 뒤에만 '카드 없음' 표시
    data[kind].forEach((id, i) => {
      let entry = cards.get(id);
      if (!entry) {
        entry = mountCard(id, { href: "au-character.html", onDelete: (d) => removeCard(kind, id, d) });
        cards.set(id, entry);
      }
      if (listEl.children[i] !== entry.card) listEl.insertBefore(entry.card, listEl.children[i] || null);
    });
  }

  if (pendingScroll && cards.has(pendingScroll)) reveal(pendingScroll);
}

function reveal(id) {
  pendingScroll = null;
  cards.get(id).card.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// 번호는 지운 카드와 겹치지 않도록 계속 증가 (next)
async function addCard(kind) {
  return runTransaction(db, async (tx) => {
    const data = withDefaults((await tx.get(listRef)).data());
    const used = KINDS.flatMap((k) => data[k]).map(Number);
    const next = Math.max(data.next || 0, ...used, 0) + 1;
    tx.set(listRef, { [kind]: [...data[kind], String(next)], next }, { merge: true });
    return String(next);
  });
}

// 문서에 들어 있는 이미지 경로를 모두 모음 (프로필 · 엔트리 등)
function imagePaths(value, out = []) {
  if (value && typeof value === "object") {
    if (typeof value.path === "string") out.push(value.path);
    Object.values(value).forEach((v) => imagePaths(v, out));
  }
  return out;
}

async function removeCard(kind, id, data) {
  if (!confirm(`'${data.name || `${LABELS[kind]} #${id}`}' 카드를 삭제할까요?\n프로필 · 스토리 · 메모 · 엔트리가 모두 삭제됩니다.`)) return;
  try {
    await runTransaction(db, async (tx) => {
      const list = withDefaults((await tx.get(listRef)).data());
      tx.set(listRef, { [kind]: list[kind].filter((x) => x !== id) }, { merge: true });
    });
    for (const sub of ["chapters", "memos"]) {
      const snap = await getDocs(listCol(id, sub));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }
    await deleteDoc(doc(db, COL, id));
    imagePaths(data).forEach(removeFile);
    toast("삭제되었습니다.");
  } catch (err) {
    toast("삭제 실패: " + errorMessage(err), 4000);
  }
}

for (const btn of document.querySelectorAll("[data-add]")) {
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const id = await addCard(btn.dataset.add);
      if (cards.has(id)) reveal(id);
      else pendingScroll = id;
      toast("카드가 추가되었습니다.");
    } catch (err) {
      toast("추가 실패: " + errorMessage(err), 4000);
    } finally {
      btn.disabled = false;
    }
  });
}

onSnapshot(
  listRef,
  (snap) => renderAll(withDefaults(snap.data())),
  (err) => {
    console.error(`${COL}/_list 불러오기 실패:`, err);
    renderAll(withDefaults());
  }
);
