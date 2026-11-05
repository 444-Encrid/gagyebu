// 로그인·가입 화면과 가계부 만들기/들어가기 화면
import { sb, toast } from "./supa.js";

const $ = (s) => document.querySelector(s);

export function showLogin(main) {
  main.innerHTML = `
    <h1><span class="ico">📒</span> 우리 가계부</h1>
    <div class="card">
      <label>이메일</label><input id="em" type="email" autocomplete="email">
      <label>비밀번호 (6자 이상)</label><input id="pw" type="password" autocomplete="current-password">
      <div class="row" style="margin-top:14px">
        <button class="pri" id="login">로그인</button>
        <button id="signup">처음이에요 (가입)</button>
      </div>
    </div>`;
  const creds = () => ({ email: $("#em").value.trim(), password: $("#pw").value });
  $("#login").onclick = async () => {
    const { error } = await sb.auth.signInWithPassword(creds());
    if (error) toast("로그인 실패: 이메일이나 비밀번호를 확인하세요");
  };
  $("#signup").onclick = async () => {
    const c = creds();
    if (!c.email || c.password.length < 6) return toast("이메일과 6자 이상 비밀번호를 넣어 주세요");
    const { data, error } = await sb.auth.signUp(c);
    if (error) return toast("가입 실패: " + (error.message.includes("disabled") ? "새 가입이 막혀 있습니다" : error.message));
    if (!data.session) toast("메일함에서 확인 링크를 눌러 주세요", 5000);
  };
}

export function showSetup(main, onDone) {
  main.innerHTML = `
    <h1>가계부 연결</h1>
    <div class="card">
      <label>내 이름 (가계부에 표시됨)</label><input id="nm" placeholder="예: 해월">
    </div>
    <div class="card">
      <h2>처음 만드는 사람</h2>
      <label>가계부 이름</label><input id="hn" value="우리집 가계부">
      <button class="pri" id="mk" style="margin-top:12px;width:100%">새 가계부 만들기</button>
    </div>
    <div class="card">
      <h2>초대받은 사람</h2>
      <label>초대 코드 (6자리)</label><input id="cd" autocapitalize="characters">
      <button id="jn" style="margin-top:12px;width:100%">가계부에 들어가기</button>
    </div>
    <p class="center"><a href="#" id="out">로그아웃</a></p>`;
  const name = () => $("#nm").value.trim();
  $("#mk").onclick = async () => {
    if (!name()) return toast("내 이름을 넣어 주세요");
    const { error } = await sb.rpc("create_household", { p_name: $("#hn").value.trim() || "우리집 가계부", p_display_name: name() });
    error ? toast(error.message) : onDone();
  };
  $("#jn").onclick = async () => {
    if (!name()) return toast("내 이름을 넣어 주세요");
    const { error } = await sb.rpc("join_household", { p_code: $("#cd").value, p_display_name: name() });
    error ? toast(error.message) : onDone();
  };
  $("#out").onclick = (e) => { e.preventDefault(); sb.auth.signOut(); };
}
