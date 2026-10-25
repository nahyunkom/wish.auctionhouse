/*
 * Two touch moments that carry the work's question — what trace does an
 * invisible feeling leave? — into the diagnosis itself.
 *
 * 1. Depth passage (between "what you wish" and "how you grow it"):
 *    the visitor holds the wish with a fingertip. The point cloud gathers
 *    under the finger while it is held. The hold time is kept as a trace.
 * 2. Reveal (before the result): the visitor's own creature PNG lies under
 *    dark water and appears only where the hand clears it. The PNG file is
 *    shown untouched in an <img>; only an overlay canvas is erased.
 *
 * Both have a skip control and work with "움직임 멈춤" / reduced motion.
 */
const wishTrace = { holdMs: 0, revealStrokes: 0, revealMs: 0 };
let interactionCleanup = null;

function stopWishInteraction() {
  if (interactionCleanup) {
    const cleanup = interactionCleanup;
    interactionCleanup = null;
    cleanup();
  }
}

function resetWishTrace() {
  wishTrace.holdMs = 0;
  wishTrace.revealStrokes = 0;
  wishTrace.revealMs = 0;
}

function touchMembrane(x, y, pressure) {
  if (typeof window.wishMembraneTouch === 'function') window.wishMembraneTouch(x, y, pressure);
}

const HOLD_TARGET_MS = 2400;

function depthPassage(onDone) {
  setScene('passage', 6);
  app.innerHTML = `
    <section class="passage fade-in">
      <div class="passage-copy">
        <span class="overline">수심 1,500 M — 방향에서 방식으로</span>
        <h2>방금 고른 소망을,<br>손끝으로 잠시 붙잡아 보세요.</h2>
        <p>무엇을 바라는지 골랐어요. 어떻게 키울지 묻기 전에,<br>그 마음이 머무는 시간을 남겨 둡니다.</p>
      </div>
      <button class="hold-pad" id="hold-pad" aria-describedby="hold-status">
        <svg viewBox="0 0 200 200" aria-hidden="true"><circle class="hold-track" cx="100" cy="100" r="92"/><circle class="hold-ring" id="hold-ring" cx="100" cy="100" r="92" pathLength="100"/></svg>
        <span class="hold-core" aria-hidden="true"></span>
        <span class="hold-label" id="hold-label">여기를 누르고<br>기다려 주세요</span>
      </button>
      <p class="passage-status" id="hold-status" role="status" aria-live="polite">누르고 있는 동안, 주변의 입자가 당신의 손끝에 반응합니다.</p>
      <button class="text-button passage-skip" id="hold-skip">건너뛰고 다음 질문으로 →</button>
    </section>`;
  focusHeading();

  const pad = document.querySelector('#hold-pad');
  const ring = document.querySelector('#hold-ring');
  const label = document.querySelector('#hold-label');
  const status = document.querySelector('#hold-status');
  let held = 0;
  let holding = false;
  let finished = false;
  let last = 0;
  let raf = 0;
  let point = { x: 0, y: 0 };
  let doneTimer = 0;

  const draw = () => {
    const progress = Math.min(1, held / HOLD_TARGET_MS);
    ring.style.strokeDashoffset = String(100 - progress * 100);
    pad.style.setProperty('--hold', progress.toFixed(3));
  };
  const frame = now => {
    raf = 0;
    const dt = last ? Math.min(now - last, 60) : 0;
    last = now;
    if (holding) {
      held += dt;
      touchMembrane(point.x, point.y, 1 + Math.min(1, held / HOLD_TARGET_MS) * 1.6);
    } else {
      held = Math.max(0, held - dt * 0.6); // a released wish slowly fades, never resets at once
    }
    draw();
    if (!finished && held >= HOLD_TARGET_MS) return finish();
    if (holding || held > 0) raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };

  function finish() {
    finished = true;
    holding = false;
    wishTrace.holdMs = Math.max(wishTrace.holdMs, Math.round(held));
    pad.classList.add('is-complete');
    label.innerHTML = '빛이<br>남았어요';
    status.textContent = '당신이 머문 시간이 소망에 빛으로 남았어요. 이제 소망을 키우는 방식으로 내려갑니다.';
    doneTimer = window.setTimeout(() => { stopWishInteraction(); onDone(); }, motionPaused ? 400 : 1300);
  }

  const start = event => {
    if (finished) return;
    event.preventDefault();
    holding = true;
    point = { x: event.clientX, y: event.clientY };
    if (pad.setPointerCapture && event.pointerId !== undefined) {
      try { pad.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
    }
    pad.classList.add('is-holding');
    status.textContent = '그대로 조금만 더 머물러 주세요.';
    wake();
  };
  const move = event => { if (holding) point = { x: event.clientX, y: event.clientY }; };
  const end = () => {
    if (!holding || finished) return;
    holding = false;
    pad.classList.remove('is-holding');
    wishTrace.holdMs = Math.max(wishTrace.holdMs, Math.round(held));
    status.textContent = '손을 떼면 빛이 천천히 흩어져요. 다시 눌러 이어서 붙잡을 수 있어요.';
    wake();
  };
  // Keyboard and switch access: Space/Enter held down behaves like a press.
  const keyDown = event => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      const box = pad.getBoundingClientRect();
      start({ preventDefault() {}, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 });
    }
  };
  const keyUp = event => { if (event.key === ' ' || event.key === 'Enter') end(); };

  pad.addEventListener('pointerdown', start);
  pad.addEventListener('pointermove', move);
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('lostpointercapture', end);
  pad.addEventListener('keydown', keyDown);
  pad.addEventListener('keyup', keyUp);
  pad.addEventListener('contextmenu', event => event.preventDefault());
  document.querySelector('#hold-skip').onclick = () => { stopWishInteraction(); onDone(); };
  draw();

  interactionCleanup = () => {
    if (raf) cancelAnimationFrame(raf);
    window.clearTimeout(doneTimer);
    holding = false;
  };
}

const REVEAL_GRID = 28;
const REVEAL_DONE = 0.42;
const REVEAL_IDLE_MS = 14000;

function revealCreature(entry, onDone) {
  setScene('discovery', 9);
  app.innerHTML = `
    <section class="reveal fade-in">
      <div class="reveal-copy">
        <span class="overline">수심 8,000 M — 당신의 소망생물</span>
        <h2>보이지 않던 소망은,<br>손을 뻗을 때 모습을 드러냅니다.</h2>
        <p id="reveal-status" role="status" aria-live="polite">어두운 물을 손끝으로 천천히 걷어 내 보세요.</p>
        <button class="text-button" id="reveal-skip">바로 만나기 →</button>
      </div>
      <div class="reveal-tank" id="reveal-tank">
        <img class="reveal-creature" src="${entry.imageUrl}" alt="" decoding="async">
        <canvas class="reveal-ink" id="reveal-ink" aria-label="손끝으로 문질러 소망생물을 드러내는 어두운 물"></canvas>
        <div class="reveal-meter" aria-hidden="true"><i id="reveal-meter"></i></div>
      </div>
    </section>`;
  window.scrollTo({ top: 0, behavior: 'instant' });
  focusHeading();

  const tank = document.querySelector('#reveal-tank');
  const canvas = document.querySelector('#reveal-ink');
  const meter = document.querySelector('#reveal-meter');
  const status = document.querySelector('#reveal-status');
  const context = canvas.getContext('2d');
  const cleared = new Uint8Array(REVEAL_GRID * REVEAL_GRID);
  let clearedCount = 0;
  let size = { w: 1, h: 1, dpr: 1 };
  let drawing = false;
  let lastPoint = null;
  let finished = false;
  let idleTimer = 0;
  let doneTimer = 0;
  let firstTouch = 0;

  function paintInk() {
    const box = tank.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = { w: Math.max(1, box.width), h: Math.max(1, box.height), dpr };
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.globalCompositeOperation = 'source-over';
    const water = context.createRadialGradient(size.w / 2, size.h / 2, 10, size.w / 2, size.h / 2, Math.max(size.w, size.h) * 0.7);
    // Not fully opaque: the creature can be sensed, not yet seen.
    water.addColorStop(0, 'rgba(7,26,31,.9)');
    water.addColorStop(1, 'rgba(1,5,6,.95)');
    context.fillStyle = water;
    context.fillRect(0, 0, size.w, size.h);
    // A faint suspended silt so the water reads as water, not a black box.
    let seed = entry.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 900; i++) {
      context.fillStyle = `rgba(${120 + random() * 60},${190 + random() * 50},${200 + random() * 40},${0.05 + random() * 0.22})`;
      context.fillRect(random() * size.w, random() * size.h, 1 + random() * 1.4, 1 + random() * 1.4);
    }
    // Redraw strokes already made so a resize never undoes the visitor's trace.
    context.globalCompositeOperation = 'destination-out';
    const cellW = size.w / REVEAL_GRID, cellH = size.h / REVEAL_GRID;
    for (let i = 0; i < cleared.length; i++) if (cleared[i]) context.fillRect((i % REVEAL_GRID) * cellW, Math.floor(i / REVEAL_GRID) * cellH, cellW + 1, cellH + 1);
  }

  function brushAt(x, y) {
    const radius = Math.max(34, Math.min(size.w, size.h) * 0.085);
    context.globalCompositeOperation = 'destination-out';
    const brush = context.createRadialGradient(x, y, radius * 0.2, x, y, radius);
    brush.addColorStop(0, 'rgba(0,0,0,1)');
    brush.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = brush;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    const reach = radius * 0.7;
    const cellW = size.w / REVEAL_GRID, cellH = size.h / REVEAL_GRID;
    for (let gy = Math.max(0, Math.floor((y - reach) / cellH)); gy <= Math.min(REVEAL_GRID - 1, Math.floor((y + reach) / cellH)); gy++) {
      for (let gx = Math.max(0, Math.floor((x - reach) / cellW)); gx <= Math.min(REVEAL_GRID - 1, Math.floor((x + reach) / cellW)); gx++) {
        const cx = (gx + 0.5) * cellW - x, cy = (gy + 0.5) * cellH - y;
        const index = gy * REVEAL_GRID + gx;
        if (!cleared[index] && cx * cx + cy * cy <= reach * reach) { cleared[index] = 1; clearedCount++; }
      }
    }
    const ratio = clearedCount / cleared.length;
    meter.style.width = `${Math.min(100, ratio / REVEAL_DONE * 100).toFixed(1)}%`;
    if (ratio >= REVEAL_DONE) complete('touch');
  }

  function stroke(x, y) {
    if (lastPoint) {
      const dx = x - lastPoint.x, dy = y - lastPoint.y;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 14));
      for (let i = 1; i <= steps && !finished; i++) brushAt(lastPoint.x + dx * i / steps, lastPoint.y + dy * i / steps);
    } else brushAt(x, y);
    lastPoint = { x, y };
  }

  function local(event) {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function armIdle() {
    window.clearTimeout(idleTimer);
    if (!finished) idleTimer = window.setTimeout(() => complete('idle'), REVEAL_IDLE_MS);
  }

  function complete(reason) {
    if (finished) return;
    finished = true;
    drawing = false;
    window.clearTimeout(idleTimer);
    wishTrace.revealMs = firstTouch ? Math.round(performance.now() - firstTouch) : 0;
    tank.classList.add('is-revealed');
    status.textContent = reason === 'touch' ? '당신의 손끝에서 소망생물이 깨어났어요.' : '물이 스스로 맑아지며 소망생물이 모습을 드러내요.';
    doneTimer = window.setTimeout(() => { stopWishInteraction(); onDone(); }, motionPaused ? 500 : 1500);
  }

  const down = event => {
    if (finished) return;
    event.preventDefault();
    drawing = true;
    if (!firstTouch) firstTouch = performance.now();
    wishTrace.revealStrokes += 1;
    lastPoint = null;
    try { canvas.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
    const point = local(event);
    stroke(point.x, point.y);
    touchMembrane(event.clientX, event.clientY, 1.4);
    armIdle();
  };
  const move = event => {
    if (!drawing || finished) return;
    const point = local(event);
    stroke(point.x, point.y);
    touchMembrane(event.clientX, event.clientY, 1.1);
  };
  const up = () => { drawing = false; lastPoint = null; };

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  const onResize = () => { if (!finished) paintInk(); };
  window.addEventListener('resize', onResize);
  document.querySelector('#reveal-skip').onclick = () => {
    window.clearTimeout(idleTimer);
    window.clearTimeout(doneTimer);
    finished = true;
    stopWishInteraction();
    onDone();
  };
  paintInk();
  armIdle();

  interactionCleanup = () => {
    finished = true;
    window.clearTimeout(idleTimer);
    window.clearTimeout(doneTimer);
    window.removeEventListener('resize', onResize);
  };
}
