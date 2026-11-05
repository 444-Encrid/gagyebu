// 설정: 초대 코드, 함께 쓰는 사람, 로그아웃
import { sb, state, esc } from "./supa.js";

export function showSettings(main, back) {
  const h = state.household;
  main.innerHTML = `
    <div class="top"><button id="bk">‹ 뒤로</button><b>설정</b><span></span></div>
    <div class="card">
      <div class="sub">가계부</div><h2 style="margin:2px 0">${esc(h.name)}</h2>
      <div class="sub" style="margin-top:10px">초대 코드 (함께 쓸 사람에게 알려 주세요)</div>
      <div class="total">${esc(h.invite_code)}</div>
    </div>
    <div class="card">
      <div class="sub">함께 쓰는 사람</div>
      ${state.members.map((m) => `<div>${esc(m.display_name)}${m.user_id === state.user.id ? " (나)" : ""}</div>`).join("")}
    </div>
    <div class="card sub">로그인: ${esc(state.user.email)}</div>
    <button class="bad" id="out" style="width:100%">로그아웃</button>`;
  main.querySelector("#bk").onclick = back;
  main.querySelector("#out").onclick = () => sb.auth.signOut();
}
