// js/guestbook.js — 방명록 팝업 (Firestore: guestbook)
// 누구나 작성 가능, 답글/삭제는 관리자만.
import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { onAdminChange } from "./auth.js";
import { bindDialog, errorMessage, formatDateTime, h, toast } from "./utils.js";

const modal = bindDialog(document.getElementById("guestbookModal"));
const form = document.getElementById("gbForm");
const list = document.getElementById("gbList");
const count = document.getElementById("gbCount");

const NAME_KEY = "ccbb.guestbook.name";
let entries = [];
let isAdmin = false;
let subscribed = false;

document.getElementById("guestbookBtn").addEventListener("click", () => {
  if (!subscribed) subscribe();
  try {
    if (!form.name.value) form.name.value = localStorage.getItem(NAME_KEY) || "";
  } catch {}
  modal.showModal();
});

function subscribe() {
  subscribed = true;
  list.replaceChildren(h("li", { class: "gb-empty" }, "불러오는 중…"));
  onSnapshot(
    query(collection(db, "guestbook"), orderBy("createdAt", "desc"), limit(100)),
    (snap) => {
      entries = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
      render();
    },
    (err) => {
      console.error(err);
      list.replaceChildren(h("li", { class: "gb-empty" }, "방명록을 불러오지 못했습니다."));
    }
  );
}

function render() {
  if (!entries.length) {
    list.replaceChildren(h("li", { class: "gb-empty" }, "아직 남겨진 글이 없습니다. 첫 글을 남겨주세요."));
    return;
  }
  list.replaceChildren(...entries.map(renderEntry));
}

// 목록은 column-reverse라 최신 글(배열 앞쪽)이 맨 아래에 붙는다.
// 게스트 글은 왼쪽 말풍선, 주인 답글은 오른쪽 말풍선.
function renderEntry(entry) {
  const item = h(
    "li",
    { class: "gb-item" },
    h(
      "div",
      { class: "gb-row gb-guest" },
      h("strong", { class: "gb-name" }, entry.name),
      h("p", { class: "gb-bubble gb-msg" }, entry.message),
      h(
        "div",
        { class: "gb-meta" },
        h("time", {}, formatDateTime(entry.createdAt?.toDate())),
        isAdmin &&
          h(
            "span",
            { class: "gb-tools" },
            h("button", { type: "button", class: "text-btn", onclick: () => toggleReplyForm(item, entry) }, entry.reply ? "답글 수정" : "답글"),
            h("button", { type: "button", class: "text-btn", onclick: () => removeEntry(entry) }, "삭제")
          )
      )
    ),
    entry.reply && h("div", { class: "gb-row gb-owner" }, h("p", { class: "gb-bubble gb-reply" }, entry.reply))
  );
  return item;
}

function toggleReplyForm(item, entry) {
  const existing = item.querySelector(".gb-reply-form");
  if (existing) return existing.remove();
  const input = h("input", { name: "reply", maxlength: "500", placeholder: "답글", value: entry.reply || "" });
  const replyForm = h(
    "form",
    {
      class: "gb-reply-form",
      onsubmit: async (e) => {
        e.preventDefault();
        const reply = input.value.trim();
        try {
          await updateDoc(doc(db, "guestbook", entry.id), { reply: reply || deleteField() });
        } catch (err) {
          toast("저장 실패: " + errorMessage(err), 4000);
        }
      },
    },
    input,
    h("button", { type: "submit", class: "primary" }, "저장")
  );
  item.append(replyForm);
  input.focus();
}

async function removeEntry(entry) {
  if (!confirm(`${entry.name}님의 글을 삭제할까요?`)) return;
  try {
    await deleteDoc(doc(db, "guestbook", entry.id));
  } catch (err) {
    toast("삭제 실패: " + errorMessage(err), 4000);
  }
}

// 입력한 줄 수만큼 입력창을 늘린다 (최대 높이는 CSS에서 제한)
function autoGrow() {
  form.message.style.height = "auto";
  form.message.style.height = form.message.scrollHeight + 2 + "px";
}

form.message.addEventListener("input", () => {
  count.textContent = `${form.message.value.length} / 500`;
  autoGrow();
});

// Enter = 보내기, Shift+Enter = 줄바꿈 (한글 조합 중 Enter는 무시)
form.message.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = form.name.value.trim() || "익명";
  const message = form.message.value.trim();
  if (!message) return;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await addDoc(collection(db, "guestbook"), { name, message, createdAt: serverTimestamp() });
    try {
      localStorage.setItem(NAME_KEY, form.name.value.trim());
    } catch {}
    form.message.value = "";
    count.textContent = "0 / 500";
    autoGrow();
    list.scrollTop = 0; // column-reverse에서 0 = 맨 아래
    toast("방명록이 등록되었습니다.");
  } catch (err) {
    toast("등록 실패: " + errorMessage(err), 4000);
  } finally {
    submit.disabled = false;
  }
});

onAdminChange((user) => {
  isAdmin = !!user;
  if (subscribed) render();
});
