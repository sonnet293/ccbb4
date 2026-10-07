// js/supabase.js
// Supabase는 Storage(파일 저장)만 사용합니다.
// 로그인은 Firebase가 담당하고, Firebase ID 토큰을 그대로 Supabase에 넘겨서
// Storage 정책(supabase/setup.sql)에서 관리자 여부를 확인합니다.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { auth } from "./firebase.js";

// Supabase 대시보드 → Project Settings → API 에서 복사해서 넣으세요.
const SUPABASE_URL = "https://miitbgkznojflqjwenfz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1paXRiZ2t6bm9qZmxxandlbmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDgxNTAsImV4cCI6MjEwNjkyNDE1MH0.EttufSJcSG3hRY8AHleed6FEVUNGf4YO-SqdCCXpOOU";

export const BUCKET = "ccbb";

export const supabaseReady = !SUPABASE_URL.includes("YOUR-") && !SUPABASE_ANON_KEY.includes("YOUR-");

export const supabase = supabaseReady
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      accessToken: async () => (await auth.currentUser?.getIdToken()) ?? null,
    })
  : null;

function assertReady() {
  if (!supabaseReady) throw new Error("js/supabase.js에 Supabase URL과 키를 먼저 입력해주세요.");
}

// 파일을 업로드하고 { path, url }을 돌려줍니다. 파일명은 한글 등 문제를 피하려고 새로 생성합니다.
export async function uploadFile(file, folder) {
  assertReady();
  const ext = file.name.includes(".") ? "." + file.name.split(".").pop().toLowerCase() : "";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export async function removeFile(path) {
  if (!path || !supabaseReady) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn("Supabase 파일 삭제 실패:", error);
}