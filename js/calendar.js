// js/calendar.js — 달력 + 일정 (Firestore: events)
import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { onAdminChange } from "./auth.js";
import { bindDialog, errorMessage, h, pad, toast } from "./utils.js";

const root = document.getElementById("calendar");
const dayModal = bindDialog(document.getElementById("dayModal"));
const dayTitle = document.getElementById("dayTitle");
const eventList = document.getElementById("eventList");
const eventForm = document.getElementById("eventForm");

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const WEEK_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const view = new Date();
view.setDate(1);

let events = [];
let isAdmin = false;
let selectedDate = null;

const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const eventsOn = (key) => events.filter((e) => e.date === key);

function render() {
  const year = view.getFullYear();
  const month = view.getMonth();
  const todayKey = toKey(new Date());
  const start = new Date(year, month, 1 - new Date(year, month, 1).getDay());

  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = toKey(d);
    const list = eventsOn(key);
    const classes = ["cal-day"];
    if (d.getMonth() !== month) classes.push("other");
    if (d.getDay() === 0) classes.push("sun");
    if (d.getDay() === 6) classes.push("sat");
    if (key === todayKey) classes.push("today");
    days.push(
      h(
        "button",
        {
          type: "button",
          class: classes.join(" "),
          title: list.map((e) => e.title).join("\n") || null,
          "aria-label": `${d.getMonth() + 1}월 ${d.getDate()}일${list.length ? `, 일정 ${list.length}개` : ""}`,
          onclick: () => openDay(key),
        },
        h("span", { class: "num" }, d.getDate()),
        h("span", { class: "cal-dots" }, list.slice(0, 3).map(() => h("i")))
      )
    );
  }

  root.replaceChildren(
    h(
      "div",
      { class: "cal-head" },
      h(
        "div",
        { class: "cal-month", title: `${year}년 ${month + 1}월` },
        h("strong", {}, month + 1),
        h("span", {}, MONTHS[month])
      ),
      h(
        "div",
        { class: "cal-navs" },
        h("button", { type: "button", class: "cal-nav", "aria-label": "이전 달", onclick: () => move(-1) }, "‹"),
        h("button", { type: "button", class: "cal-nav", "aria-label": "다음 달", onclick: () => move(1) }, "›")
      )
    ),
    h("div", { class: "cal-week" }, WEEK_EN.map((w) => h("span", {}, w))),
    h("div", { class: "cal-days" }, days)
  );
}

function move(delta) {
  view.setMonth(view.getMonth() + delta);
  render();
}

function openDay(key) {
  selectedDate = key;
  const [y, m, d] = key.split("-").map(Number);
  dayTitle.textContent = `${y}년 ${m}월 ${d}일 (${WEEK[new Date(y, m - 1, d).getDay()]})`;
  renderDay();
  dayModal.showModal();
}

function renderDay() {
  if (!selectedDate) return;
  const list = eventsOn(selectedDate);
  if (!list.length) {
    eventList.replaceChildren(h("li", { class: "event-empty" }, "등록된 일정이 없습니다."));
    return;
  }
  eventList.replaceChildren(
    ...list.map((ev) =>
      h(
        "li",
        {},
        h("span", {}, ev.title),
        isAdmin &&
          h("button", { type: "button", class: "del-btn", "aria-label": "일정 삭제", onclick: () => removeEvent(ev) }, "×")
      )
    )
  );
}

async function removeEvent(ev) {
  if (!confirm(`'${ev.title}' 일정을 삭제할까요?`)) return;
  try {
    await deleteDoc(doc(db, "events", ev.id));
  } catch (err) {
    toast("삭제 실패: " + errorMessage(err), 4000);
  }
}

eventForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = eventForm.elements.title.value.trim();
  if (!title || !selectedDate) return;
  try {
    await addDoc(collection(db, "events"), { date: selectedDate, title, createdAt: serverTimestamp() });
    eventForm.reset();
  } catch (err) {
    toast("추가 실패: " + errorMessage(err), 4000);
  }
});

onSnapshot(
  query(collection(db, "events"), orderBy("date")),
  (snap) => {
    events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
    renderDay();
  },
  (err) => console.error("일정 불러오기 실패:", err)
);

onAdminChange((user) => {
  isAdmin = !!user;
  renderDay();
});

render();
