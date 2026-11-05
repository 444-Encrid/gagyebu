// [영수증] 버튼: 찍기 / 갤러리(여러 장) 고르기 → 미리 올리고 AI 로 읽기 → 한 장씩 확인·저장
import { sb, state, toast } from "./supa.js";
import { openForm } from "./form.js";

const MAX_EDGE = 1568;
const MAX_FILES = 20;   // 한 번에 고를 수 있는 장수
const PARALLEL = 3;     // 동시에 읽는 장수

async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.85));
}

async function uploadAndRead(blob, path) {
  const up = await sb.storage.from("receipts").upload(path, blob, { contentType: "image/jpeg" });
  if (up.error) throw new Error("사진 올리기 실패");
  const { data, error } = await sb.functions.invoke("read-receipt", { body: { path } });
  if (error) {
    let msg = "AI 읽기 실패";
    try { msg = (await error.context.json()).error || msg; } catch { /* 기본 문구 */ }
    throw new Error(msg);
  }
  return data.data;
}

// 동시에 PARALLEL 장까지만 돌리는 줄
function limiter(n) {
  let running = 0;
  const waiting = [];
  const next = () => {
    if (running >= n || !waiting.length) return;
    running++;
    const { job, ok, fail } = waiting.shift();
    job().then(ok, fail).finally(() => { running--; next(); });
  };
  return (job) => new Promise((ok, fail) => { waiting.push({ job, ok, fail }); next(); });
}

// 찍기 / 갤러리 고르는 아래 판
export function chooseSource(main, back) {
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="sheet-box">
      <button class="pri" data-k="cam"><span class="ico">📷</span> 찍기</button>
      <button data-k="gal"><span class="ico">🖼️</span> 갤러리에서 고르기 (여러 장 가능)</button>
      <button data-k="x">취소</button></div>`;
  const close = () => sheet.remove();
  sheet.onclick = (e) => {
    const k = e.target.closest("button")?.dataset.k;
    if (e.target === sheet || k === "x") return close();
    if (!k) return;
    close();
    pick(main, back, k === "cam");
  };
  document.body.appendChild(sheet);
}

function pick(main, back, camera) {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  if (camera) inp.capture = "environment";
  else inp.multiple = true;
  inp.onchange = () => {
    let files = [...(inp.files ?? [])];
    if (!files.length) return;
    if (files.length > MAX_FILES) {
      toast(`한 번에 ${MAX_FILES}장까지입니다. 앞의 ${MAX_FILES}장만 넣습니다.`, 4000);
      files = files.slice(0, MAX_FILES);
    }
    runQueue(main, back, files);
  };
  inp.click();
}

function runQueue(main, back, files) {
  const lim = limiter(PARALLEL);
  const jobs = files.map((file) => {
    const path = `${state.household.id}/${crypto.randomUUID()}.jpg`;
    const blob = shrink(file);                       // 사진 줄이기 (빠름)
    const uploaded = { done: false };
    const reading = blob.then((b) => lim(async () => {
      try { return await uploadAndRead(b, path); } finally { uploaded.done = true; }
    }));
    reading.catch(() => {});                         // 처리 안 된 오류 경고 막기 (화면에서 보여 줌)
    return { blob, path, reading, uploaded, saved: false };
  });

  // 저장 안 한 사진은 서버에서도 지운다 (올리기가 끝난 뒤에)
  const discard = async (j) => {
    if (j.saved) return;
    await j.reading.catch(() => {});
    if (j.uploaded.done) await sb.storage.from("receipts").remove([j.path]);
  };

  let saved = 0;
  const finish = () => {
    if (files.length > 1) toast(`${files.length}장 중 ${saved}장 저장했습니다`, 3000);
    back();
  };

  const show = async (i) => {
    if (i >= jobs.length) return finish();
    const j = jobs[i];
    let url;
    try { url = URL.createObjectURL(await j.blob); }
    catch {
      toast(`${i + 1}번째 사진은 열 수 없습니다 (HEIC 같은 형식이면 JPG 로 바꿔 주세요)`, 4000);
      return show(i + 1);
    }
    openForm(main, null, null, {
      photoUrl: url, path: j.path, reading: j.reading,
      batch: {
        label: jobs.length > 1 ? `${i + 1} / ${jobs.length}` : "",
        saved: () => { j.saved = true; saved++; show(i + 1); },
        skip: () => { discard(j); show(i + 1); },
        cancel: () => {
          const left = jobs.length - i;
          if (left > 1 && !confirm(`남은 ${left}장을 모두 취소할까요?`)) return;
          jobs.slice(i).forEach(discard);
          finish();
        },
      },
    });
  };
  show(0);
}
