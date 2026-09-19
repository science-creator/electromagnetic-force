/* =========================================================
   emforce.js — 전자기력(자기장 · 자기장 속 전류가 받는 힘 · 전동기) 계산 엔진
   ---------------------------------------------------------
   화면을 전혀 모른다. 숫자와 **방향**만 다룬다.

   ■ 이 엔진이 지키는 세 가지
     ① 전류가 흐르는 직선 도선 주위의 자기장은 **도선을 둘러싼 원**이고,
        전류가 (화면에서) 나오는 방향이면 **반시계**, 들어가는 방향이면 **시계** 방향이다.
        세기는 전류에 비례하고 도선에서 멀수록 약하다.        (오른손 엄지 = 전류, 감아쥔 손 = 자기장)
     ② 자기장 속 도선이 받는 힘의 **방향**은 전류와 자기장 방향이 정하고,
        **크기**는 전류와 자기장의 세기에 **비례**한다.
        전류·자기장 중 **하나만** 바꾸면 힘의 방향이 뒤집히고, **둘 다** 바꾸면 그대로다.
     ③ 전동기 : 코일의 두 변(AB · CD)은 전류의 방향이 서로 **반대**라 힘의 방향도 반대 → 코일이 **회전**한다.
        정류자가 반 바퀴마다 전류를 끊어 주어 코일은 **한 방향**으로 계속 돈다.

   ■ 방향을 정한 기준 (화면과 학습지가 모두 이 규칙을 쓴다)
        좌표      : 화면 오른쪽 = +x, 위쪽 = +y, 화면에서 나오는 방향 = +z
        전류 부호 : +1 = 화면에서 **나오는** 방향(⊙),  −1 = 화면으로 **들어가는** 방향(⊗)
        자석 부호 : +1 = N극이 **왼쪽**, S극이 오른쪽  →  자기장은 왼쪽에서 오른쪽(+x)으로
        힘        : F = I × B  →  (+z) × (+x) = (+y)  즉 **기본 구성(⊙ · N 왼쪽)이면 위쪽**.
        이 기본 구성은 선생님 학습지 「해보기」 표의 첫 칸(기본 구성 → 위쪽)과 같다.

   ⚠ 힘의 크기는 N 으로 내놓지 않는다. 학습지가 '비례한다'까지만 말하므로
     **칸(상대값) = 전류(A) × 자석 수**로만 보여 준다.
   ========================================================= */
(function (global) {
  "use strict";

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function round(v, n) { var p = Math.pow(10, n || 0); return Math.round(v * p) / p; }

  var VOLT = 6;            // V  — 전원 전압(고정). 저항을 바꿔 전류를 조절한다.
  var R_MIN = 1, R_MAX = 6;   // Ω  — 니크롬선 접점 위치로 바꾸는 저항
  var N_MIN = 1, N_MAX = 3;   // 자석 개수 = 자기장의 세기(상대값)
  var TURNS = 6;           // 코일 감은 수(그림용)

  /* ---------------------------------------------------------
     1. 전류
     --------------------------------------------------------- */
  /* 저항이 작을수록 전류가 크다 — 학습지 형성평가 「저항을 작게 해야 한다」 */
  function currentA(R, on) { return on === false ? 0 : VOLT / R; }

  /* ---------------------------------------------------------
     2. 전류가 만드는 자기장
     --------------------------------------------------------- */
  /* 직선 도선(위에서 본 그림). 나침반 N극이 가리키는 방향 — 도선 둘레의 접선.
     phi : 도선 중심에서 나침반이 있는 쪽의 각도(라디안, 수학 좌표: 반시계가 +)
     sign: +1 나오는 전류(⊙) → 반시계 / −1 들어가는 전류(⊗) → 시계
     돌려주는 값 : 나침반 N극이 가리키는 각도(수학 좌표) */
  function wireNeedleAngle(sign, phi) { return phi + sign * Math.PI / 2; }

  function wireCirculation(sign) { return sign > 0 ? "ccw" : "cw"; }

  /* 세기(상대값) ∝ 전류 / 거리 */
  function wireFieldRel(I, r) { return I / r; }

  /* 코일(옆에서 본 그림). sign +1 : 앞쪽 도선에서 전류가 아래로 흐른다.
     오른손을 감아쥘 때 엄지가 가리키는 쪽이 N극.  +1 → N극이 **오른쪽** */
  function coilPole(sign) { return sign > 0 ? "right" : "left"; }

  /* 코일 축 위에서 나침반 N극이 가리키는 방향(+x = 오른쪽): N극 쪽으로 향한다 */
  function coilAxisDir(sign) { return sign > 0 ? +1 : -1; }

  function coilFieldRel(I) { return I * TURNS; }

  /* ---------------------------------------------------------
     3. 자기장 속 도선이 받는 힘
        Isign : +1 나오는(⊙) / −1 들어가는(⊗)
        Bsign : +1 N극 왼쪽(자기장 →) / −1 N극 오른쪽(자기장 ←)
        돌려주는 값 : +1 위쪽 / −1 아래쪽
     --------------------------------------------------------- */
  function forceDir(Isign, Bsign) { return Isign * Bsign; }

  function forceName(dir) { return dir > 0 ? "위쪽" : "아래쪽"; }

  /* 힘의 크기(칸) ∝ 전류 × 자기장 세기 */
  function forceMag(I, n) { return I * n; }

  /* 전류·자기장 중 어느 하나만 바꾸면 뒤집히고, 둘 다 바꾸면 그대로인가 — 검증용 */
  function flipRuleHolds() {
    var base = forceDir(+1, +1);
    return forceDir(-1, +1) === -base && forceDir(+1, -1) === -base && forceDir(-1, -1) === base;
  }

  /* ---------------------------------------------------------
     4. 전동기
        코일의 두 변을 화면에 수직인 축에서 본 그림.
        AB : 각도 θ 의 자리(전류 Isign) · CD : 반대편(전류 −Isign).
        θ = 0 이면 AB 가 오른쪽 끝.
        AB 의 힘 = forceDir(Isign, Bsign) 방향(위/아래)이므로 θ=0 에서
        Isign·Bsign = +1 이면 AB 가 위로 밀려 **반시계** 로 돈다.
     --------------------------------------------------------- */
  function motorSpin(Isign, Bsign) { return Isign * Bsign; }      // +1 반시계 / −1 시계
  function spinName(s) { return s > 0 ? "반시계" : "시계"; }

  /* 정류자 : 전류가 흐르는 구간. 코일이 자기장에 수직인 자리 근처(|θ|<90°)에서만 흐른다.
     나머지 반 바퀴는 전류가 끊기고 코일은 관성으로 돈다(학습지 심화 활동 그대로). */
  function currentFlows(theta) { return Math.cos(theta) > 1e-9; }

  /* 회전 빠르기(라디안/초) — 전류 × 자석 수에 비례. 부호 = 회전 방향 */
  var OMEGA_PER_UNIT = 0.35;
  function omega(Isign, Bsign, I, n) { return motorSpin(Isign, Bsign) * OMEGA_PER_UNIT * forceMag(I, n); }

  /* 코일의 두 변이 받는 힘의 방향(위 +1 / 아래 −1) — 전류가 흐르는 동안만 */
  function sideForces(theta, Isign, Bsign) {
    if (!currentFlows(theta)) return { AB: 0, CD: 0 };
    var f = forceDir(Isign, Bsign);
    return { AB: f, CD: -f };            // 두 변의 전류가 반대라 힘도 반대
  }

  global.EmForce = {
    VOLT: VOLT, R_MIN: R_MIN, R_MAX: R_MAX, N_MIN: N_MIN, N_MAX: N_MAX, TURNS: TURNS,
    clamp: clamp, round: round,
    currentA: currentA,
    wireNeedleAngle: wireNeedleAngle, wireCirculation: wireCirculation, wireFieldRel: wireFieldRel,
    coilPole: coilPole, coilAxisDir: coilAxisDir, coilFieldRel: coilFieldRel,
    forceDir: forceDir, forceName: forceName, forceMag: forceMag, flipRuleHolds: flipRuleHolds,
    motorSpin: motorSpin, spinName: spinName, currentFlows: currentFlows,
    OMEGA_PER_UNIT: OMEGA_PER_UNIT, omega: omega, sideForces: sideForces
  };
})(window);
