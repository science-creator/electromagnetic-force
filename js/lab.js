/* =========================================================
   lab.js — 전자기력 실험실
   ---------------------------------------------------------
   계산은 emforce.js 가 하고, 이 파일은 그것을 '보이게' 만든다.

   화면의 핵심 장치 세 가지
     ① **⊙ / ⊗ 기호가 전류의 방향**이다. 직선 도선 장면과 힘 장면, 전동기 장면이
        모두 같은 기호를 써서 "도선 주위의 자기장"과 "도선이 받는 힘"이 한 도선의 이야기임을 잇는다.
     ② **힘의 화살표 길이는 (전류 × 자석 수)에 정비례**한다. 화살표는 눈금(px/칸)이 하나뿐이다.
     ③ 전동기 : 코일의 두 변(AB · CD)이 **반대 방향의 힘**을 받고, 정류자가 반 바퀴마다 전류를 끊는다.

   ⚠ **그려진 것이 곧 값이다.** 나침반 바늘의 방향, 고리의 굵기, 화살표 길이는 엔진의 값에서 나온다.
   ⚠ 애니메이션은 전동기 장면의 ▶ 중에만 돈다.
   ========================================================= */
(function () {
  "use strict";

  var E = window.EmForce;

  var S = {
    scene: "field", mode: "wire",
    cur: 0,                       // 전류 슬라이더 (자기장 장면)
    Isign: 1, Bsign: 1,           // +1 : ⊙ 나오는 · N극 왼쪽
    sw: 0, R: 3, n: 1,            // 힘·전동기 장면
    theta: 0.35, playing: false,
    mission: null, predictPick: null, missionState: "ready"
  };

  var canvas, ctx, cssW = 900, cssH = 556;
  var records = [];
  var seen;
  var raf = 0, lastFrame = 0;
  var PX_PER_KAN = 6;             // 힘의 화살표 : 1칸 = 6 px  (⚠ 눈금은 이것 하나뿐)

  var COL = {
    ink: "#e2e8f0", faint: "#64748b", line: "#94a3b8", cur: "#fbbf24", force: "#f87171",
    field: "#60a5fa", N: "#ef4444", S: "#3b82f6", ok: "#4ade80"
  };

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return E.clamp(v, a, b); }
  function f1(v) { return String(Math.round(v * 10) / 10); }
  function f2(v) { return String(Math.round(v * 100) / 100); }

  function resetSeen() {
    seen = { curOn: false, signs: {}, poles: {}, forceOn: false, dirs: {}, bothFlip: false,
             big: false, ccw: 0, cw: 0 };
  }
  resetSeen();

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* ---------------------------------------------------------
     1. 지금 상태
     --------------------------------------------------------- */
  function sceneKind() {
    if (S.scene === "mission") return S.mission ? S.mission.scene : "field";
    return S.scene;
  }

  function currentNow() {
    if (sceneKind() === "field") return S.cur;
    return E.currentA(S.R, !!S.sw);
  }

  /* ---------------------------------------------------------
     2. 미션
        ⚠ 시작 상태에서 목표가 모두 false 여야 한다.
     --------------------------------------------------------- */
  var MISSIONS = [
    {
      id: 1, star: "🧭", title: "나침반이 돈다",
      story: "도선 둘레에 나침반을 놓았다. 지금은 전류가 <b>0</b> 이라 바늘이 모두 같은 쪽(북쪽)을 가리킨다. " +
             "전류를 <b>흘려</b> 보자.",
      scene: "field", setup: { mode: "wire", cur: 0, Isign: 1 }, allow: ["cur", "isign"],
      predict: { q: "도선에 전류를 흘리면 둘레의 나침반 바늘은?",
                 opts: ["움직이지 않는다", "<b>도선을 둘러싸는 방향으로 돈다</b>", "모두 도선 쪽을 가리킨다"], ans: 1 },
      goals: [{ key: "curOn", text: "전류를 <b>0 보다 크게</b> 하고 바늘 관찰하기" }],
      why: "<b>도선을 둘러싸는 방향으로 돕니다.</b><br>" +
           "도선에 전류가 흐르면 <b>자기장이 생겨</b> 자석과 같은 성질을 나타내기 때문이에요. " +
           "나침반 바늘의 N극이 가리키는 방향이 곧 자기장의 방향입니다."
    },
    {
      id: 2, star: "🔄", title: "방향을 뒤집으면",
      story: "이번엔 전류의 <b>방향</b>을 바꿔 보자. ⊙(나오는 방향)과 ⊗(들어가는 방향) <b>둘 다</b> 확인해 보자.",
      scene: "field", setup: { mode: "wire", cur: 3, Isign: 1 }, allow: ["cur", "isign"],
      predict: { q: "전류 방향을 반대로 하면 자기장의 방향은?",
                 opts: ["그대로다", "<b>반대가 된다</b>", "사라진다"], ans: 1 },
      goals: [{ key: "signs", text: "<b>⊙ 와 ⊗ 두 방향</b>을 모두 관찰하기 (전류가 흐르는 채로)" }],
      why: "<b>반대가 됩니다.</b><br>" +
           "· ⊙ (나오는 전류) → 자기장은 <b>반시계</b> 방향<br>" +
           "· ⊗ (들어가는 전류) → 자기장은 <b>시계</b> 방향<br>" +
           "<em>오른손 엄지손가락을 전류 방향으로 향하면, 감아쥔 손가락이 자기장의 방향이에요.</em>"
    },
    {
      id: 3, star: "🌀", title: "코일도 자석이 된다",
      story: "이번엔 도선을 <b>코일</b>로 감았다. 전류를 흘리고, 전류 방향을 <b>바꿔서</b> " +
             "N극이 어느 쪽에 생기는지 <b>두 경우</b> 모두 확인해 보자.",
      scene: "field", setup: { mode: "coil", cur: 3, Isign: 1 }, allow: ["mode", "cur", "isign"],
      predict: { q: "전류가 흐르는 코일 주위에는?",
                 opts: ["자기장이 생기지 않는다", "<b>막대자석과 비슷한 자기장이 생긴다</b>", "도선 둘레에만 자기장이 생긴다"], ans: 1 },
      goals: [{ key: "poles", text: "코일에서 <b>N극이 오른쪽·왼쪽</b>에 생기는 경우를 모두 보기" }],
      why: "<b>막대자석과 비슷한 자기장이 생깁니다.</b><br>" +
           "코일에 흐르는 전류 방향으로 오른손을 감아쥘 때 <b>엄지손가락이 가리키는 쪽이 N극</b>이에요.<br>" +
           "이런 코일 속에 철심을 넣은 것이 <b>전자석</b>입니다."
    },
    {
      id: 4, star: "⚡", title: "힘이 생긴다",
      story: "자석 사이에 알루미늄박(도선)을 놓았다. <b>스위치를 켜서</b> 전류를 흘려 보자.",
      scene: "force", setup: { sw: 0, Isign: 1, Bsign: 1, R: 3, n: 1 }, allow: ["sw"],
      predict: { q: "자기장 속의 도선에 전류를 흘리면?",
                 opts: ["아무 일도 없다", "<b>도선이 힘을 받아 움직인다</b>", "도선이 자석에 달라붙는다"], ans: 1 },
      goals: [{ key: "forceOn", text: "스위치를 <b>켜서</b> 도선이 받는 힘 관찰하기" }],
      why: "<b>도선이 힘을 받습니다.</b><br>" +
           "자기장에서 전류가 흐르는 도선은 <b>자기력(전자기력)</b>을 받아요. 붉은 화살표가 그 힘입니다."
    },
    {
      id: 5, star: "↕️", title: "전류 방향을 바꾸면",
      story: "스위치를 켠 채로 <b>전류의 방향</b>만 바꿔 보자. 힘의 방향은 어떻게 될까? " +
             "<b>위쪽과 아래쪽</b> 둘 다 만들어 보자.",
      scene: "force", setup: { sw: 0, Isign: 1, Bsign: 1, R: 3, n: 1 }, allow: ["sw", "isign"],
      predict: { q: "전류 방향만 반대로 하면 힘의 방향은?",
                 opts: ["그대로다", "<b>반대가 된다</b>", "힘이 사라진다"], ans: 1 },
      goals: [{ key: "dirs", text: "힘이 <b>위쪽</b>일 때와 <b>아래쪽</b>일 때를 모두 보기 (스위치를 켠 채로)" }],
      why: "<b>반대가 됩니다.</b> ⊙ 이면 위쪽, ⊗ 이면 아래쪽.<br>" +
           "학습지의 문장 그대로예요 — <b>전류의 방향이 바뀌면 힘의 방향도 바뀐다.</b> " +
           "자석의 극만 바꿔도 마찬가지입니다."
    },
    {
      id: 6, star: "🔁", title: "둘 다 바꾸면",
      story: "이번엔 <b>전류 방향</b>과 <b>자석의 극</b>을 <b>둘 다</b> 바꿔 보자. 스위치를 켠 채로.",
      scene: "force", setup: { sw: 0, Isign: 1, Bsign: 1, R: 3, n: 1 }, allow: ["sw", "isign", "bsign"],
      predict: { q: "전류 방향과 자석의 극을 둘 다 바꾸면 힘의 방향은?",
                 opts: ["<b>처음과 같다</b>", "처음과 반대가 된다", "힘이 사라진다"], ans: 0 },
      goals: [{ key: "bothFlip", text: "전류 방향과 자석의 극을 <b>둘 다 처음과 반대로</b> 하고 스위치 켜기" }],
      why: "<b>처음과 같습니다.</b><br>" +
           "하나를 바꾸면 힘이 뒤집히는데, 둘을 모두 바꾸면 <b>뒤집기가 두 번</b> 일어나 제자리로 돌아와요.<br>" +
           "학습지 실험표의 넷째 칸(둘 다 바꿈)이 첫째 칸(기본 구성)과 같은 까닭입니다."
    },
    {
      id: 7, star: "💪", title: "힘을 더 세게",
      story: "지금은 힘이 2칸이다. <b>4칸 이상</b>이 되도록 만들어 보자. " +
             "무엇을 바꾸면 될까? (니크롬선 접점, 자석 개수)",
      scene: "force", setup: { sw: 0, Isign: 1, Bsign: 1, R: 3, n: 1 }, allow: ["sw", "R", "n"],
      predict: { q: "도선이 받는 힘을 크게 하려면?",
                 opts: ["<b>전류를 크게(저항을 작게) · 자기장을 세게(자석을 늘려)</b>", "전류를 작게 한다", "자석을 치운다"], ans: 0 },
      goals: [{ key: "big", text: "스위치를 켜고 힘을 <b>4칸 이상</b>으로 만들기" }],
      why: "<b>전류를 크게 하거나 자기장을 세게 하면</b> 힘이 커집니다.<br>" +
           "힘의 크기는 전류와 자기장의 세기에 <b>비례</b>해요. 전류를 크게 하려면 <b>저항을 작게</b> 해야 합니다.<br>" +
           "<em>오른쪽 그래프에서 점이 직선 위에 있는 것을 보세요.</em>"
    },
    {
      id: 8, star: "🌀", title: "코일이 돈다",
      story: "이번엔 전동기다. 스위치를 켜고 <b>▶ 돌려 보기</b>를 눌러 반 바퀴 이상 돌려 보자. " +
             "그리고 <b>전류 방향을 바꿔</b> 반대로도 돌려 보자.",
      scene: "motor", setup: { sw: 0, Isign: 1, Bsign: 1, R: 3, n: 1, theta: 0.35 }, allow: ["sw", "isign", "bsign", "R", "n"],
      predict: { q: "전류 방향을 반대로 하면 코일의 회전 방향은?",
                 opts: ["그대로다", "<b>반대가 된다</b>", "멈춘다"], ans: 1 },
      goals: [
        { key: "ccw", text: "<b>반시계</b> 방향으로 반 바퀴 이상 돌려 보기" },
        { key: "cw", text: "<b>시계</b> 방향으로 반 바퀴 이상 돌려 보기" }
      ],
      why: "<b>반대가 됩니다.</b><br>" +
           "코일의 두 변 AB · CD 는 전류가 <b>서로 반대</b>라 받는 힘도 <b>반대</b>이고, 그래서 코일이 회전해요.<br>" +
           "전류(또는 자석의 극)를 바꾸면 힘이 뒤집혀 회전 방향도 바뀝니다.<br>" +
           "<em>반 바퀴마다 <b>정류자</b>가 전류를 끊어 주므로 코일이 한 방향으로 계속 돌 수 있어요.</em>"
    }
  ];

  /* ---------------------------------------------------------
     3. 화면 만들기
     --------------------------------------------------------- */
  function layout() {
    if (!canvas) return;
    var r = canvas.getBoundingClientRect();
    cssW = Math.max(320, Math.round(r.width || 900));
    cssH = Math.max(200, Math.round(r.height || cssW / 1.62));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* 도구 : 화살표 · ⊙⊗ · 나침반 · 자석 */
  function arrow(g, x1, y1, x2, y2, col, w) {
    var len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return;
    var a = Math.atan2(y2 - y1, x2 - x1), h = Math.min(12, len * 0.6);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w || 4; g.lineCap = "round";
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2 - Math.cos(a) * h * 0.6, y2 - Math.sin(a) * h * 0.6); g.stroke();
    g.beginPath();
    g.moveTo(x2, y2);
    g.lineTo(x2 - Math.cos(a - 0.45) * h, y2 - Math.sin(a - 0.45) * h);
    g.lineTo(x2 - Math.cos(a + 0.45) * h, y2 - Math.sin(a + 0.45) * h);
    g.closePath(); g.fill();
    g.lineCap = "butt";
  }

  /* 전류 기호 : ⊙ 나오는(+1) · ⊗ 들어가는(−1) · 0 이면 빈 원 */
  function currentSym(g, x, y, rad, sign, col) {
    g.strokeStyle = col; g.lineWidth = 2.5;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.stroke();
    if (sign > 0) {
      g.fillStyle = col; g.beginPath(); g.arc(x, y, rad * 0.32, 0, Math.PI * 2); g.fill();
    } else if (sign < 0) {
      var d = rad * 0.62;
      g.beginPath();
      g.moveTo(x - d, y - d); g.lineTo(x + d, y + d);
      g.moveTo(x + d, y - d); g.lineTo(x - d, y + d);
      g.stroke();
    }
  }

  /* 나침반 : ang 는 N극이 가리키는 각도(수학 좌표, 반시계가 +) */
  function compass(g, x, y, angMath) {
    g.fillStyle = "#0f172a"; g.strokeStyle = "rgba(226,232,240,.75)"; g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, y, 13, 0, Math.PI * 2); g.fill(); g.stroke();
    g.save(); g.translate(x, y); g.rotate(-angMath);
    g.fillStyle = COL.N;
    g.beginPath(); g.moveTo(11, 0); g.lineTo(0, 4); g.lineTo(0, -4); g.closePath(); g.fill();
    g.fillStyle = "#e2e8f0";
    g.beginPath(); g.moveTo(-11, 0); g.lineTo(0, 4); g.lineTo(0, -4); g.closePath(); g.fill();
    g.restore();
  }

  /* 자석 한 덩이 : 왼쪽 극(letter), 오른쪽 극. n 개면 뒤로 겹쳐 쌓는다. */
  function magnetBlock(g, x, y, w, h, letter, col, n) {
    for (var k = n - 1; k >= 0; k--) {
      var ox = -5 * k, oy = -5 * k;
      g.fillStyle = k === 0 ? col : "rgba(148,163,184,.45)";
      roundRect(g, x + ox, y + oy, w, h, 6); g.fill();
      g.strokeStyle = "rgba(226,232,240,.7)"; g.lineWidth = 1.5;
      roundRect(g, x + ox, y + oy, w, h, 6); g.stroke();
    }
    g.fillStyle = "#fff"; g.font = "bold 30px sans-serif"; g.textAlign = "center";
    g.fillText(letter, x + w / 2, y + h / 2 + 10);
  }

  function draw() {
    if (!ctx) return;
    var g = ctx;
    var grad = g.createLinearGradient(0, 0, 0, cssH);
    grad.addColorStop(0, "#0b1220"); grad.addColorStop(1, "#1e293b");
    g.fillStyle = grad; g.fillRect(0, 0, cssW, cssH);
    var k = sceneKind();
    if (k === "field") { if (S.mode === "coil") drawCoil(g); else drawWire(g); }
    else if (k === "force") drawForce(g);
    else drawMotor(g);
  }

  /* ---- 장면 ① 직선 도선 (위에서 본 그림) ----
     나침반 바늘의 N극은 도선을 둘러싸는 방향을 가리킨다. 전류가 0 이면 모두 북쪽을 가리킨다. */
  var geomWire = null;
  function drawWire(g) {
    var m = Math.min(cssW, cssH);
    var cx = cssW / 2, cy = cssH * 0.5;
    var r1 = m * 0.19, r2 = m * 0.38;
    var I = S.cur, sign = S.Isign;
    var geo = { cx: cx, cy: cy, rings: [], compasses: [] };

    /* 고리 : 굵기 = 자기장의 세기(전류에 비례, 거리에 반비례) */
    [r1, r2].forEach(function (r) {
      var B = E.wireFieldRel(I, r / r1);          // 안쪽 고리 = 전류 그대로, 바깥 고리 = 절반
      var w = 8 * B / 5;                          // 전류 5 A 의 안쪽 고리가 8 px
      geo.rings.push({ r: r, B: B, w: w });
      g.strokeStyle = "rgba(96,165,250,.55)"; g.lineWidth = Math.max(w, 0);
      if (w > 0.05) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
      g.strokeStyle = "rgba(148,163,184,.25)"; g.lineWidth = 1; g.setLineDash([4, 5]);
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    });

    /* 나침반 8개씩 */
    [r1, r2].forEach(function (r, ri) {
      for (var i = 0; i < 8; i++) {
        var phi = (i + 0.5) * Math.PI / 4;
        var px = cx + r * Math.cos(phi), py = cy - r * Math.sin(phi);
        var ang = I > 0 ? E.wireNeedleAngle(sign, phi) : Math.PI / 2;     // 전류 0 : 북쪽(위)
        compass(g, px, py, ang);
        geo.compasses.push({ ring: ri, phi: phi, x: px, y: py, ang: ang });
      }
    });

    /* 도선 */
    g.fillStyle = "rgba(251,191,36,.18)";
    g.beginPath(); g.arc(cx, cy, 24, 0, Math.PI * 2); g.fill();
    currentSym(g, cx, cy, 15, I > 0 ? sign : 0, COL.cur);

    g.textAlign = "left"; g.fillStyle = COL.faint; g.font = "14px sans-serif";
    g.fillText("🧭 도선을 위에서 본 그림 · 나침반의 붉은 쪽이 N극", 16, 26);
    g.font = "bold 16px sans-serif";
    if (I > 0) {
      g.fillStyle = COL.cur;
      g.fillText(sign > 0 ? "⊙ 전류가 화면에서 나온다" : "⊗ 전류가 화면으로 들어간다", 16, 50);
      g.fillStyle = "#93c5fd";
      g.fillText("자기장 : " + (sign > 0 ? "반시계" : "시계") + " 방향으로 도선을 둘러싼다", 16, 72);
    } else {
      g.fillStyle = COL.faint;
      g.fillText("전류가 0 — 바늘이 모두 북쪽(위)을 가리킨다", 16, 50);
    }
    g.textAlign = "center"; g.fillStyle = "#fde047"; g.font = "bold 14px sans-serif";
    if (I > 0) g.fillText("안쪽 고리가 바깥 고리보다 굵다 → 가까울수록 자기장이 세다", cssW / 2, cssH - 52);
    geomWire = geo;
  }

  /* ---- 장면 ① 코일 (옆에서 본 그림) ----
     Isign +1 : 앞쪽 도선에서 전류가 아래로. 오른손을 감아쥐면 엄지가 N극 쪽을 가리킨다. */
  var geomCoil = null;
  function drawCoil(g) {
    var I = S.cur, sign = S.Isign;
    var cx = cssW / 2, cy = cssH * 0.5;
    var halfW = Math.min(cssW * 0.22, 130), ry = Math.min(cssH * 0.15, 74);
    var x0 = cx - halfW, x1 = cx + halfW;
    var pole = E.coilPole(sign), dirX = E.coilAxisDir(sign);
    var nx = pole === "right" ? x1 : x0, sx = pole === "right" ? x0 : x1;   // N극 · S극 끝
    var geo = { cx: cx, cy: cy, x0: x0, x1: x1, pole: pole, compasses: [], turns: E.TURNS };

    /* 바깥을 도는 자기장 선 : N극에서 나와 S극으로 (전류가 있을 때만, 굵기 = 세기) */
    var Bw = 6 * E.coilFieldRel(I) / (E.coilFieldRel(5));
    geo.lineW = I > 0 ? Bw : 0;
    if (I > 0) {
      g.strokeStyle = "rgba(96,165,250,.7)"; g.lineWidth = Math.max(Bw, 1);
      [-1, 1].forEach(function (up) {
        var lift = up * (ry + 70);
        var ex = nx + dirX * 26, sx2 = sx - dirX * 26;
        g.beginPath();
        g.moveTo(ex, cy);
        g.bezierCurveTo(ex + dirX * 90, cy + lift * 1.15, sx2 - dirX * 90, cy + lift * 1.15, sx2, cy);
        g.stroke();
        var mx = (ex + sx2) / 2, my = cy + lift * 0.86;
        arrow(g, mx + dirX * 8, my, mx - dirX * 10, my, COL.field, Math.max(Bw, 2));
      });
      /* 안쪽 : 코일 속 (S → N) */
      arrow(g, sx + dirX * 14, cy, nx - dirX * 14, cy, "rgba(96,165,250,.9)", Math.max(Bw, 2));
    }

    /* 코일 : 앞쪽 도선을 세로 막대로, 뒤쪽은 흐리게 */
    for (var t = 0; t < E.TURNS; t++) {
      var tx = x0 + (x1 - x0) * (t + 0.5) / E.TURNS;
      g.strokeStyle = "rgba(148,163,184,.35)"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(tx + 9, cy - ry); g.lineTo(tx + 9, cy + ry); g.stroke();
      g.strokeStyle = "rgba(148,163,184,.30)"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(tx, cy - ry); g.lineTo(tx + 9, cy - ry); g.moveTo(tx, cy + ry); g.lineTo(tx + 9, cy + ry); g.stroke();
      g.strokeStyle = I > 0 ? COL.cur : "#a16207"; g.lineWidth = 4;
      g.beginPath(); g.moveTo(tx, cy - ry); g.lineTo(tx, cy + ry); g.stroke();
      if (I > 0) {
        var mid = cy, dir = sign > 0 ? +1 : -1;       // +1 : 앞쪽에서 아래로 (화면 아래 = +y)
        g.fillStyle = COL.cur;
        g.beginPath();
        g.moveTo(tx, mid + dir * 9); g.lineTo(tx - 6, mid - dir * 4); g.lineTo(tx + 6, mid - dir * 4);
        g.closePath(); g.fill();
      }
    }

    /* 극 표시 */
    if (I > 0) {
      g.font = "bold 22px sans-serif"; g.textAlign = "center";
      g.fillStyle = COL.N; g.fillText("N", nx + dirX * 22, cy - ry - 12);
      g.fillStyle = COL.S; g.fillText("S", sx - dirX * 22, cy - ry - 12);
    }

    /* 나침반 3개 : 코일 축 위 — 왼쪽 밖 · 코일 속 · 오른쪽 밖. 세 곳 모두 자기장이 같은 쪽(+x 또는 −x)이다.
       ⚠ 코일 위·아래(되돌아오는 선)에 두면 방향이 반대라서 축 위에만 둔다. */
    var cxs = [x0 - 46, cx, x1 + 46];
    cxs.forEach(function (px) {
      var ang = I > 0 ? (dirX > 0 ? 0 : Math.PI) : Math.PI / 2;
      compass(g, px, cy, ang);
      geo.compasses.push({ x: px, y: cy, ang: ang });
    });

    g.textAlign = "left"; g.fillStyle = COL.faint; g.font = "14px sans-serif";
    g.fillText("🌀 코일을 옆에서 본 그림 · 나침반의 붉은 쪽이 N극", 16, 26);
    g.font = "bold 16px sans-serif";
    if (I > 0) {
      g.fillStyle = COL.cur;
      g.fillText("앞쪽 도선의 전류 : " + (sign > 0 ? "⬇ 아래로" : "⬆ 위로"), 16, 50);
      g.fillStyle = "#93c5fd";
      g.fillText("N극은 " + (pole === "right" ? "오른쪽" : "왼쪽") + " — 막대자석과 비슷한 자기장", 16, 72);
    } else {
      g.fillStyle = COL.faint; g.fillText("전류가 0 — 자석의 성질이 없다", 16, 50);
    }
    geomCoil = geo;
  }

  /* ---- 장면 ② 자기장 속의 도선이 받는 힘 (알루미늄박 실험) ---- */
  var geomForce = null;
  function fieldLines(g, cx, cy, n, xN, xS, dirRight) {
    /* 자기장 선 : 자석 한 개 늘 때마다 선이 2줄씩 는다 (2n+1 줄) */
    var count = 2 * n + 1, gap = 22;
    g.strokeStyle = "rgba(96,165,250,.55)"; g.lineWidth = 2;
    for (var i = 0; i < count; i++) {
      var y = cy + (i - n) * gap;
      var xa = dirRight ? xN : xS, xb = dirRight ? xS : xN;
      g.beginPath(); g.moveTo(xa, y); g.lineTo(xb, y); g.stroke();
      var mx = (xa + xb) / 2 + (dirRight ? 0 : 0);
      g.fillStyle = "rgba(96,165,250,.9)";
      var s = dirRight ? 1 : -1;
      g.beginPath();
      g.moveTo(mx + s * 8, y); g.lineTo(mx - s * 5, y - 5); g.lineTo(mx - s * 5, y + 5); g.closePath(); g.fill();
    }
    return count;
  }

  function drawForce(g) {
    var I = currentNow(), n = S.n, on = !!S.sw;
    var cx = cssW / 2, cy = cssH * 0.52;
    var bw = Math.min(cssW * 0.2, 96), bh = Math.min(cssH * 0.36, 190);
    var leftX = Math.max(22, cx - cssW * 0.36), rightX = Math.min(cssW - 22 - bw, cx + cssW * 0.36 - bw);
    var leftFace = leftX + bw, rightFace = rightX;
    var geo = { cx: cx, cy: cy, I: I, n: n, arrow: null, lines: 0 };

    /* 자석 : Bsign +1 이면 N 이 왼쪽 */
    var nLeft = S.Bsign > 0;
    magnetBlock(g, leftX, cy - bh / 2, bw, bh, nLeft ? "N" : "S", nLeft ? COL.N : COL.S, n);
    magnetBlock(g, rightX, cy - bh / 2, bw, bh, nLeft ? "S" : "N", nLeft ? COL.S : COL.N, n);
    geo.lines = fieldLines(g, cx, cy, n, nLeft ? leftFace : rightFace, nLeft ? rightFace : leftFace, nLeft);

    /* 도선(알루미늄박)의 단면 */
    g.fillStyle = "rgba(251,191,36,.16)";
    g.beginPath(); g.arc(cx, cy, 24, 0, Math.PI * 2); g.fill();
    currentSym(g, cx, cy, 15, on ? S.Isign : 0, on ? COL.cur : COL.faint);
    g.fillStyle = COL.ink; g.font = "13px sans-serif"; g.textAlign = "center";
    g.fillText("알루미늄박(도선)", cx, cy + 42);

    /* 힘의 화살표 : 길이 = 힘(칸) × 8 px — 눈금은 이 하나뿐 */
    if (on) {
      var dir = E.forceDir(S.Isign, S.Bsign);
      var mag = E.forceMag(I, n);
      var len = mag * PX_PER_KAN;
      var y0 = cy - dir * 30, y1 = cy - dir * (30 + len);
      arrow(g, cx, y0, cx, y1, COL.force, 6);
      geo.arrow = { x: cx, y0: y0, y1: y1, len: len, mag: mag, dir: dir };
      g.fillStyle = COL.force; g.font = "bold 16px sans-serif"; g.textAlign = "center";
      g.fillText("힘 " + f1(mag) + " 칸 (" + E.forceName(dir) + ")", cx, dir > 0 ? y1 - 12 : y1 + 24);
    }

    g.textAlign = "left"; g.fillStyle = COL.faint; g.font = "14px sans-serif";
    g.fillText("⚡ 자석 사이에 놓은 도선을 옆에서 본 그림", 16, 26);
    g.fillStyle = COL.ink; g.font = "13px sans-serif";
    g.fillText("🔋 " + E.VOLT + " V · 저항 " + f1(S.R) + " Ω · 전류 " + f1(I) + " A · 자석 " + n + "개", 16, 48);
    g.textAlign = "center"; g.font = "bold 14px sans-serif";
    if (on) {
      g.fillStyle = "#fde047";
      g.fillText("전류(⊙⊗)와 자기장(→)의 방향이 힘의 방향을 정한다", cssW / 2, cssH - 52);
    } else {
      g.fillStyle = COL.faint; g.fillText("스위치가 꺼져 있다 — 전류가 없으니 힘도 없다", cssW / 2, cssH - 52);
    }
    geomForce = geo;
  }

  /* ---- 장면 ③ 전동기 (회전축 방향에서 본 그림) ---- */
  var geomMotor = null;
  function drawMotor(g) {
    var I = currentNow(), n = S.n, on = !!S.sw;
    var m = Math.min(cssW, cssH);
    var cx = cssW / 2, cy = cssH * 0.5;
    var bw = Math.min(cssW * 0.18, 84), bh = Math.min(cssH * 0.5, 230);
    var leftX = Math.max(18, cx - cssW * 0.38), rightX = Math.min(cssW - 18 - bw, cx + cssW * 0.38 - bw);
    var nLeft = S.Bsign > 0;
    /* 코일 반지름 : 자석 사이 간격 안에 코일 끝(원 반지름 22 + 여유)이 들어가게 */
    var Rc = clamp(Math.min(m * 0.20, (rightX - cx) - 34), 30, 200);
    var geo = { cx: cx, cy: cy, Rc: Rc, wires: [], arrows: [] };

    magnetBlock(g, leftX, cy - bh / 2, bw, bh, nLeft ? "N" : "S", nLeft ? COL.N : COL.S, n);
    magnetBlock(g, rightX, cy - bh / 2, bw, bh, nLeft ? "S" : "N", nLeft ? COL.S : COL.N, n);
    fieldLines(g, cx, cy, n, nLeft ? leftX + bw : rightX, nLeft ? rightX : leftX + bw, nLeft);

    var th = S.theta;
    var flows = on && E.currentFlows(th);
    var f = E.sideForces(th, S.Isign, S.Bsign);
    var ax = cx + Rc * Math.cos(th), ay = cy - Rc * Math.sin(th);      // AB
    var bx = cx - Rc * Math.cos(th), by = cy + Rc * Math.sin(th);      // CD

    /* 코일 틀 · 회전축 */
    g.strokeStyle = "rgba(226,232,240,.55)"; g.lineWidth = 6; g.lineCap = "round";
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.lineCap = "butt";
    g.fillStyle = "#94a3b8"; g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill();

    [[ax, ay, "AB", +1, f.AB], [bx, by, "CD", -1, f.CD]].forEach(function (w) {
      var sgn = flows ? w[3] * S.Isign : 0;
      g.fillStyle = "rgba(251,191,36,.14)";
      g.beginPath(); g.arc(w[0], w[1], 22, 0, Math.PI * 2); g.fill();
      currentSym(g, w[0], w[1], 14, sgn, flows ? COL.cur : COL.faint);
      g.fillStyle = COL.ink; g.font = "bold 14px sans-serif"; g.textAlign = "center";
      var lx = w[0] + (w[0] >= cx ? 34 : -34);
      g.fillText(w[2], lx, w[1] + 5);
      geo.wires.push({ name: w[2], x: w[0], y: w[1], sign: sgn });
      if (flows) {
        var len = E.forceMag(I, n) * 4;                       // 전동기 장면의 눈금 : 1칸 = 4 px
        var yEnd = w[1] - w[4] * (24 + len);
        arrow(g, w[0], w[1] - w[4] * 24, w[0], yEnd, COL.force, 5);
        geo.arrows.push({ name: w[2], x: w[0], y0: w[1] - w[4] * 24, y1: yEnd, len: len, dir: w[4] });
      }
    });

    /* 상태 문구 */
    g.textAlign = "left"; g.fillStyle = COL.faint; g.font = "14px sans-serif";
    g.fillText("🌀 코일의 두 변(AB · CD)을 회전축 방향에서 본 그림", 16, 26);
    g.font = "bold 16px sans-serif";
    if (!on) {
      g.fillStyle = COL.faint; g.fillText("스위치가 꺼져 있다 — 코일이 멈춰 있다", 16, 50);
    } else if (flows) {
      g.fillStyle = COL.cur; g.fillText("전류가 흐른다 — AB · CD 가 반대로 힘을 받는다", 16, 50);
      g.fillStyle = "#93c5fd";
      g.fillText("코일은 " + E.spinName(E.motorSpin(S.Isign, S.Bsign)) + " 방향으로 돈다", 16, 72);
    } else {
      g.fillStyle = "#fbbf24"; g.fillText("정류자 : 전류가 끊겼다 — 관성으로 계속 돈다", 16, 50);
      g.fillStyle = "#93c5fd";
      g.fillText("코일은 " + E.spinName(E.motorSpin(S.Isign, S.Bsign)) + " 방향으로 돈다", 16, 72);
    }
    g.textAlign = "center"; g.fillStyle = "#fde047"; g.font = "bold 14px sans-serif";
    g.fillText(on ? "반 바퀴마다 전류가 끊기고, 코일은 한 방향으로 계속 돈다" : "스위치를 켜고 ▶ 돌려 보기를 눌러 보세요", cssW / 2, cssH - 52);
    geo.flows = flows; geo.theta = th;
    geomMotor = geo;
  }

  /* ---------------------------------------------------------
     4. 계기판
     --------------------------------------------------------- */
  function ro(i, name, val, unit) {
    $("roName" + i).textContent = name; $("roVal" + i).textContent = val;
    $("roUnit" + i).textContent = unit || "";
  }

  function updatePanel() {
    var k = sceneKind();
    var I = currentNow();

    if (k === "field" && S.mode === "wire") {
      var B1 = E.wireFieldRel(I, 1), B2 = E.wireFieldRel(I, 2);
      $("gaugeTitle").textContent = "🧭 직선 도선";
      $("gaugeSub").innerHTML = "도선 <b>둘레</b>에 자기장이 생긴다";
      ro(1, "전류", f1(I), " A");
      ro(2, "자기장 방향", I > 0 ? (S.Isign > 0 ? "반시계" : "시계") : "-", "");
      ro(3, "안쪽 고리 세기", f1(B1), " 칸");
      ro(4, "바깥 고리 세기", f1(B2), " 칸");
      $("fLaw").innerHTML = '오른손 <span class="k">엄지 = 전류</span> · <span class="t">감아쥔 손 = 자기장</span>';
      $("fWhy").innerHTML = '<em>세기는 전류에 <b>비례</b>하고, 도선에서 멀수록 <b>약하다</b></em>';
    } else if (k === "field") {
      var pole = E.coilPole(S.Isign);
      $("gaugeTitle").textContent = "🌀 코일 (전자석)";
      $("gaugeSub").innerHTML = "코일도 <b>자석</b>처럼 된다";
      ro(1, "전류", f1(I), " A");
      ro(2, "N극", I > 0 ? (pole === "right" ? "오른쪽" : "왼쪽") : "-", "");
      ro(3, "자기장 세기", f1(E.coilFieldRel(I)), " 칸");
      ro(4, "코일 감은 수", String(E.TURNS), " 회");
      $("fLaw").innerHTML = '오른손을 <span class="k">전류 방향</span>으로 감아쥐면 <span class="t">엄지 = N극</span>';
      $("fWhy").innerHTML = '<em>코일 속에 <b>철심</b>을 넣으면 <b>전자석</b>이 된다</em>';
    } else if (k === "force") {
      var dir = E.forceDir(S.Isign, S.Bsign), mag = E.forceMag(I, S.n);
      $("gaugeTitle").textContent = "⚡ 도선이 받는 힘";
      $("gaugeSub").innerHTML = S.sw ? "전류와 자기장이 <b>힘</b>을 만든다" : "스위치를 켜 보세요";
      ro(1, "전류", f1(I), " A");
      ro(2, "자기장 세기", String(S.n), " (자석 " + S.n + "개)");
      ro(3, "힘의 방향", S.sw ? E.forceName(dir) : "-", "");
      ro(4, "힘의 크기", S.sw ? f1(mag) : "0", " 칸");
      $("fLaw").innerHTML = '힘의 크기 ∝ <span class="k">전류</span> × <span class="t">자기장의 세기</span>';
      $("fWhy").innerHTML = S.sw
        ? '<em>' + f1(I) + ' A × 자석 ' + S.n + '개 = <b>' + f1(mag) + ' 칸</b></em>'
        : '<em>전류가 0 이면 힘도 0</em>';
    } else {
      var om = E.omega(S.Isign, S.Bsign, I, S.n);
      var fl = S.sw && E.currentFlows(S.theta);
      $("gaugeTitle").textContent = "🌀 전동기";
      $("gaugeSub").innerHTML = "두 변이 <b>반대로</b> 힘을 받아 돈다";
      ro(1, "전류", f1(I), " A");
      ro(2, "회전 방향", S.sw ? E.spinName(E.motorSpin(S.Isign, S.Bsign)) : "-", "");
      ro(3, "회전 빠르기", S.sw ? f2(Math.abs(om) / (2 * Math.PI)) : "0", " 바퀴/초");
      ro(4, "코일의 전류", !S.sw ? "꺼짐" : (fl ? "흐름" : "끊김"), "");
      $("fLaw").innerHTML = '<span class="k">AB</span> 와 <span class="t">CD</span> 는 전류가 <b>반대</b> → 힘도 <b>반대</b> → 코일이 <b>회전</b>';
      $("fWhy").innerHTML = '<em><b>정류자</b> : 반 바퀴마다 전류를 끊어 한 방향으로 계속 돌게 한다</em>';
    }

    $("valCur").textContent = f1(S.cur) + " A";
    $("valR").textContent = f1(S.R) + " Ω";
    $("valN").textContent = S.n + " 개";
    $("tip").textContent = tipText();
    $("btnPlay").textContent = S.playing ? "⏸ 멈춤" : "▶ 돌려 보기";
    /* 코일 장면에서는 '전류 방향'의 뜻이 달라진다 */
    var coil = (k === "field" && S.mode === "coil");
    $("chipIout").textContent = coil ? "⬇️ 앞쪽에서 아래로" : "⊙ 나오는 방향";
    $("chipIin").textContent = coil ? "⬆️ 앞쪽에서 위로" : "⊗ 들어가는 방향";
    $("lblIsign").firstChild.nodeValue = coil ? "코일의 전류 방향 " : "전류 방향 ";
    $("ctlHint").innerHTML = ctlHint(k);
    syncMissionGoals();
  }

  function ctlHint(k) {
    if (k === "field") return "나침반 <b>붉은 쪽(N극)</b>이 가리키는 방향이 자기장의 방향입니다.";
    if (k === "force") return "힘의 <b>방향</b>은 <b>전류</b>와 <b>자석의 극</b>이, <b>크기</b>는 전류와 자석 수가 정합니다.";
    return "<b>▶ 돌려 보기</b>를 누르면 코일이 돕니다. 전류나 자석의 극을 바꾸면 <b>회전 방향</b>이 바뀝니다.";
  }

  function tipText() {
    var k = sceneKind();
    if (k === "field") return S.mode === "coil" ? "전류 방향을 바꿔 N극의 자리를 보세요" : "전류를 흘리고 바늘을 보세요";
    if (k === "force") return "스위치를 켜고 방향을 바꿔 보세요";
    return "스위치를 켜고 ▶ 를 누르세요";
  }

  /* ---------------------------------------------------------
     5. 그래프 — 힘과 전류 (정비례 : 자석 수마다 기울기가 다른 직선)
     --------------------------------------------------------- */
  var geomGraph = null;
  function drawGraph() {
    var c = $("graph");
    if (!c) return;
    var r = c.getBoundingClientRect();
    if (r.width < 10) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(200, Math.round(r.width)), h = Math.max(100, Math.round(r.height));
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    }
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    var pad = { l: 40, r: 14, t: 26, b: 32 };
    var xmax = E.VOLT / E.R_MIN, ymax = xmax * E.N_MAX;         // 6 A · 18 칸
    function X(i) { return pad.l + (w - pad.l - pad.r) * i / xmax; }
    function Y(f) { return (h - pad.b) - (h - pad.b - pad.t) * f / ymax; }

    g.font = "12px sans-serif"; g.fillStyle = "#64748b"; g.strokeStyle = "#e2e8f0"; g.lineWidth = 1;
    g.textAlign = "right";
    for (var y = 0; y <= ymax; y += 6) {
      g.beginPath(); g.moveTo(pad.l, Y(y)); g.lineTo(w - pad.r, Y(y)); g.stroke();
      g.fillText(String(y), pad.l - 6, Y(y) + 4);
    }
    g.textAlign = "center";
    for (var x = 0; x <= xmax; x += 2) g.fillText(String(x), X(x), h - pad.b + 15);
    g.strokeStyle = "#94a3b8"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(pad.l, pad.t); g.lineTo(pad.l, h - pad.b); g.lineTo(w - pad.r, h - pad.b); g.stroke();
    g.fillStyle = "#475569"; g.textAlign = "center";
    g.fillText("전류 (A)", pad.l + (w - pad.l - pad.r) / 2, h - 5);
    g.save(); g.translate(11, (pad.t + h - pad.b) / 2); g.rotate(-Math.PI / 2);
    g.fillText("힘 (칸)", 0, 0); g.restore();

    var cols = ["#0284c7", "#7c3aed", "#ea580c"];
    for (var nn = E.N_MIN; nn <= E.N_MAX; nn++) {
      var on = (nn === S.n);
      g.strokeStyle = cols[nn - 1]; g.globalAlpha = on ? 1 : 0.35; g.lineWidth = on ? 3.2 : 1.6;
      g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(xmax), Y(E.forceMag(xmax, nn))); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = cols[nn - 1]; g.font = "bold 12px sans-serif"; g.textAlign = "left";
      g.fillText("자석 " + nn, pad.l + 8 + (nn - 1) * 62, 15);
    }
    var I = E.currentA(S.R, true);                              // 그래프는 스위치와 무관하게 '지금 저항'의 전류
    var F = E.forceMag(I, S.n);
    g.fillStyle = S.sw ? "#dc2626" : "#94a3b8";
    g.beginPath(); g.arc(X(I), Y(F), 5.5, 0, Math.PI * 2); g.fill();
    geomGraph = { w: w, h: h, pad: pad, xmax: xmax, ymax: ymax, dot: { I: I, F: F } };
  }

  /* ---------------------------------------------------------
     6. 조작 패널
     --------------------------------------------------------- */
  function syncControls() {
    var k = sceneKind();
    var allow = (S.scene === "mission" && S.mission) ? S.mission.allow : null;
    document.querySelectorAll("[data-for]").forEach(function (el) {
      var scenes = el.getAttribute("data-for").split(/\s+/);
      var need = el.getAttribute("data-need");
      var okScene = scenes.indexOf(k) >= 0;
      if (S.scene !== "mission") okScene = scenes.indexOf(S.scene) >= 0;
      var okNeed = true;
      if (S.scene === "mission" && need) okNeed = !!allow && allow.indexOf(need) >= 0;
      el.classList.toggle("hidden", !(okScene && okNeed));
    });
    $("missionCard").classList.toggle("hidden", S.scene !== "mission");
    $("rngCur").value = S.cur; $("rngR").value = S.R; $("rngN").value = S.n;
    setChips("chipMode", S.mode); setChips("chipIsign", S.Isign); setChips("chipB", S.Bsign); setChips("chipSw", S.sw);
  }

  function setChips(id, val) {
    var w = $(id); if (!w) return;
    w.querySelectorAll(".chip").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-val") === String(val));
    });
  }

  /* ---------------------------------------------------------
     7. 전동기 애니메이션 (▶ 중에만)
     --------------------------------------------------------- */
  function advance(dt) {
    if (!S.sw) return;
    var om = E.omega(S.Isign, S.Bsign, currentNow(), S.n);
    var d = om * dt;
    S.theta += d;
    if (d > 0) seen.ccw += d; else seen.cw += -d;
  }

  function tick(now) {
    if (!S.playing) return;
    var dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    advance(dt);
    refresh();
    if (S.playing) raf = requestAnimationFrame(tick);
  }

  function play() {
    if (S.playing) { stopPlay(); refresh(); return; }
    S.playing = true; lastFrame = performance.now();
    raf = requestAnimationFrame(tick);
    refresh();
  }
  function stopPlay() { S.playing = false; if (raf) cancelAnimationFrame(raf); }

  /* ---------------------------------------------------------
     8. 미션
     --------------------------------------------------------- */
  function loadProgress() {
    try { return JSON.parse(sessionStorage.getItem("ef_missions") || "[]"); } catch (e) { return []; }
  }
  function saveProgress(l) { try { sessionStorage.setItem("ef_missions", JSON.stringify(l)); } catch (e) {} }

  function renderMissionList() {
    var done = loadProgress(), host = $("missionList");
    host.innerHTML = "";
    MISSIONS.forEach(function (Ms) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mcard" + (S.mission && S.mission.id === Ms.id ? " on" : "") +
                    (done.indexOf(Ms.id) >= 0 ? " done" : "");
      b.innerHTML = '<span class="mno">미션 ' + Ms.id + (done.indexOf(Ms.id) >= 0 ? " ✅" : "") + '</span>' +
                    '<span class="mtitle"><span class="mstar">' + Ms.star + '</span> ' + Ms.title + '</span>';
      b.addEventListener("click", function () { pickMission(Ms); });
      host.appendChild(b);
    });
    $("missionScore").textContent = done.length + " / " + MISSIONS.length;
  }

  function pickMission(Ms) {
    stopPlay();
    S.scene = "mission";
    $("scenes").querySelectorAll(".scene-btn").forEach(function (x) {
      x.classList.toggle("on", x.getAttribute("data-scene") === "mission");
    });
    S.mission = Ms; S.predictPick = null;
    S.missionState = Ms.predict ? "predict" : "ready";
    S.mode = "wire"; S.cur = 0; S.Isign = 1; S.Bsign = 1; S.sw = 0; S.R = 3; S.n = 1; S.theta = 0.35;
    Object.keys(Ms.setup || {}).forEach(function (kk) { S[kk] = Ms.setup[kk]; });
    resetSeen();
    syncControls(); renderMissionList(); renderMissionBody(); refresh();
  }

  function renderMissionBody() {
    var Ms = S.mission, body = $("missionBody");
    if (!Ms) { body.classList.add("hidden"); return; }
    body.classList.remove("hidden");
    $("mTitle").textContent = Ms.star + " 미션 " + Ms.id + " · " + Ms.title;
    $("mStory").innerHTML = Ms.story;

    var pd = $("mPredict");
    if (Ms.predict && S.missionState === "predict") {
      pd.classList.remove("hidden");
      $("mQ").innerHTML = Ms.predict.q;
      var opts = $("mOpts"); opts.innerHTML = "";
      Ms.predict.opts.forEach(function (t, i) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "opt"; b.innerHTML = t;
        b.addEventListener("click", function () {
          S.predictPick = i; S.missionState = "ready"; renderMissionBody();
        });
        opts.appendChild(b);
      });
    } else pd.classList.add("hidden");

    var gl = $("mGoals");
    if (Ms.goals && S.missionState !== "predict") {
      gl.classList.remove("hidden");
      gl.innerHTML = '<div class="q">목표</div>' + Ms.goals.map(function (gg) {
        var ok = checkGoal(gg.key);
        return '<div class="goal' + (ok ? " ok" : "") + '">' + (ok ? "✅ " : "⬜ ") + gg.text + '</div>';
      }).join("");
    } else gl.classList.add("hidden");

    var vd = $("mVerdict");
    if (S.missionState === "won") {
      vd.className = "verdict ok";
      vd.innerHTML = "<b>🎉 성공!</b>" + Ms.why +
        (Ms.predict && S.predictPick != null
          ? "<br><br>" + (S.predictPick === Ms.predict.ans
              ? "예측도 <b>맞았습니다.</b> 잘했어요!"
              : "예측은 달랐지만 <b>직접 확인해서 알아냈습니다.</b> 그것이 더 중요해요.")
          : "");
      vd.classList.remove("hidden");
    } else if (S.missionState === "predict") vd.classList.add("hidden");
    else {
      vd.className = "verdict no";
      vd.innerHTML = "<b>직접 확인하세요</b>목표를 모두 채우면 이유가 열립니다.";
      vd.classList.remove("hidden");
    }
  }

  function checkGoal(key) {
    switch (key) {
      case "curOn": return !!seen.curOn;
      case "signs": return !!(seen.signs["1"] && seen.signs["-1"]);
      case "poles": return !!(seen.poles.right && seen.poles.left);
      case "forceOn": return !!seen.forceOn;
      case "dirs": return !!(seen.dirs["1"] && seen.dirs["-1"]);
      case "bothFlip": return !!seen.bothFlip;
      case "big": return !!seen.big;
      case "ccw": return seen.ccw >= Math.PI;
      case "cw": return seen.cw >= Math.PI;
      default: return false;
    }
  }

  function noteSeen() {
    var k = sceneKind();
    if (k === "field") {
      if (S.cur > 0) {
        if (S.mode === "wire") { seen.curOn = true; seen.signs[String(S.Isign)] = true; }
        else seen.poles[E.coilPole(S.Isign)] = true;
      }
    }
    if (k === "force" && S.sw) {
      seen.forceOn = true;
      seen.dirs[String(E.forceDir(S.Isign, S.Bsign))] = true;
      if (S.Isign === -1 && S.Bsign === -1) seen.bothFlip = true;
      if (E.forceMag(E.currentA(S.R, true), S.n) >= 4) seen.big = true;
    }
  }

  function syncMissionGoals() {
    if (S.scene !== "mission" || !S.mission || S.missionState === "predict") return;
    var Ms = S.mission;
    if (!Ms.goals) return;
    var all = Ms.goals.every(function (gg) { return checkGoal(gg.key); });
    if (all && S.missionState !== "won") {
      S.missionState = "won";
      var done = loadProgress();
      if (done.indexOf(Ms.id) < 0) { done.push(Ms.id); saveProgress(done); }
      renderMissionList(); renderMissionBody();
    } else if (S.missionState !== "won") {
      var gl = $("mGoals");
      if (!gl.classList.contains("hidden")) {
        var rows = gl.querySelectorAll(".goal");
        Ms.goals.forEach(function (gg, i) {
          if (!rows[i]) return;
          var ok = checkGoal(gg.key);
          rows[i].className = "goal" + (ok ? " ok" : "");
          rows[i].innerHTML = (ok ? "✅ " : "⬜ ") + gg.text;
        });
      }
    }
  }

  /* ---------------------------------------------------------
     9. 실험 기록
     --------------------------------------------------------- */
  function addRecord() {
    var k = sceneKind(), I = currentNow(), rec;
    if (k === "field" && S.mode === "wire") {
      rec = { scene: "직선 도선", cond: (S.Isign > 0 ? "⊙ 나오는" : "⊗ 들어가는") + " · " + f1(I) + " A",
              res: I > 0 ? "자기장 " + (S.Isign > 0 ? "반시계" : "시계") + " 방향" : "자기장 없음" };
    } else if (k === "field") {
      rec = { scene: "코일", cond: "앞쪽 " + (S.Isign > 0 ? "아래로" : "위로") + " · " + f1(I) + " A",
              res: I > 0 ? "N극 " + (E.coilPole(S.Isign) === "right" ? "오른쪽" : "왼쪽") : "자기장 없음" };
    } else if (k === "force") {
      rec = { scene: "힘", cond: (S.Isign > 0 ? "⊙" : "⊗") + " · " + (S.Bsign > 0 ? "N극 왼쪽" : "N극 오른쪽") +
                                " · " + f1(I) + " A · 자석 " + S.n + "개",
              res: S.sw ? E.forceName(E.forceDir(S.Isign, S.Bsign)) + " " + f1(E.forceMag(I, S.n)) + " 칸" : "힘 없음" };
    } else {
      rec = { scene: "전동기", cond: (S.Isign > 0 ? "⊙" : "⊗") + " · " + (S.Bsign > 0 ? "N극 왼쪽" : "N극 오른쪽"),
              res: S.sw ? E.spinName(E.motorSpin(S.Isign, S.Bsign)) + " 방향 회전" : "멈춤" };
    }
    records.push(rec);
    renderRecords();
    window.PdfKit.toast("기록했습니다. (" + records.length + "번째)", "ok");
  }

  function renderRecords() {
    var body = $("recBody");
    body.innerHTML = "";
    records.forEach(function (r, i) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + (i + 1) + "</td><td>" + r.scene + "</td><td class='left'>" + r.cond +
                     "</td><td class='left'><b>" + r.res + "</b></td>";
      body.appendChild(tr);
    });
    $("recEmpty").classList.toggle("hidden", records.length > 0);
  }

  function refresh() { noteSeen(); draw(); updatePanel(); drawGraph(); }

  /* ---------------------------------------------------------
     10. 연결
     --------------------------------------------------------- */
  function bindChips(id, fn) {
    var w = $(id); if (!w) return;
    w.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".chip") : null;
      if (!b) return;
      w.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      fn(b.getAttribute("data-val"));
    });
  }

  function bind() {
    $("scenes").addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".scene-btn") : null;
      if (!b) return;
      stopPlay();
      $("scenes").querySelectorAll(".scene-btn").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      S.scene = b.getAttribute("data-scene");
      if (S.scene === "mission" && !S.mission) pickMission(MISSIONS[0]);
      else { syncControls(); refresh(); }
      renderMissionList();
    });

    $("btnPlay").addEventListener("click", play);
    $("btnReset").addEventListener("click", function () {
      stopPlay();
      S.cur = 0; S.Isign = 1; S.Bsign = 1; S.sw = 0; S.R = 3; S.n = 1; S.theta = 0.35; S.mode = "wire";
      syncControls(); refresh();
    });
    $("btnRecord").addEventListener("click", addRecord);
    $("btnClearRec").addEventListener("click", function () {
      if (!records.length) return;
      if (!confirm("기록을 모두 지울까요?")) return;
      records.length = 0; renderRecords();
    });

    $("rngCur").addEventListener("input", function () { S.cur = parseFloat(this.value); refresh(); });
    $("rngR").addEventListener("input", function () { S.R = parseFloat(this.value); refresh(); });
    $("rngN").addEventListener("input", function () { S.n = parseInt(this.value, 10); refresh(); });
    bindChips("chipMode", function (v) { S.mode = v; refresh(); });
    bindChips("chipIsign", function (v) { S.Isign = parseInt(v, 10); refresh(); });
    bindChips("chipB", function (v) { S.Bsign = parseInt(v, 10); refresh(); });
    bindChips("chipSw", function (v) { S.sw = parseInt(v, 10); refresh(); });

    var relayout = function () { layout(); draw(); drawGraph(); };
    if (window.ResizeObserver) {
      new ResizeObserver(relayout).observe(canvas);
    } else {
      window.addEventListener("resize", relayout);
    }
  }

  function boot() {
    canvas = $("stage");
    layout(); bind(); syncControls();
    renderMissionList(); renderRecords(); refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.EfLab = {
    S: S, MISSIONS: MISSIONS, PX_PER_KAN: PX_PER_KAN,
    _test: {
      set: function (k, v) { S[k] = v; syncControls(); refresh(); },
      scene: function (n) { stopPlay(); S.scene = n; syncControls(); refresh(); },
      pick: function (id) { pickMission(MISSIONS[id - 1]); },
      answer: function (i) { S.predictPick = i; S.missionState = "ready"; renderMissionBody(); refresh(); },
      goals: function () {
        if (!S.mission || !S.mission.goals) return null;
        return S.mission.goals.map(function (gg) { return [gg.key, checkGoal(gg.key)]; });
      },
      state: function () { return S.missionState; },
      records: function () { return records; },
      advance: function (dt) { advance(dt); refresh(); },
      geom: function () { return { wire: geomWire, coil: geomCoil, force: geomForce, motor: geomMotor, graph: geomGraph, w: cssW, h: cssH }; },
      draw: function () { draw(); drawGraph(); return true; }
    }
  };
})();
