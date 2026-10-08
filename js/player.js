// js/player.js — 음악 플레이어
import { db } from "./firebase.js";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { onAdminChange } from "./auth.js";
import { uploadFile, removeFile } from "./supabase.js";
import { errorMessage, h, pickFiles, toast } from "./utils.js";

const player = document.getElementById("player");
const audio = document.getElementById("plAudio");
const titleEl = document.getElementById("plTitle");
const bar = document.getElementById("plBar");
const progress = document.getElementById("plProgress");
const timeEl = document.getElementById("plTime");
const panel = document.getElementById("plPanel");
const listEl = document.getElementById("plList");
const playBtn = player.querySelector('[data-pl="toggle"]');

let tracks = [];
let currentId = null;
let pendingPlayId = null;
let isAdmin = false;

const currentIndex = () => tracks.findIndex((t) => t.id === currentId);

function formatTime(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function load(track, autoplay = true) {
  currentId = track.id;
  audio.src = track.url;
  titleEl.textContent = track.title;
  titleEl.title = track.title;
  bar.style.width = "0";
  timeEl.textContent = "0:00";
  renderList();
  if (autoplay) {
    audio.play().catch((err) => {
      if (err.name !== "AbortError") console.warn("재생 실패:", err);
    });
  }
}

function playAt(index) {
  if (!tracks.length) return;
  load(tracks[(index + tracks.length) % tracks.length]);
}

function toggle() {
  if (!tracks.length) return toast(isAdmin ? "플레이리스트에서 음악을 추가해주세요." : "재생할 음악이 없습니다.");
  if (currentIndex() === -1) return playAt(0);
  if (audio.paused) audio.play().catch(console.warn);
  else audio.pause();
}

function renderList() {
  if (!tracks.length) {
    listEl.replaceChildren(h("li", { class: "empty" }, "등록된 음악이 없습니다."));
    return;
  }
  listEl.replaceChildren(
    ...tracks.map((track, i) =>
      h(
        "li",
        {
          class: track.id === currentId ? "current" : null,
          onclick: () => playAt(i),
        },
        h("span", { title: track.title }, track.title),
        isAdmin &&
          h(
            "button",
            {
              type: "button",
              class: "del-btn",
              "aria-label": "곡 삭제",
              onclick: (e) => {
                e.stopPropagation();
                removeTrack(track);
              },
            },
            "×"
          )
      )
    )
  );
}

function resetPlayer() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  currentId = null;
  titleEl.textContent = tracks.length ? "재생 버튼을 눌러주세요" : "재생할 음악이 없습니다";
  bar.style.width = "0";
  timeEl.textContent = "0:00";
}

async function removeTrack(track) {
  if (!confirm(`'${track.title}'을(를) 삭제할까요?`)) return;
  try {
    await deleteDoc(doc(db, "tracks", track.id));
    removeFile(track.path);
  } catch (err) {
    toast("삭제 실패: " + errorMessage(err), 4000);
  }
}

async function uploadTracks() {
  const files = await pickFiles("audio/*", true);
  if (!files.length) return;
  let firstId = null;
  for (const [i, file] of files.entries()) {
    try {
      toast(`업로드 중… (${i + 1}/${files.length}) ${file.name}`, 600000);
      const { url, path } = await uploadFile(file, "music");
      const ref = doc(collection(db, "tracks"));
      firstId ??= ref.id;
      if (ref.id === firstId) pendingPlayId = ref.id;
      await setDoc(ref, {
        title: file.name.replace(/\.[^.]+$/, ""),
        url,
        path,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      toast(`'${file.name}' 업로드 실패: ${errorMessage(err)}`, 4000);
      return;
    }
  }
  toast("업로드 완료!");
  playPending();
}

function playPending() {
  if (!pendingPlayId) return;
  const track = tracks.find((t) => t.id === pendingPlayId);
  if (!track) return;
  pendingPlayId = null;
  load(track);
}

// ----- 이벤트 -----
player.addEventListener("click", (e) => {
  const action = e.target.closest("[data-pl]")?.dataset.pl;
  if (action === "toggle") toggle();
  if (action === "prev") playAt(currentIndex() - 1);
  if (action === "next") playAt(currentIndex() + 1);
  if (action === "list") {
    panel.hidden = !panel.hidden;
    volWrap.classList.remove("is-open");
    if (!panel.hidden) renderList();
  }
});

document.addEventListener("click", (e) => {
  // 목록을 다시 그리면 클릭한 요소가 DOM에서 빠지므로 composedPath로 판단
  const path = e.composedPath();
  if (!panel.hidden && !path.includes(player)) panel.hidden = true;
  if (!path.includes(volWrap)) volWrap.classList.remove("is-open");
});

// ----- 볼륨 -----
// 마우스: 스피커에 올리면 슬라이더 표시, 클릭하면 음소거
// 터치: 스피커를 누르면 슬라이더 열기/닫기
// iOS는 페이지에서 볼륨을 바꿀 수 없으므로(기기 버튼만 가능) 음소거만
const VOLUME_KEY = "ccbb-volume";
const volWrap = document.getElementById("plVol");
const volBtn = volWrap.querySelector('[data-pl="volume"]');
const volRange = document.getElementById("plVolume");
const canHover = matchMedia("(hover: hover)");
const volumeWorks = (() => {
  const test = new Audio();
  test.volume = 0.5;
  return test.volume === 0.5;
})();
volWrap.classList.toggle("no-slider", !volumeWorks);

function renderVolume() {
  const silent = audio.muted || audio.volume === 0;
  const level = silent ? 0 : Math.round(audio.volume * 100);
  volRange.value = level;
  volRange.style.setProperty("--p", `${level}%`);
  volWrap.dataset.level = silent ? "mute" : level < 50 ? "low" : "high";
  volBtn.setAttribute("aria-label", silent ? "음소거 해제" : "음소거");
}

function setVolume(level) {
  audio.volume = level / 100;
  audio.muted = level === 0;
}

function toggleMute() {
  if (audio.muted || audio.volume === 0) {
    audio.muted = false;
    if (audio.volume === 0) audio.volume = 0.5; // 0까지 내렸다가 해제하면 절반으로
  } else {
    audio.muted = true;
  }
}

try {
  const saved = JSON.parse(localStorage.getItem(VOLUME_KEY));
  if (saved) {
    if (volumeWorks && Number.isFinite(saved.volume)) audio.volume = Math.min(1, Math.max(0, saved.volume));
    audio.muted = !!saved.muted;
  } else if (volumeWorks) {
    audio.volume = 0.7;
  }
} catch {}
renderVolume();

volBtn.addEventListener("click", () => {
  if (volumeWorks && !canHover.matches) {
    volWrap.classList.toggle("is-open");
    panel.hidden = true;
  } else {
    toggleMute();
  }
});
volRange.addEventListener("input", () => setVolume(Number(volRange.value)));
audio.addEventListener("volumechange", () => {
  renderVolume();
  try {
    localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume: audio.volume, muted: audio.muted }));
  } catch {}
});

document.getElementById("plUpload").addEventListener("click", uploadTracks);

progress.addEventListener("click", (e) => {
  if (!Number.isFinite(audio.duration)) return;
  const rect = progress.getBoundingClientRect();
  audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
});

audio.addEventListener("timeupdate", () => {
  const ratio = audio.duration ? audio.currentTime / audio.duration : 0;
  bar.style.width = `${ratio * 100}%`;
  timeEl.textContent = formatTime(audio.currentTime);
});
audio.addEventListener("play", () => {
  player.classList.add("playing");
  playBtn.setAttribute("aria-label", "일시정지");
});
audio.addEventListener("pause", () => {
  player.classList.remove("playing");
  playBtn.setAttribute("aria-label", "재생");
});
audio.addEventListener("ended", () => playAt(currentIndex() + 1));
audio.addEventListener("error", () => {
  if (!audio.getAttribute("src")) return;
  toast("음악을 재생할 수 없습니다.");
});

// 페이지 이동 시 이어 듣기
// 페이지를 떠날 때 곡·위치·재생 여부를 sessionStorage에 저장했다가, 다음 페이지에서 이어서 재생
// 브라우저가 자동재생을 막으면 페이지를 처음 클릭(또는 키 입력)할 때 이어짐
const STATE_KEY = "ccbb-player";
let restoreState = null;
try {
  restoreState = JSON.parse(sessionStorage.getItem(STATE_KEY));
} catch {}

addEventListener("pagehide", () => {
  try {
    if (!currentId) return sessionStorage.removeItem(STATE_KEY);
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ id: currentId, time: audio.currentTime, playing: !audio.paused }));
  } catch {}
});

function restore() {
  const state = restoreState;
  restoreState = null;
  const track = tracks.find((t) => t.id === state.id);
  if (!track || currentId) return;

  load(track, false);
  audio.addEventListener("loadedmetadata", () => (audio.currentTime = state.time || 0), { once: true });
  if (!state.playing) return;

  audio.play().catch(() => {
    const resume = (e) => {
      document.removeEventListener("pointerdown", resume, true);
      document.removeEventListener("keydown", resume, true);
      if (e.composedPath().includes(player)) return; // 플레이어를 직접 누른 경우는 그 동작에 맡김
      audio.play().catch(() => {});
    };
    document.addEventListener("pointerdown", resume, true);
    document.addEventListener("keydown", resume, true);
  });
}

// 데이터
onSnapshot(
  query(collection(db, "tracks"), orderBy("createdAt")),
  (snap) => {
    tracks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (currentId && currentIndex() === -1) resetPlayer();
    if (!currentId) titleEl.textContent = tracks.length ? "재생 버튼을 눌러주세요" : "재생할 음악이 없습니다";
    renderList();
    if (restoreState) restore();
    playPending();
  },
  (err) => console.error("플레이리스트 불러오기 실패:", err)
);

onAdminChange((user) => {
  isAdmin = !!user;
  renderList();
});
