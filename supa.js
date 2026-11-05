// Supabase 연결과 공통 도우미
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const CATEGORIES = [
  "식비", "카페·간식", "생활용품", "교통", "주유", "의료·약국",
  "쇼핑", "문화·여가", "통신·공과금", "기타",
];
// 지출 한 건을 분류별 금액으로 나눈다. 품목에 분류가 있으면 분류마다 품목 금액을 더하고
// (할인 줄처럼 음수인 품목은 그 분류에서 빠진다), 남는 차이는 비율대로 나눠 합이 정확히 총액이 되게 한다
export function splitByCategory(r) {
  const raw = {};
  for (const i of r.items ?? []) {
    if (typeof i.amount !== "number" || !i.amount) continue;
    const c = i.category || r.category;
    raw[c] = (raw[c] ?? 0) + i.amount;
  }
  const pos = Object.entries(raw).filter(([, v]) => v > 0);
  const base = pos.reduce((a, [, v]) => a + v, 0);
  if (!pos.length || base <= 0) return { [r.category]: r.total };
  const out = {};
  let given = 0, big = null;
  for (const [c, v] of pos) {
    out[c] = Math.floor((v * r.total) / base);
    given += out[c];
    if (big === null || v > raw[big]) big = c;
  }
  out[big] += r.total - given;
  return out;
}

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
