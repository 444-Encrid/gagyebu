// 지출 확인·수정 화면 (새로 넣기, 고치기, 영수증 여러 장을 한 장씩 확인하기)
import { sb, state, CATEGORIES, PAYMENTS, won, esc, today, toast } from "./supa.js";

const v = (id) => document.getElementById(id);

// opt.batch 가 있으면 영수증 한 장씩 확인 모드: 저장 → batch.saved(), 건너뛰기 → batch.skip(), 뒤로 → batch.cancel()
export async function openForm(main, row, back, opt = {}) {
  const b = opt.batch;
  const me = crypto.randomUUID();   // 늦게 끝난 AI 읽기가 다음 장 화면을 채우지 않게
  main.dataset.form = me;
  const mine = () => main.dataset.form === me && v("st");
  const r = row ?? { spent_on: today(), category: "기타", items: [] };
  const opts = (arr, cur) => arr.map((x) => `<option ${x === cur ? "selected" : ""}>${x}</option>`).join("");
  main.innerHTML = `
    <div class="top"><button id="bk">‹ 뒤로</button><b>${row ? "지출 고치기" : "새 지출"}${b?.label ? ` <span class="sub">${b.label}</span>` : ""}</b><span></span></div>
    <div id="ph"></div>
    <p id="st" class="${opt.reading ? "busy" : "sub"}">${opt.reading ? '<span class="ico">⏳</span> 영수증 읽는 중… (10초 안팎)' : ""}</p>
    <div class="card">
      <div class="row"><div><label>날짜</label><input id="f_date" type="date" value="${esc(r.spent_on)}"></div>
        <div><label>시간</label><input id="f_time" type="time" value="${esc(r.spent_time)}"></div></div>
      <label>가게</label><input id="f_store" value="${esc(r.store)}">
      <label>금액 (원)</label><input id="f_total" inputmode="numeric" value="${r.total ?? ""}">
      <div class="row"><div><label>분류</label><select id="f_cat">${opts(CATEGORIES, r.category)}</select></div>
        <div><label>결제</label><select id="f_pay"><option value=""></option>${opts(PAYMENTS, r.payment)}</select></div></div>
      <label>카드사</label><input id="f_card" value="${esc(r.card_company)}">
      <label>메모</label><input id="f_memo" value="${esc(r.memo)}">
      <div id="items" class="sub" style="margin-top:10px"></div>
    </div>
    <div class="row"><button class="pri" id="sv">저장</button>${row ? '<button class="bad" id="del">지우기</button>' : ""}${b ? '<button id="skip">건너뛰기</button>' : ""}</div>`;

  let items = r.items ?? [];
  let path = r.receipt_path ?? opt.path ?? null;
  const drawItems = () => {
    v("items").innerHTML = items.length
      ? "품목: " + items.map((i) => `${esc(i.name)} ${won(i.amount)}`).join(", ") : "";
  };
  drawItems();

  const showPhoto = (url) => { v("ph").innerHTML = `<img class="photo" src="${url}" alt="영수증">`; };
  if (opt.photoUrl) showPhoto(opt.photoUrl);
  else if (path) {
    const { data } = await sb.storage.from("receipts").createSignedUrl(path, 3600);
    if (data) showPhoto(data.signedUrl);
  }

  if (opt.reading) {
    opt.reading.then((d) => {
      if (!mine()) return; // 이미 다른 화면
      if (!d.is_receipt) { v("st").className = "warn"; v("st").textContent = "영수증이 아닌 것 같습니다. 직접 입력해 주세요."; return; }
      const fill = (id, val) => { if (val != null && val !== "" && !v(id).value) v(id).value = val; };
      if (d.date) v("f_date").value = d.date;
      fill("f_time", d.time); fill("f_store", d.store); fill("f_total", d.total); fill("f_card", d.card_company);
      if (d.category) v("f_cat").value = d.category;
      if (d.payment) v("f_pay").value = d.payment;
      items = d.items ?? [];
      drawItems();
      const unclear = (d.unclear ?? []).join(", ");
      v("st").className = unclear ? "warn" : "sub";
      v("st").innerHTML = unclear
        ? `<span class="ico">⚠️</span> 확인해 주세요: ${esc(unclear)}`
        : '<span class="ico">✅️</span> 다 읽었습니다. 맞는지 보고 저장하세요.';
    }).catch((e) => {
      if (!mine()) return;
      v("st").className = "warn";
      v("st").textContent = e.message.includes("직접 입력") ? e.message : e.message + " 직접 입력해 주세요.";
    });
  }

  v("bk").onclick = b ? b.cancel : back;
  if (b) v("skip").onclick = b.skip;
  v("sv").onclick = async () => {
    const total = parseInt(v("f_total").value.replace(/[^0-9]/g, ""), 10);
    if (!v("f_date").value || Number.isNaN(total)) return toast("날짜와 금액을 넣어 주세요");
    const rec = {
      spent_on: v("f_date").value, spent_time: v("f_time").value || null,
      store: v("f_store").value.trim() || null, total, category: v("f_cat").value,
      payment: v("f_pay").value || null, card_company: v("f_card").value.trim() || null,
      memo: v("f_memo").value.trim() || null, items, receipt_path: path,
    };
    if (!row) {
      const { data: same } = await sb.from("expenses").select("id")
        .eq("spent_on", rec.spent_on).eq("total", rec.total).limit(1);
      if (same?.length && !confirm("같은 날 같은 금액의 지출이 이미 있습니다. 그래도 저장할까요?")) return;
    }
    v("sv").disabled = true;
    const q = row
      ? sb.from("expenses").update(rec).eq("id", row.id)
      : sb.from("expenses").insert({ ...rec, household_id: state.household.id });
    const { error } = await q;
    if (error) { v("sv").disabled = false; return toast("저장 실패: " + error.message); }
    toast("저장했습니다");
    b ? b.saved() : back();
  };
  if (row) v("del").onclick = async () => {
    if (!confirm("이 지출을 지울까요?")) return;
    const { error } = await sb.from("expenses").delete().eq("id", row.id);
    if (error) return toast("지우기 실패");
    if (row.receipt_path) await sb.storage.from("receipts").remove([row.receipt_path]);
    toast("지웠습니다");
    back();
  };
}
