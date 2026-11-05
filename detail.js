// 지출 자세히 보기: 항목을 누르면 먼저 이 화면, 원하면 [수정]
import { sb, state, won, esc } from "./supa.js";
import { openForm } from "./form.js";

const nameOf = (uid) => state.members.find((m) => m.user_id === uid)?.display_name ?? "?";

function when(r) {
  const [y, m, d] = r.spent_on.split("-").map(Number);
  const wd = "일월화수목금토"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}년 ${m}월 ${d}일 (${wd})${r.spent_time ? " " + r.spent_time : ""}`;
}

function row(label, value) {
  return value ? `<div class="kv"><span>${label}</span><b>${value}</b></div>` : "";
}

// r: 지출 한 줄, back: 목록으로
export async function showDetail(main, r, back) {
  const items = r.items ?? [];
  const sum = items.reduce((a, i) => a + (i.amount ?? 0), 0);
  const itemRows = items.map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${i.qty ?? ""}</td>
    <td class="num">${won(i.amount)}</td></tr>`).join("");
  const sumNote = items.length && sum !== r.total
    ? `<p class="warn"><span class="ico">⚠️</span> 품목 합 ${won(sum)} ≠ 금액 ${won(r.total)} (할인·봉투값 등일 수 있음)</p>` : "";
  const created = new Date(r.created_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });

  main.innerHTML = `
    <div class="top"><button id="bk">‹ 목록</button><b>지출 내용</b><button class="pri" id="ed">수정</button></div>
    <div class="card">
      <div class="sub">${esc(r.store || r.category)}</div>
      <div class="total">${won(r.total)}</div>
      <div class="sub">${when(r)}</div>
    </div>
    <div class="card">
      ${row("분류", esc(r.category))}
      ${row("결제", esc([r.payment, r.card_company].filter(Boolean).join(" · ")))}
      ${row("넣은 사람", esc(nameOf(r.created_by)))}
      ${row("메모", esc(r.memo))}
    </div>
    ${items.length ? `<div class="card"><div class="sub">품목 ${items.length}개</div>
      <table class="items"><tr><th>이름</th><th class="num">수량</th><th class="num">금액</th></tr>${itemRows}</table>${sumNote}</div>` : ""}
    <div id="ph"></div>
    <p class="sub center">등록 ${esc(created)}</p>`;

  main.querySelector("#bk").onclick = back;
  // 수정을 마치거나 취소하면 이 화면으로 돌아온다 (지웠으면 목록으로)
  main.querySelector("#ed").onclick = () => openForm(main, r, async () => {
    const { data } = await sb.from("expenses").select("*").eq("id", r.id).maybeSingle();
    data ? showDetail(main, data, back) : back();
  });

  if (r.receipt_path) {
    const { data, error } = await sb.storage.from("receipts").createSignedUrl(r.receipt_path, 3600);
    const ph = main.querySelector("#ph");
    if (!ph) return; // 이미 다른 화면
    if (error || !data) { ph.innerHTML = '<p class="sub center">영수증 사진을 불러오지 못했습니다</p>'; return; }
    ph.innerHTML = `<div class="card"><div class="sub">영수증 사진 (누르면 크게)</div>
      <a href="${data.signedUrl}" target="_blank" rel="noopener"><img class="photo" src="${data.signedUrl}" alt="영수증"></a></div>`;
  }
}
