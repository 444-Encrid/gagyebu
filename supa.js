// Supabase 연결과 공통 도우미
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const CATEGORIES = [
  "식비", "카페·간식", "마트·생활용품", "교통", "주유", "의료·약국",
  "쇼핑", "문화·여가", "통신·공과금", "기타",
];
export const PAYMENTS = ["카드", "현금", "간편결제", "기타"];

export const won = (n) => (n ?? 0).toLocaleString("ko-KR") + "원";
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

export function toast(msg, ms = 2500) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}

// 화면 상태 (로그인 사용자, 내 집, 집 사람들)
export const state = { user: null, household: null, members: [] };
