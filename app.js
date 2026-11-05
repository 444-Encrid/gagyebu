// 시작: 로그인 확인 → 가계부 연결 확인 → 메인 화면
import { sb, state, toast } from "./supa.js";
import { showLogin, showSetup } from "./auth.js";
import { showLedger } from "./ledger.js";

const main = document.getElementById("app");

async function route() {
  const { data: { session } } = await sb.auth.getSession();
  state.user = session?.user ?? null;
  if (!state.user) return showLogin(main);

  const { data: me } = await sb.from("members").select("household_id")
    .eq("user_id", state.user.id).maybeSingle();
  if (!me) return showSetup(main, route);

  const [{ data: h }, { data: ms }] = await Promise.all([
    sb.from("households").select("*").eq("id", me.household_id).single(),
    sb.from("members").select("user_id, display_name"),
  ]);
  state.household = h;
  state.members = ms ?? [];
  showLedger(main);
}

let last; // 처음엔 undefined 라서 로그인 안 된 상태(null)에서도 한 번 그린다
sb.auth.onAuthStateChange((event, session) => {
  const uid = session?.user?.id ?? null;
  // 콜백 안에서 바로 Supabase 를 부르면 멈출 수 있어 한 박자 뒤에 부른다
  if (uid !== last) { last = uid; setTimeout(() => route().catch(() => toast("연결에 실패했습니다")), 0); }
});

// 새 버전이 올라오면 새 서비스 워커가 자리를 잡는 순간 한 번 새로고침해서 새 화면을 쓴다
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
    .then((reg) => {
      reg.update();
      // 앱으로 돌아올 때도 새 버전이 있는지 본다
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update();
      });
    });
}
