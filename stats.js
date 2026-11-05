// 통계: 예산, 월별 추이, 분류별 비중, 달력, 요일
import { sb, state, won, esc, toast, CATEGORIES, splitByCategory } from "./supa.js";

const KST = 9 * 3600e3;
const ymOf = (d) => d.toISOString().slice(0, 7);
const addMonth = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  return ymOf(new Date(Date.UTC(y, m - 1 + n, 1)));
};
const label = (ym) => `${+ym.slice(5)}월`;
const short = (n) => n >= 1e8 ? (n / 1e8).toFixed(1) + "억" : n >= 1e4 ? Math.round(n / 1e4).toLocaleString("ko-KR") + "만" : n.toLocaleString("ko-KR");
// 달력 색: 값이 클수록 밝은 파랑 (어두운 화면용 한 가지 색 단계)
const RAMP = ["#104281", "#184f95", "#1c5cab", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#6da7ec"];

let ym = ymOf(new Date(Date.now() + KST));

function delta(now, before) {
  if (!before) return "";
  const d = now - before, p = Math.round((d / before) * 100);
  if (d === 0) return '<span class="sub">지난달과 같음</span>';
  return `<span class="${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${won(Math.abs(d))} (${Math.abs(p)}%)</span>`;
}

function status(used, budget) {
  const r = used / budget;
  if (r > 1) return { cls: "crit", ico: "🚨", txt: `${won(used - budget)} 넘음` };
  if (r >= 0.8) return { cls: "warn2", ico: "⚠️", txt: `${won(budget - used)} 남음` };
  return { cls: "good", ico: "✅️", txt: `${won(budget - used)} 남음` };
}

function budgetHtml(budgets, monthTotal, byCat) {
  const total = budgets["전체"];
  const cats = CATEGORIES.filter((c) => budgets[c]);
  if (!total && !cats.length) {
    return `<div class="card"><div class="top"><b>예산</b><button id="bud">예산 정하기</button></div>
      <p class="sub">한 달 예산을 정하면 얼마나 썼는지, 얼마 남았는지 보여 드립니다.</p></div>`;
  }
  const bar = (used, b, name) => {
    const s = status(used, b), pct = Math.min(100, (used / b) * 100);
    return `<div class="bud"><div class="top"><span>${esc(name)}</span>
        <span class="sub">${won(used)} / ${won(b)}</span></div>
      <div class="meter"><i class="${s.cls}" style="width:${pct}%"></i></div>
      <div class="bud-s"><span class="ico">${s.ico}</span> ${s.txt} · ${Math.round((used / b) * 100)}%</div></div>`;
  };
  return `<div class="card"><div class="top"><b>예산</b><button id="bud">예산 고치기</button></div>
    ${total ? bar(monthTotal, total, "한 달 전체") : ""}
    ${cats.map((c) => bar(byCat[c] ?? 0, budgets[c], c)).join("")}</div>`;
}

function trendHtml(months, sums, cut) {
  const max = Math.max(...sums, 1);
  const cols = months.map((m, i) => {
    const h = Math.max(2, Math.round((sums[i] / max) * 120));
    const cur = m === ym;
    return `<div class="col${cur ? " cur" : ""}" data-tip="${label(m)} ${won(sums[i])}">
      <span class="v">${cur || sums[i] === max ? short(sums[i]) : ""}</span>
      <i style="height:${h}px"></i><span class="x">${label(m)}</span></div>`;
  }).join("");
  const n = months.length - 1;
  return `<div class="card"><b>월별 추이</b> <span class="sub">최근 ${months.length}개월</span>
    <p class="sub" style="margin:4px 0 8px">${cut < 31 ? `${label(months[n])}은 아직 ${cut}일까지입니다` : `${label(months[n])} ${won(sums[n])} ${delta(sums[n], sums[n - 1])}`}</p>
    <div class="cols">${cols}</div><p class="tip sub" id="tipTrend">막대를 누르면 금액이 보입니다</p></div>`;
}

function catHtml(byCat, prevCat, monthTotal, cut) {
  const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return `<div class="card"><b>분류별</b><p class="sub">이 달의 지출이 없습니다</p></div>`;
  const max = rows[0][1];
  return `<div class="card"><b>분류별</b> <span class="sub">${cut < 31 ? `지난달 1~${cut}일 대비` : "지난달 대비"}</span>
    ${rows.map(([c, v]) => `<div class="hb"><div class="top"><span>${esc(c)}</span>
      <span>${won(v)} <span class="sub">${Math.round((v / monthTotal) * 100)}%</span></span></div>
      <div class="hbar"><i style="width:${(v / max) * 100}%"></i></div>
      <div class="sub" style="font-size:13px">${prevCat[c] ? delta(v, prevCat[c]) : "지난달 같은 기간엔 없음"}</div></div>`).join("")}</div>`;
}

function calHtml(byDay) {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const vals = Object.values(byDay);
  const max = Math.max(...vals, 1);
  let cells = "일월화수목금토".split("").map((d) => `<div class="cw">${d}</div>`).join("");
  for (let i = 0; i < first; i++) cells += "<div></div>";
  for (let d = 1; d <= days; d++) {
    const v = byDay[d] ?? 0;
    const bg = v ? RAMP[Math.min(RAMP.length - 1, Math.floor((v / max) * RAMP.length))] : "transparent";
    cells += `<div class="cd${v ? " has" : ""}" style="background:${bg}" data-tip="${m}월 ${d}일 ${v ? won(v) : "지출 없음"}">${d}</div>`;
  }
  const spentDays = vals.filter((v) => v > 0).length;
  return `<div class="card"><b>달력</b> <span class="sub">${spentDays}일 동안 썼어요 · 진할수록 적게, 밝을수록 많이</span>
    <div class="cal">${cells}</div><p class="tip sub" id="tipCal">날짜를 누르면 금액이 보입니다</p></div>`;
}

function weekHtml(byWd) {
  const max = Math.max(...byWd, 1);
  const top = byWd.indexOf(Math.max(...byWd));
  return `<div class="card"><b>요일별</b> <span class="sub">${byWd[top] ? `${"일월화수목금토"[top]}요일에 가장 많이 썼어요` : ""}</span>
    ${byWd.map((v, i) => `<div class="wd"><span>${"일월화수목금토"[i]}</span>
      <div class="hbar"><i style="width:${(v / max) * 100}%"></i></div><span class="num">${short(v)}</span></div>`).join("")}</div>`;
}

export async function showStats(main, back) {
  const from = addMonth(ym, -5);
  const to = addMonth(ym, 1);
  const [{ data: rows, error }, { data: bud }] = await Promise.all([
    sb.from("expenses").select("spent_on,total,category,items").gte("spent_on", `${from}-01`).lt("spent_on", `${to}-01`),
    sb.from("budgets").select("category,amount"),
  ]);
  if (error) return toast("불러오기 실패");
  const budgets = Object.fromEntries((bud ?? []).map((b) => [b.category, b.amount]));

  const months = Array.from({ length: 6 }, (_, i) => addMonth(from, i));
  const sums = months.map(() => 0);
  const byCat = {}, prevCat = {}, byDay = {}, byWd = [0, 0, 0, 0, 0, 0, 0];
  const prev = addMonth(ym, -1);
  // 이번 달을 보는 중이면 지난달도 "오늘 날짜까지"만 비교한다 (5일까지 쓴 돈 vs 지난달 한 달 전체는 불공평)
  const todayYm = ymOf(new Date(Date.now() + KST));
  const cut = ym === todayYm ? new Date(Date.now() + KST).getUTCDate() : 31;
  let prevSame = 0;
  for (const r of rows) {
    const m = r.spent_on.slice(0, 7);
    const i = months.indexOf(m);
    if (i >= 0) sums[i] += r.total;
    if (m === ym) {
      for (const [c, v] of Object.entries(splitByCategory(r))) byCat[c] = (byCat[c] ?? 0) + v;
      const d = +r.spent_on.slice(8);
      byDay[d] = (byDay[d] ?? 0) + r.total;
      byWd[new Date(r.spent_on + "T00:00:00Z").getUTCDay()] += r.total;
    } else if (m === prev && +r.spent_on.slice(8) <= cut) {
      for (const [c, v] of Object.entries(splitByCategory(r))) prevCat[c] = (prevCat[c] ?? 0) + v;
      prevSame += r.total;
    }
  }
  const monthTotal = sums[5];

  main.innerHTML = `
    <div class="top">
      <button id="bk">‹ 목록</button>
      <div class="month"><button id="pv">‹</button><b>${+ym.slice(0, 4)}년 ${+ym.slice(5)}월</b><button id="nx">›</button></div>
      <span style="width:64px"></span>
    </div>
    <div class="card"><div class="sub">이 달 쓴 돈</div><div class="total">${won(monthTotal)}</div>
      <div class="sub">${cut < 31 ? `지난달 1~${cut}일 대비 ` : "지난달 대비 "}${delta(monthTotal, prevSame) || "기록 없음"}</div></div>
    ${budgetHtml(budgets, monthTotal, byCat)}
    ${trendHtml(months, sums, cut)}
    ${catHtml(byCat, prevCat, monthTotal, cut)}
    ${calHtml(byDay)}
    ${weekHtml(byWd)}`;

  const again = () => showStats(main, back);
  main.querySelector("#bk").onclick = back;
  main.querySelector("#pv").onclick = () => { ym = addMonth(ym, -1); again(); };
  main.querySelector("#nx").onclick = () => { ym = addMonth(ym, 1); again(); };
  main.querySelector("#bud").onclick = () => showBudget(main, budgets, again);
  // 누르면 금액 보이기 (휴대폰은 마우스 올리기가 없으므로 누르기)
  const tap = (sel, tipId) => main.querySelectorAll(sel).forEach((el) => {
    el.onclick = () => {
      main.querySelectorAll(sel).forEach((x) => x.classList.remove("on"));
      el.classList.add("on");
      main.querySelector("#" + tipId).textContent = el.dataset.tip;
    };
  });
  tap(".col", "tipTrend");
  tap(".cd", "tipCal");
}

function showBudget(main, budgets, back) {
  const field = (c, name) => `<div class="row" style="align-items:center"><span style="flex:0 0 40%">${esc(name)}</span>
    <input data-c="${esc(c)}" inputmode="numeric" placeholder="없음" value="${budgets[c] ?? ""}"></div>`;
  main.innerHTML = `
    <div class="top"><button id="bk">‹ 뒤로</button><b>예산 정하기</b><span style="width:64px"></span></div>
    <div class="card"><p class="sub" style="margin-top:0">매달 같은 예산을 씁니다. 비워 두면 그 분류는 예산 없음. 단위: 원</p>
      ${field("전체", "한 달 전체")}
      <h2>분류별 (필요한 것만)</h2>
      ${CATEGORIES.map((c) => field(c, c)).join("")}
    </div>
    <button class="pri" id="sv" style="width:100%">저장</button>`;
  main.querySelector("#bk").onclick = back;
  main.querySelector("#sv").onclick = async () => {
    const up = [], del = [];
    main.querySelectorAll("input[data-c]").forEach((i) => {
      const n = parseInt(i.value.replace(/[^0-9]/g, ""), 10);
      if (n > 0) up.push({ household_id: state.household.id, category: i.dataset.c, amount: n });
      else del.push(i.dataset.c);
    });
    const r1 = up.length ? await sb.from("budgets").upsert(up) : { error: null };
    const r2 = del.length ? await sb.from("budgets").delete().in("category", del) : { error: null };
    if (r1.error || r2.error) return toast("저장 실패: " + (r1.error || r2.error).message);
    toast("예산을 저장했습니다");
    back();
  };
}
