// 메인 화면: 달 선택, 합계, 사람별·분류별 합, 지출 목록
import { sb, state, won, esc, toast } from "./supa.js";
import { openForm } from "./form.js";
import { chooseSource } from "./receipts.js";
import { showSettings } from "./settings.js";
import { showDetail } from "./detail.js";
import { showStats } from "./stats.js";

let ym = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7); // YYYY-MM (한국 시간)
let channel = null;

function shift(n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  ym = d.toISOString().slice(0, 7);
}

function nameOf(uid) {
  return state.members.find((m) => m.user_id === uid)?.display_name ?? "?";
}

export async function showLedger(main) {
  const [y, m] = ym.split("-");
  const next = new Date(Date.UTC(+y, +m, 1)).toISOString().slice(0, 10);
  const { data: rows, error } = await sb.from("expenses").select("*")
    .gte("spent_on", `${ym}-01`).lt("spent_on", next)
    .order("spent_on", { ascending: false }).order("created_at", { ascending: false });
  if (error) { toast("불러오기 실패"); return; }

  const sum = rows.reduce((a, r) => a + r.total, 0);
  const byWho = {}, byCat = {};
  for (const r of rows) {
    byWho[r.created_by] = (byWho[r.created_by] ?? 0) + r.total;
    byCat[r.category] = (byCat[r.category] ?? 0) + r.total;
  }
  let list = "", day = "";
  for (const r of rows) {
    if (r.spent_on !== day) {
      day = r.spent_on;
      list += `<div class="day">${day.slice(5).replace("-", "월 ")}일</div>`;
    }
    list += `<div class="item" data-id="${r.id}">
      <div><div>${esc(r.store || r.category)}${r.receipt_path ? ' <span class="ico">🧾</span>' : ""}</div>
      <div class="meta">${esc(r.category)} · ${esc(nameOf(r.created_by))}${r.payment ? " · " + esc(r.payment) : ""}</div></div>
      <div class="amt">${won(r.total)}</div></div>`;
  }
  main.innerHTML = `
    <div class="top">
      <div class="month"><button id="pv">‹</button><b>${+y}년 ${+m}월</b><button id="nx">›</button></div>
      <div class="row" style="flex:0 0 auto"><button id="stats" aria-label="통계"><span class="ico">📊</span> 통계</button>
      <button id="set" aria-label="설정"><span class="ico">⚙️</span></button></div>
    </div>
    <div class="card">
      <div class="sub">이번 달 쓴 돈</div>
      <div class="total">${won(sum)}</div>
      <div class="who sub">${Object.entries(byWho).map(([u, v]) => `${esc(nameOf(u))} ${won(v)}`).join(" · ") || "아직 없음"}</div>
      <div class="cats" style="margin-top:8px">${Object.entries(byCat).sort((a, b) => b[1] - a[1])
        .map(([c, v]) => `<span class="chip">${esc(c)} ${won(v)}</span>`).join("")}</div>
    </div>
    <div class="card list">${list || '<p class="sub center">이 달의 지출이 없습니다</p>'}</div>
    <div class="fab">
      <button class="pri" id="rc"><span class="ico">🧾</span> 영수증</button>
      <button id="man"><span class="ico">✏️</span> 직접 입력</button>
    </div>`;

  const again = () => showLedger(main);
  main.querySelector("#pv").onclick = () => { shift(-1); again(); };
  main.querySelector("#nx").onclick = () => { shift(1); again(); };
  main.querySelector("#set").onclick = () => showSettings(main, again);
  main.querySelector("#stats").onclick = () => showStats(main, again);
  main.querySelector("#rc").onclick = () => chooseSource(main, again);
  main.querySelector("#man").onclick = () => openForm(main, null, again);
  main.querySelectorAll(".item").forEach((el) => {
    el.onclick = () => showDetail(main, rows.find((r) => r.id === el.dataset.id), again);
  });

  // 다른 사람이 넣거나 고치면 바로 다시 그린다
  if (!channel) {
    // 로그인 직후엔 실시간 연결이 아직 로그인 정보를 모를 수 있어 먼저 넘겨 준다 (안 하면 RLS 에 막혀 알림이 안 옴)
    const { data: { session } } = await sb.auth.getSession();
    if (session) sb.realtime.setAuth(session.access_token);
    // 앱으로 돌아올 때도 새로 불러온다 (실시간 연결이 끊겼을 때 대비)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && document.querySelector(".fab")) {
        showLedger(document.getElementById("app"));
      }
    });
    channel = sb.channel("expenses")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => {
        if (document.querySelector(".fab")) showLedger(document.getElementById("app"));
      }).subscribe();
  }
}
