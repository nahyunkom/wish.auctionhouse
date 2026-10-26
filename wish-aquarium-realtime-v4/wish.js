/*
 * 소망경매장 — the wish journey.
 * One question per screen, a glass bar at the bottom, a particle sculpture in the
 * middle. Results are only the 438 real catalog pairs (PNG + video URL).
 */
(function () {
  'use strict';
  const C = window.WishCore, CAT = window.WishCatalog, F = window.WishField;
  const config = window.WISH_AQUARIUM_CONFIG || {};
  const $ = s => document.querySelector(s);
  const view = $('#view'), bar = $('#bar'), progressEl = $('#progress');
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TOTAL = 7;

  let S = fresh();
  let timers = [];
  let lastEntry = null;   // this visit's creature, for "내 소망생물"

  function fresh() {
    return { wishes: [], moment: '', way: null, candidates: [], ci: 0, entry: null, hours: [], years: 0, message: '',
      recordId: uid(), releaseId: uid(), recorded: false, released: false, stats: null, dataPage: 0 };
  }
  function uid() { return (crypto.randomUUID ? crypto.randomUUID() : 'w-' + Date.now() + '-' + Math.random().toString(16).slice(2)); }
  function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // ---------- layout ----------
  function render({ keepFigure = false, step = 0, title = '', body = '', back = null, next = null, nextLabel = '다음으로', nextReady = true, cls = '', field = { type: 'orb', scale: 1, dim: 1, rings: 0 }, barHidden = false }) {
    clearTimers();
    if (!keepFigure) figure(null);
    document.body.dataset.screen = cls || 'plain';
    progressEl.textContent = step ? step + ' / ' + TOTAL : '';
    view.innerHTML = '<section class="screen ' + cls + '">' + (title ? '<h1 class="ask">' + title + '</h1>' : '') + body + '<div class="tail" aria-hidden="true"></div></section>';
    F.set(Object.assign({ type: 'orb', scale: 1, dim: 1, rings: 0, y: .47 }, field));
    bar.hidden = barHidden;
    bar.innerHTML = (back ? '<button class="bar-back" id="bar-back" aria-label="이전으로">«</button>' : '') +
      (next ? '<button class="bar-next" id="bar-next"' + (nextReady ? '' : ' disabled') + '><span>' + esc(nextLabel) + '</span><span aria-hidden="true">»</span></button>' : '');
    if (back) $('#bar-back').onclick = back;
    if (next) $('#bar-next').onclick = () => { if (!$('#bar-next').disabled) next(); };
    const h = view.querySelector('h1,h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }
  const ready = v => { const b = $('#bar-next'); if (b) b.disabled = !v; };

  // Typed dialogue lines, as if someone in the water were speaking.
  function typeLines(el, lines, done) {
    const text = lines.join('\n'); let i = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.innerHTML = esc(text).replace(/\n/g, '<br>'); done && done(); return; }
    const tick = () => {
      i++;
      el.innerHTML = esc(text.slice(0, i)).replace(/\n/g, '<br>') + '<span class="caret">|</span>';
      if (i < text.length) later(tick, text[i - 1] === '\n' ? 260 : 55);
      else { later(() => { const c = el.querySelector('.caret'); if (c) c.remove(); }, 1400); done && done(); }
    };
    tick();
  }

  // ---------- 0. title ----------
  function title() {
    S = fresh();
    render({ cls: 'title', field: { type: 'orb', scale: 1.15, dim: .9 },
      body: '<div class="title-block"><p class="title-en">What<br>Lives In<br>Your<br>Wish?</p><p class="title-ko">당신의 소망은<br>살아 있나요?</p><p class="title-sub">《소망경매장》 심해 수족관</p></div>',
      next: menu, nextLabel: '시작하기' });
  }

  // ---------- menu ----------
  function menu() {
    render({ cls: 'menu', field: { type: 'orb', scale: 1.2, dim: .45 },
      body: '<nav class="menu-grid" aria-label="소망경매장">' +
        tile('m-new', 'wide', '소망생물 만나기', '마음에 품은 소망을 깨워 봅시다') +
        tile('m-mine', lastEntry ? '' : 'off', '내 소망생물', '오늘 만난 생물과 맞춤 데이터') +
        tile('m-data', '', '소망 데이터', '기록된 소망들을 살펴봐요') +
        tile('m-guide', '', '생물 도감', '수족관의 소망생물 438종') +
        tile('m-tank', '', '공유수족관', '모두의 생물이 사는 바다') +
        '</nav>',
      back: title, next: title, nextLabel: '처음으로' });
    $('#m-new').onclick = hello;
    if (lastEntry) $('#m-mine').onclick = () => { S.entry = lastEntry; card(true); };
    $('#m-data').onclick = () => report(0);
    $('#m-guide').onclick = () => guide(0);
    $('#m-tank').onclick = () => { location.href = 'shared-aquarium'; };
  }
  function tile(id, cls, t, d) { return '<button class="tile ' + cls + '" id="' + id + '"' + (cls === 'off' ? ' disabled' : '') + '><strong>' + t + '</strong><small>' + d + '</small></button>'; }

  // ---------- greeting ----------
  function hello() {
    S = fresh();
    render({ cls: 'talk', field: { type: 'orb', scale: .9, dim: .7 },
      body: '<p class="talk-line" id="talk"></p><div class="pair" id="pair" hidden><button class="chip" id="yes">예</button><button class="chip" id="no">아니오</button></div>',
      back: menu });
    typeLines($('#talk'), ['안녕하세요?'], () => { $('#pair').hidden = false; });
    $('#yes').onclick = () => intro(['반가워요.', '이제 당신의 소망을 깨울 차례입니다.']);
    $('#no').onclick = () => intro(['괜찮아요. 천천히 들어가 볼게요.', '이제 당신의 소망을 깨울 차례입니다.']);
  }
  function intro(lines) {
    render({ cls: 'talk', field: { type: 'orb', scale: 1, dim: .8 },
      body: '<p class="talk-line" id="talk"></p><p class="foot-note">이 수족관의 소망생물과 진단은 전시를 위한 창작이며, 심리검사가 아닙니다.</p>',
      back: hello, next: wishes, nextReady: false });
    typeLines($('#talk'), lines, () => ready(true));
  }

  // ---------- 1. wishes ----------
  function wishes() {
    const chips = C.wishTypes.map(w => '<button class="chip' + (S.wishes.includes(w) ? ' on' : '') + '" data-wish="' + esc(w) + '">' + esc(C.WISH_LABELS[w]) + '</button>').join('');
    render({ step: 1, cls: 'pick', field: { type: 'orb', scale: 1.15, dim: .35 },
      title: '지금, 어떤 소망을 품고 있나요?<br><small>세 개까지 고를 수 있어요. 처음 고른 소망이 당신의 생물이 됩니다.</small>',
      body: '<div class="chip-cloud" id="cloud">' + chips + '</div>',
      back: menu, next: moment, nextReady: S.wishes.length > 0 });
    view.querySelectorAll('[data-wish]').forEach(b => b.onclick = () => {
      const w = b.dataset.wish, i = S.wishes.indexOf(w);
      if (i >= 0) S.wishes.splice(i, 1); else if (S.wishes.length < C.MAX_WISHES) S.wishes.push(w);
      view.querySelectorAll('[data-wish]').forEach(x => { const k = S.wishes.indexOf(x.dataset.wish); x.classList.toggle('on', k >= 0); x.classList.toggle('first', k === 0); });
      ready(S.wishes.length > 0);
    });
    view.querySelectorAll('[data-wish]').forEach(x => x.classList.toggle('first', S.wishes[0] === x.dataset.wish));
  }

  // ---------- 2. moment ----------
  function moment() {
    render({ step: 2, cls: 'write', field: { type: 'orb', scale: 1.1, dim: .4 },
      title: '이 소망이 간절했던 순간이 있었나요?<br><small>짧게 적어 주세요. 이 글은 저장되지 않아요.</small>',
      body: '<div class="chosen">' + S.wishes.map(w => '<span class="chip on">' + esc(C.WISH_LABELS[w]) + '</span>').join('') + '</div>' +
        '<label class="sr" for="moment">소망이 간절했던 순간</label><textarea id="moment" class="glass-input" maxlength="' + C.MAX_MOMENT + '" placeholder="(선택) 자유롭게 입력해 주세요.">' + esc(S.moment) + '</textarea><p class="count"><span id="mc">' + S.moment.length + '</span> / ' + C.MAX_MOMENT + '</p>',
      back: wishes, next: way });
    $('#moment').oninput = e => { S.moment = e.target.value; $('#mc').textContent = S.moment.length; };
  }

  // ---------- 3. way ----------
  function way() {
    const avail = C.waysFor(S.wishes[0]);
    if (S.way !== null && !avail.includes(S.way)) S.way = null;
    render({ step: 3, cls: 'pick', field: { type: 'orb', scale: 1, dim: .4 },
      title: '이 소망을 어떻게 키워 가나요?<br><small>가장 자연스러운 하나를 골라 주세요.</small>',
      body: '<div class="way-list">' + avail.map(i => '<button class="chip way' + (S.way === i ? ' on' : '') + '" data-way="' + i + '"><b>' + esc(C.WAYS[i].label) + '</b>' + esc(C.WAYS[i].line) + '</button>').join('') + '</div>',
      back: moment, next: () => { S.candidates = C.creaturesFor(S.wishes[0], S.way); S.ci = 0; forming(); }, nextReady: S.way !== null });
    view.querySelectorAll('[data-way]').forEach(b => b.onclick = () => {
      S.way = Number(b.dataset.way);
      view.querySelectorAll('[data-way]').forEach(x => x.classList.toggle('on', Number(x.dataset.way) === S.way));
      ready(true);
    });
  }

  // ---------- 4. the creature forms ----------
  // The creature's real image surfaces inside the particle form. It lives in the
  // stage (behind the UI) so it can blend with the light of the water.
  function figure(entry, show) {
    let img = document.getElementById('figure');
    if (!entry) { if (img) img.remove(); return; }
    const R = Math.min(innerWidth, innerHeight) * .34, box = R * 1.5;
    if (!img) { img = document.createElement('img'); img.id = 'figure'; img.className = 'figure'; img.alt = ''; document.getElementById('stage').appendChild(img); }
    if (img.dataset.id !== entry.id) { img.classList.remove('show'); img.src = entry.imageUrl; img.dataset.id = entry.id; }
    img.style.width = box + 'px'; img.style.height = box + 'px';
    if (show) requestAnimationFrame(() => img.classList.add('show'));
  }
  function forming() {
    S.entry = S.candidates[S.ci % S.candidates.length];
    render({ keepFigure: true, step: 4, cls: 'form', field: { type: 'creature', scale: 1, dim: 1 },
      title: '소망생물이 깨어나고 있어요.<br><small>잠시만 기다려 주세요.</small>',
      body: '<div class="meter"><i id="meter"></i></div>', back: way });
    figure(S.entry, false);
    F.form(S.entry);
    const m = $('#meter'); requestAnimationFrame(() => { m.style.width = '100%'; });
    later(() => figure(S.entry, true), 3600);
    later(formed, 5200);
  }
  function formed() {
    const e = S.entry;
    render({ keepFigure: true, step: 4, cls: 'form', field: { type: 'creature', scale: 1, dim: 1 },
      title: '당신의 소망생물이 깨어났어요.<br><small>이 모습이 마음에 드나요?</small>',
      body: '<p class="form-caption">' + esc(C.WAYS[e.wayIndex].label) + ' · ' + esc(C.METHOD_LINES[e.methodType] || e.methodType) + '</p>' +
        '<div class="pair low">' + (S.candidates.length > 1 ? '<button class="chip" id="reform">형태 바꾸기</button>' : '') + '<button class="chip on" id="like">좋아요</button></div>',
      back: way, next: hours, nextReady: true });
    figure(e, true);
    const r = $('#reform'); if (r) r.onclick = () => { S.ci++; F.flare(); forming(); };
    $('#like').onclick = hours;
  }

  // ---------- 5. hours (dial) ----------
  function hours() {
    const R1 = 230, R0 = 150, seg = [];
    for (let i = 0; i < 24; i++) {
      const a0 = (i - .5) / 24 * Math.PI * 2 - Math.PI / 2, a1 = (i + .5) / 24 * Math.PI * 2 - Math.PI / 2, g = .006;
      const p = (r, a) => (250 + r * Math.cos(a)).toFixed(1) + ' ' + (250 + r * Math.sin(a)).toFixed(1);
      const am = (a0 + a1) / 2, h12 = i % 12 === 0 ? 12 : i % 12;
      seg.push('<g class="hour' + (S.hours.includes(i) ? ' on' : '') + '" data-h="' + i + '"><path d="M' + p(R0, a0 + g) + ' L' + p(R1, a0 + g) + ' A' + R1 + ' ' + R1 + ' 0 0 1 ' + p(R1, a1 - g) + ' L' + p(R0, a1 - g) + ' A' + R0 + ' ' + R0 + ' 0 0 0 ' + p(R0, a0 + g) + 'Z"/>' +
        '<text x="' + (250 + 190 * Math.cos(am)).toFixed(1) + '" y="' + (250 + 190 * Math.sin(am)).toFixed(1) + '"><tspan class="ap" x="' + (250 + 190 * Math.cos(am)).toFixed(1) + '" dy="-7">' + (i < 12 ? '오전' : '오후') + '</tspan><tspan x="' + (250 + 190 * Math.cos(am)).toFixed(1) + '" dy="16">' + h12 + '</tspan></text></g>');
    }
    render({ step: 5, cls: 'dial-screen', field: { type: 'creature', scale: .52, dim: 1, y: .5 },
      title: '하루 중 언제 이 소망을 떠올리나요?<br><small>시간을 눌러 끌어 주세요.</small>',
      body: '<svg class="dial" id="dial" viewBox="0 0 500 500" role="group" aria-label="24시간 다이얼">' + seg.join('') + '</svg>',
      back: formed, next: years, nextReady: S.hours.length > 0 });
    const dial = $('#dial'); let paint = null;
    const hourAt = ev => { const el = document.elementFromPoint(ev.clientX, ev.clientY); const g = el && el.closest && el.closest('[data-h]'); return g ? Number(g.dataset.h) : null; };
    const apply = h => {
      if (h === null) return;
      const i = S.hours.indexOf(h);
      if (paint === 'add' && i < 0) S.hours.push(h);
      if (paint === 'remove' && i >= 0) S.hours.splice(i, 1);
      dial.querySelector('[data-h="' + h + '"]').classList.toggle('on', S.hours.includes(h));
      ready(S.hours.length > 0);
    };
    dial.addEventListener('pointerdown', ev => { const h = hourAt(ev); if (h === null) return; paint = S.hours.includes(h) ? 'remove' : 'add'; try { dial.setPointerCapture(ev.pointerId); } catch (_) {} apply(h); });
    dial.addEventListener('pointermove', ev => { if (paint) apply(hourAt(ev)); });
    const stop = () => { paint = null; };
    dial.addEventListener('pointerup', stop); dial.addEventListener('pointercancel', stop);
  }

  // ---------- 6. years (stepper) ----------
  function years() {
    render({ step: 6, cls: 'stepper-screen', field: { type: 'creature', scale: .62, dim: 1, rings: S.years, y: .44 },
      title: '이 소망을 얼마나 오래 품어 왔나요?',
      body: '<div class="stepper"><button class="round" id="minus" aria-label="줄이기">−</button><output id="yv" aria-live="polite">' + esc(C.YEARS[S.years]) + '</output><button class="round" id="plus" aria-label="늘리기">+</button></div>',
      back: hours, next: message });
    const upd = d => { S.years = Math.max(0, Math.min(11, S.years + d)); $('#yv').textContent = C.YEARS[S.years]; $('#minus').disabled = S.years === 0; $('#plus').disabled = S.years === 11; F.set({ rings: S.years }); };
    $('#minus').onclick = () => upd(-1); $('#plus').onclick = () => upd(1); upd(0);
  }

  // ---------- 7. message ----------
  function message() {
    render({ step: 7, cls: 'write', field: { type: 'creature', scale: .62, dim: .9, rings: S.years, y: .4 },
      title: '같은 소망을 품은 누군가에게<br>전하고 싶은 말이 있나요?',
      body: '<label class="sr" for="msg">전하고 싶은 말</label><textarea id="msg" class="glass-input low" maxlength="' + C.MAX_MESSAGE + '" placeholder="(선택) 자유롭게 입력해 주세요.">' + esc(S.message) + '</textarea><p class="count"><span id="gc">' + S.message.length + '</span> / ' + C.MAX_MESSAGE + ' · 남긴 말은 이름 없이 다른 관람객에게 보여져요.</p>',
      back: years, next: finishing });
    $('#msg').oninput = e => { S.message = e.target.value; $('#gc').textContent = S.message.length; };
  }

  // ---------- finishing ----------
  function finishing() {
    render({ step: 7, cls: 'form', field: { type: 'creature', scale: 1, dim: 1, rings: S.years },
      title: '이제 소망생물이 거의 다 깨어났어요.',
      body: '<div class="meter"><i id="meter"></i></div>', barHidden: true });
    const m = $('#meter'); requestAnimationFrame(() => { m.style.width = '100%'; });
    record();
    later(() => { F.flare(); card(false); }, 3200);
  }

  // ---------- result card ----------
  function stamp(d) { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); }
  function hoursText(list) {
    if (!list.length) return '—';
    const am = list.filter(h => h < 12).map(h => h === 0 ? 12 : h), pm = list.filter(h => h >= 12).map(h => h === 12 ? 12 : h - 12);
    return [am.length ? '오전 ' + am.join(', ') + '시' : '', pm.length ? '오후 ' + pm.join(', ') + '시' : ''].filter(Boolean).join(' · ');
  }
  function card(fromMenu) {
    const e = S.entry; lastEntry = e;
    const facts = [
      ['소망', esc(C.WISH_LABELS[e.wishType] || e.wishType) + '<span class="sub">' + esc(e.wishCategory) + ' · ' + esc(e.wishType) + '</span>'],
      ['키우는 방식', esc(C.WAYS[e.wayIndex].label) + '<span class="sub">' + esc(C.METHOD_LINES[e.methodType] || e.methodType) + '</span>']
    ];
    if (S.wishes.length > 1) facts.push(['함께 품은 소망', S.wishes.slice(1).map(w => esc(C.WISH_LABELS[w])).join(' · ')]);
    if (S.moment.trim()) facts.push(['간절했던 순간', esc(S.moment.trim())]);
    if (!fromMenu) {
      facts.push(['품어 온 시간', esc(C.YEARS[S.years])]);
      facts.push(['떠올리는 시간', esc(hoursText(S.hours))]);
    }
    facts.push(['깨어난 시각', stamp(new Date())]);
    render({ cls: 'card-screen', field: { type: 'orb', scale: 1.4, dim: .25 },
      body: '<article class="wish-card"><p class="quote-en">What you hold long enough comes alive.</p><p class="quote-ko">오래 품은 마음은, 살아 있다.</p>' +
        '<div class="card-body"><div class="card-tank"><video id="vid" poster="' + esc(e.imageUrl) + '" muted autoplay loop playsinline preload="metadata"><source src="' + esc(e.videoUrl) + '" type="video/mp4"></video></div>' +
        '<div class="card-facts"><h2 class="facts-title">Wish Facts <span>' + esc(e.id) + '</span></h2><dl class="facts">' + facts.map(f => '<div><dt>' + f[0] + '</dt><dd>' + f[1] + '</dd></div>').join('') + '</dl><div class="pair card-actions"><button class="chip on" id="release">' + (S.released ? '수족관에서 헤엄치는 중 ✓' : '공유수족관에 방류하기') + '</button><button class="chip" id="save">이미지로 저장 ↓</button><button class="chip" id="share">공유하기</button></div><p class="status" id="status" role="status" aria-live="polite"></p></div></div></article>',
      back: fromMenu ? menu : null, next: fromMenu ? menu : afterCard, nextLabel: fromMenu ? '메뉴로' : '다음으로' });
    const v = $('#vid'); v.muted = true; v.play().catch(() => {});
    $('#save').onclick = () => saveImage(false);
    $('#share').onclick = () => saveImage(true);
    $('#release').onclick = release;
    if (S.released) $('#release').disabled = true;
    view.scrollTop = 0;
  }
  const status = (t, s) => { const el = $('#status'); if (el) { el.textContent = t; el.dataset.state = s || ''; } };

  async function originalBlob() {
    const r = await fetch(S.entry.imageUrl);
    if (!r.ok) throw new Error('image');
    return r.blob();   // the original PNG bytes, unchanged
  }
  function download(blob, name) {
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  async function saveImage(share) {
    try {
      const blob = await originalBlob(), name = '소망경매장_' + S.entry.id + '.png';
      const file = new File([blob], name, { type: 'image/png' });
      let can = false; try { can = share && !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch (_) { can = false; }
      if (can) {
        try { await navigator.share({ files: [file], title: '나의 소망생물', text: '소망경매장에서 깨어난 나의 소망생물' }); status('공유 메뉴로 보냈어요.', 'ok'); return; }
        catch (err) { if (err && err.name === 'AbortError') return; }
      }
      download(blob, name); status('원본 이미지를 저장했어요.', 'ok');
    } catch (_) { status('이미지를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'err'); }
  }

  // ---------- release ----------
  let socket = null;
  function connect() {
    return new Promise(resolve => {
      if (socket && socket.connected) { resolve(socket); return; }
      const base = String(config.socketUrl || '').replace(/\/$/, '');
      const go = () => { if (!window.io) { resolve(null); return; } socket = socket || (base ? window.io(base) : window.io()); if (socket.connected) resolve(socket); else { socket.once('connect', () => resolve(socket)); setTimeout(() => resolve(socket.connected ? socket : null), 8000); } };
      if (window.io) go(); else { const s = document.createElement('script'); s.src = base + '/socket.io/socket.io.js'; s.onload = go; s.onerror = () => resolve(null); document.head.appendChild(s); }
    });
  }
  async function release() {
    if (S.released) return;
    const btn = $('#release'); btn.disabled = true; status('수족관으로 보내고 있어요…', '');
    const sock = await connect();
    if (!sock) { btn.disabled = false; status('수족관과 연결되지 않았어요. 잠시 뒤 다시 눌러 주세요.', 'err'); return; }
    sock.timeout(8000).emit('creature:release', { catalogId: S.entry.id, clientReleaseId: S.releaseId }, (err, res) => {
      if (err || !res || !res.ok) { btn.disabled = false; status((res && res.message) || '방류하지 못했어요. 다시 시도해 주세요.', 'err'); return; }
      S.released = true; const b = $('#release'); if (b) { b.textContent = '수족관에서 헤엄치는 중 ✓'; b.disabled = true; }
      status('방류했어요. 수족관 화면에서 빛 속에 깨어나요.', 'ok'); F.flare();
    });
  }

  // ---------- anonymous record + stats ----------
  function record() {
    if (S.recorded || !S.entry) return Promise.resolve();
    S.recorded = true;
    return fetch('api/wish-records', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId: S.recordId, catalogId: S.entry.id, wishTypes: S.wishes, hours: S.hours, years: S.years, message: S.message }) }).catch(() => {});
  }
  async function stats(wishType) {
    try { const r = await fetch('api/wish-stats' + (wishType ? '?wishType=' + encodeURIComponent(wishType) : ''), { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (_) {}
    return null;
  }

  // ---------- after: personal data ----------
  function afterCard() {
    render({ cls: 'talk', field: { type: 'orb', scale: 1, dim: .6 },
      body: '<p class="talk-line" id="talk"></p><div class="pair" id="pair" hidden><button class="chip on" id="see">맞춤 데이터 보기 »</button></div><p class="foot-note" id="scope"></p>',
      back: () => card(false) });
    typeLines($('#talk'), ['소망생물이 깨어났어요.', '당신과 같은 소망을 품은 사람들은', '어떤 마음이었을까요?'], () => { $('#pair').hidden = false; });
    stats(S.entry.wishType).then(d => { S.stats = d; const n = $('#scope'); if (n && d) n.textContent = d.total ? (d.since ? dateK(d.since) + ' 부터 ' : '') + '기록된 ' + d.total.toLocaleString() + '개의 소망을 바탕으로 한 통계입니다.' : ''; });
    $('#see').onclick = () => personal(0);
  }
  const dateK = iso => { const d = new Date(iso); return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'); };

  async function personal(page) {
    if (!S.stats) S.stats = await stats(S.entry.wishType);
    const d = S.stats, pages = [pBubbles, pWays, pHours, pMessages];
    if (!d) { render({ cls: 'data', title: '데이터를 불러오지 못했어요.', body: '<p class="foot-note">네트워크를 확인한 뒤 다시 시도해 주세요.</p>', back: afterCard, next: farewell }); return; }
    page = Math.max(0, Math.min(pages.length - 1, page));
    pages[page](d, page, pages.length);
  }
  function dataScreen(kicker, head, body, page, count, backFn, nextFn) {
    render({ cls: 'data', field: { type: 'orb', scale: 1.5, dim: .18 },
      body: '<p class="kicker">' + kicker + '</p><h1 class="data-title">' + head + '</h1><div class="viz">' + body + '</div>',
      back: backFn, next: nextFn });
  }
  function pBubbles(d, page, count) {
    const wishName = S.entry.wishType;
    dataScreen('사람들이 가장 많이 품은', '소망', bubbles(d.wishes, d.total, wishName), page, count, afterCard, () => personal(page + 1));
  }
  function pWays(d, page, count) {
    const total = d.ways.reduce((a, b) => a + b, 0);
    dataScreen('같은 소망을 품은 ' + d.sameCount.toLocaleString() + '명이 고른', '소망을 키우는 방식', lollipop(C.WAYS.map((w, i) => ({ label: w.label, value: d.ways[i], mine: i === S.entry.wayIndex })), total), page, count, () => personal(page - 1), () => personal(page + 1));
  }
  function pHours(d, page, count) {
    dataScreen('같은 소망을 품은 사람들이', '소망을 떠올리는 시간', radialHours(d.hours, S.hours) + '<p class="legend">점 하나가 한 번의 기록입니다. 밝은 점은 당신이 고른 시간이에요.</p>', page, count, () => personal(page - 1), () => personal(page + 1));
  }
  function pMessages(d, page, count) {
    const list = d.messages.length ? d.messages.map((m, i) => '<p class="bubble ' + (i % 2 ? 'r' : 'l') + '">' + esc(m) + '</p>').join('') : '<p class="foot-note">아직 남겨진 말이 없어요. 당신의 말이 첫 번째가 됩니다.</p>';
    dataScreen('같은 소망을 품은 사람들이 남긴', '전하고 싶은 말', '<div class="bubbles">' + list + '</div>', page, count, () => personal(page - 1), farewell);
  }

  // ---------- particle-styled infographics (SVG) ----------
  function bubbles(list, total, mine) {
    const top = list.slice(0, 16);
    if (!top.length) return '<p class="foot-note">아직 기록된 소망이 없어요.</p>';
    const max = top[0].count, placed = [];
    const W = 900, H = 640;
    for (const it of top) {
      const r = 46 + 74 * Math.sqrt(it.count / max);
      if (!placed.length) { placed.push({ x: W / 2, y: H / 2, r, it }); continue; }
      let best = null;
      for (const p of placed) for (let k = 0; k < 36; k++) {
        const a = k / 36 * Math.PI * 2, x = p.x + Math.cos(a) * (p.r + r + 4), y = p.y + Math.sin(a) * (p.r + r + 4);
        if (placed.some(q => Math.hypot(q.x - x, q.y - y) < q.r + r + 3)) continue;
        const dist = Math.hypot(x - W / 2, (y - H / 2) * 1.25);
        if (!best || dist < best.d) best = { x, y, d: dist };
      }
      if (best) placed.push({ x: best.x, y: best.y, r, it });
    }
    const minX = Math.min(...placed.map(p => p.x - p.r)), maxX = Math.max(...placed.map(p => p.x + p.r));
    const minY = Math.min(...placed.map(p => p.y - p.r)), maxY = Math.max(...placed.map(p => p.y + p.r));
    const cells = placed.map(p => {
      const pct = total ? (p.it.count / total * 100) : 0, on = p.it.name === mine, label = C.WISH_LABELS[p.it.name] || p.it.name;
      return '<g class="bub' + (on ? ' mine' : '') + '"><circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + p.r.toFixed(1) + '"/>' +
        '<foreignObject x="' + (p.x - p.r * .8).toFixed(1) + '" y="' + (p.y - p.r * .55).toFixed(1) + '" width="' + (p.r * 1.6).toFixed(1) + '" height="' + (p.r * 1.1).toFixed(1) + '"><div xmlns="http://www.w3.org/1999/xhtml" class="bub-text"><span>' + esc(label) + '</span><b>' + pct.toFixed(1) + '%</b></div></foreignObject></g>';
    }).join('');
    return '<svg class="bubble-chart" viewBox="' + [minX - 10, minY - 10, maxX - minX + 20, maxY - minY + 20].map(v => v.toFixed(0)).join(' ') + '"><defs><pattern id="dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1" fill="rgba(170,220,255,.28)"/></pattern></defs>' + cells + '</svg>';
  }
  function lollipop(rows, total) {
    const max = Math.max(1, ...rows.map(r => r.value));
    return '<div class="lolli">' + rows.slice().sort((a, b) => b.value - a.value).map(r => {
      const pct = total ? r.value / total * 100 : 0, wpx = 6 + 300 * r.value / max;
      return '<div class="lrow' + (r.mine ? ' mine' : '') + '"><span class="lstart"></span><span class="lline" style="width:' + wpx.toFixed(0) + 'px"></span><span class="lend"></span><span class="llab">' + esc(r.label) + ' ' + pct.toFixed(0) + '%</span></div>';
    }).join('') + '</div>';
  }
  function radialHours(hoursCount, mine) {
    const max = Math.max(1, ...hoursCount), dots = [], labels = [];
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2 - Math.PI / 2, n = Math.round(hoursCount[i] / max * 12);
      for (let k = 0; k < n; k++) { const r = 70 + k * 13; dots.push('<circle class="' + (mine.includes(i) ? 'mine' : '') + '" cx="' + (250 + r * Math.cos(a)).toFixed(1) + '" cy="' + (250 + r * Math.sin(a)).toFixed(1) + '" r="4"/>'); }
      if (i % 3 === 0) labels.push('<text x="' + (250 + 238 * Math.cos(a)).toFixed(1) + '" y="' + (250 + 238 * Math.sin(a) + 4).toFixed(1) + '">' + (i < 12 ? '오전 ' : '오후 ') + (i % 12 === 0 ? 12 : i % 12) + '</text>');
    }
    return '<svg class="radial" viewBox="0 0 500 500"><circle class="axis" cx="250" cy="250" r="60"/>' + dots.join('') + labels.join('') + '</svg>';
  }

  // ---------- overall report (menu) ----------
  async function report(page) {
    const d = await stats('');
    if (!d) { render({ cls: 'data', title: '데이터를 불러오지 못했어요.', back: menu, next: menu, nextLabel: '메뉴로' }); return; }
    const pages = [
      () => dataScreen('지금까지', d.total.toLocaleString() + '개의 소망이<br>기록되었습니다.', '<canvas class="pile" id="pile" width="900" height="560"></canvas>' + (d.since ? '<p class="legend">' + dateK(d.since) + ' 부터 기록된 소망</p>' : ''), 0, 3, menu, () => report(1)),
      () => dataScreen('사람들이 가장 많이 품은', '소망', bubbles(d.wishes, d.total, ''), 1, 3, () => report(0), () => report(2)),
      () => dataScreen('모든 기록에서', '소망을 키우는 방식', lollipop(C.WAYS.map((w, i) => ({ label: w.label, value: d.ways[i] })), d.ways.reduce((a, b) => a + b, 0)), 2, 3, () => report(1), menu)
    ];
    pages[Math.max(0, Math.min(2, page))]();
    if (page === 0) pile($('#pile'), d.total);
  }
  // Dots fall and settle into a pile: one dot per record (capped for drawing).
  function pile(cv, total) {
    if (!cv) return;
    const g = cv.getContext('2d'), n = Math.min(total, 360), r = 9, cols = Math.floor(cv.width / (r * 2)), heights = Array(cols).fill(0), drops = [];
    for (let i = 0; i < n; i++) { let c = Math.floor(cols / 2 + (Math.random() + Math.random() + Math.random() - 1.5) * cols * .45); c = Math.max(0, Math.min(cols - 1, c)); drops.push({ c, y: -20 - i * 9, vy: 0, done: false, hue: i % 3 }); }
    const cols3 = ['rgba(130,235,225,.9)', 'rgba(180,195,255,.9)', 'rgba(245,185,225,.9)'];
    const tick = () => {
      if (!document.body.contains(cv)) return;
      g.clearRect(0, 0, cv.width, cv.height); let moving = false;
      for (const d of drops) {
        const floor = cv.height - r - heights[d.c] * r * 1.75;
        if (!d.done) { d.vy += .5; d.y += d.vy; if (d.y >= floor) { d.y = floor; d.done = true; heights[d.c]++; } else moving = true; }
        g.fillStyle = cols3[d.hue]; g.beginPath(); g.arc(d.c * r * 2 + r + (heights[d.c] % 2 ? 0 : 0), d.y, r * .82, 0, Math.PI * 2); g.fill();
      }
      if (moving) requestAnimationFrame(tick);
    };
    if (!n) { g.fillStyle = 'rgba(200,230,255,.6)'; g.font = '20px sans-serif'; g.textAlign = 'center'; g.fillText('아직 기록된 소망이 없어요.', cv.width / 2, cv.height / 2); return; }
    tick();
  }

  // ---------- guide (all real creatures) ----------
  function guide(page) {
    const per = 15, all = CAT.entries, pages = Math.ceil(all.length / per);
    page = (page + pages) % pages;
    const items = all.slice(page * per, page * per + per).map(e => '<figure class="spec"><img src="' + esc(e.imageUrl) + '" alt="" loading="lazy" decoding="async"><figcaption><b>' + esc(e.id) + '</b><span>' + esc(e.wishType) + '</span><span>' + esc(C.WAYS[e.wayIndex].label) + '</span></figcaption></figure>').join('');
    render({ cls: 'guide', field: { type: 'orb', scale: 1.6, dim: .15 },
      body: '<p class="kicker">소망생물 도감 · ' + (page + 1) + ' / ' + pages + '</p><div class="spec-grid">' + items + '</div>',
      back: () => guide(page - 1), next: () => guide(page + 1), nextLabel: '다음 생물들' });
  }

  // ---------- farewell ----------
  function farewell() {
    render({ cls: 'talk', field: { type: 'creature', scale: .45, dim: 1, y: .5 },
      body: '<p class="talk-line top" id="talk"></p><div class="stack" id="stack" hidden><button class="chip" id="again">맞춤 데이터 다시 보기</button><button class="chip" id="tank">공유수족관 보기</button><button class="chip" id="home">처음으로</button></div>' });
    F.form(S.entry);
    typeLines($('#talk'), ['오늘 깨운 소망이 살아날 날을', '함께 기다릴게요.', '안녕히 가세요.'], () => { $('#stack').hidden = false; });
    $('#again').onclick = () => personal(0);
    $('#tank').onclick = () => { location.href = 'shared-aquarium'; };
    $('#home').onclick = title;
  }

  // ---------- chrome ----------
  $('#menu-btn').onclick = menu;
  const about = $('#about');
  $('#about-btn').onclick = () => about.showModal();
  $('#about-close').onclick = () => about.close();
  about.addEventListener('click', e => { if (e.target === about) about.close(); });

  F.mount(document.querySelector('#stage'));
  title();

  // For checks: expose a small, read-only hook.
  window.__wish = { get state() { return S; }, screens: { title, menu, hello, wishes, moment, way, forming, formed, hours, years, message, finishing, card, afterCard, personal, report, guide, farewell }, bubbles, lollipop, radialHours, saveImage };
})();
