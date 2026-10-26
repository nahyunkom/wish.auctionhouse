/*
 * WishField: the particle sculpture at the centre of the journey.
 * Thousands of points rest as slowly turning concentric rings (a wish not yet
 * formed), condense into a creature's form sampled from its original PNG (a
 * display copy; the file is never changed), and gather extra rings for the
 * years a wish has been held. Everything eases slowly; nothing snaps.
 */
(function (root) {
  'use strict';
  const canvas = document.createElement('canvas');
  canvas.id = 'wish-field';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  let w = 1, h = 1, dpr = 1, parts = [], t = 0, last = 0, raf = 0, paused = false;
  let mode = { type: 'orb', scale: 1, y: .47, rings: 0, dim: 1 };
  let shape = null;          // sampled creature points {x,y,r,g,b} in -0.5..0.5
  let shapeId = '';
  let flare = 0;

  let seed = 90127;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  // Orb colours: cyan → lilac → peach around the rings (as in the particle references).
  const ORB = [[120, 235, 225], [175, 190, 255], [235, 170, 230], [255, 200, 170]];
  function orbColor(a) {
    const f = ((a / (Math.PI * 2)) % 1 + 1) % 1 * (ORB.length - 1);
    const i = Math.floor(f), k = f - i, c0 = ORB[i], c1 = ORB[Math.min(ORB.length - 1, i + 1)];
    return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
  }

  function build() {
    const n = Math.round(Math.min(3600, Math.max(1600, (w * h) / 300)));
    parts = [];
    for (let i = 0; i < n; i++) {
      const ring = Math.floor(Math.pow(rand(), .8) * 16);
      const a = rand() * Math.PI * 2;
      // The right side of the rings frays, like a disc dissolving into the water.
      const fray = Math.max(0, Math.cos(a - .3)) * rand() * .07;
      parts.push({
        x: w / 2 + (rand() - .5) * w, y: h / 2 + (rand() - .5) * h,
        ring, a, fray, sh: rand(), jit: (rand() - .5) * .012,
        r: 200, g: 230, b: 255, size: rand() < .08 ? 2.2 : 1.3, ph: rand() * 6.283,
        yearRing: rand()
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    if (!parts.length) build();
    wake();
  }

  // Sample a creature's form from its PNG: alpha × brightness weighted points with colour.
  function sample(url, id) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const S = 260, k = S / Math.max(img.naturalWidth, img.naturalHeight);
          const cw = Math.max(1, Math.round(img.naturalWidth * k)), ch = Math.max(1, Math.round(img.naturalHeight * k));
          const c = document.createElement('canvas'); c.width = cw; c.height = ch;
          const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, cw, ch);
          const d = g.getImageData(0, 0, cw, ch).data;
          // Opaque PNGs: treat the corner colour as background (display only).
          const bg = [d[0], d[1], d[2]], opaque = d[3] > 250 && d[(cw * ch - 1) * 4 + 3] > 250;
          const cells = [], weights = []; let total = 0;
          for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
            const i = (y * cw + x) * 4;
            let a = d[i + 3] / 255;
            if (opaque) a *= Math.min(1, Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2])) / 60);
            if (a < .15) continue;
            const lum = Math.max(d[i], d[i + 1], d[i + 2]) / 255;
            total += a * (.25 + lum); cells.push(i); weights.push(total);
          }
          if (!cells.length) { resolve(null); return; }
          const pts = [];
          for (let n = 0; n < 4000; n++) {
            const r = rand() * total; let lo = 0, hi = weights.length - 1;
            while (lo < hi) { const m = (lo + hi) >> 1; if (weights[m] < r) lo = m + 1; else hi = m; }
            const i = cells[lo], px = (i / 4) % cw, py = Math.floor(i / 4 / cw);
            const m = Math.max(d[i], d[i + 1], d[i + 2], 1), lift = Math.min(1.6, 210 / m);
            pts.push({ x: (px + rand()) / cw - .5, y: (py + rand()) / ch - .5,
              r: Math.min(255, d[i] * lift + 18), g: Math.min(255, d[i + 1] * lift + 22), b: Math.min(255, d[i + 2] * lift + 30) });
          }
          resolve({ id, pts, aspect: cw / ch });
        } catch (_) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function size() { return Math.min(w, h) * .34 * (mode.scale || 1); }

  function target(p, i, n) {
    const cx = w / 2, cy = h * (mode.y || .47), R = size();
    const spin = t * (.04 + (p.ring % 3) * .015) * (p.ring % 2 ? 1 : -1);
    const ringR = R * (.12 + p.ring / 15 * .88) * (1 + p.fray + p.jit) * (1 + .02 * Math.sin(t * .6 + p.ring));
    const orb = [cx + Math.cos(p.a + spin) * ringR, cy + Math.sin(p.a + spin) * ringR * .98];
    if (mode.type === 'orb' || !shape) return { pos: orb, col: orbColor(p.a + spin * .3), a: mode.dim };
    // Points beyond the form become the years rings (or a faint halo when there are none).
    const yearsShare = mode.rings ? Math.min(.45, .08 + mode.rings * .035) : .1;
    if (p.yearRing < yearsShare) {
      const k = mode.rings ? Math.floor(p.yearRing / yearsShare * mode.rings) : 0;
      const rr = R * (.82 + (mode.rings ? k / Math.max(1, mode.rings) * .55 : .45)) * (1 + p.jit * 2);
      const ang = p.a + t * (.03 + k * .006) * (k % 2 ? 1 : -1);
      return { pos: [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr], col: orbColor(ang), a: mode.rings ? .75 : .35 };
    }
    const sp = shape.pts[i % shape.pts.length];
    const fw = shape.aspect >= 1 ? R * 1.5 : R * 1.5 * shape.aspect, fh = shape.aspect >= 1 ? R * 1.5 / shape.aspect : R * 1.5;
    const breathe = 1 + .02 * Math.sin(t * .9);
    const sway = Math.sin(t * .35) * .06;
    let x = sp.x * fw * breathe, y = sp.y * fh * breathe;
    const c = Math.cos(sway), s = Math.sin(sway);
    const fx = Math.sin(sp.y * 9 + t * .8 + p.ph) * 2.2, fy = Math.cos(sp.x * 9 + t * .7 + p.ph) * 1.6;
    return { pos: [cx + x * c - y * s + fx, cy + x * s + y * c + fy + Math.sin(t * .45) * 6], col: [sp.r, sp.g, sp.b], a: .8 };
  }

  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(.05, (now - last) / 1000) : .016; last = now;
    if (!paused && !reduce.matches) t += dt;
    const k = reduce.matches ? 1 : 1 - Math.pow(.06, dt);   // slow ease toward targets
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    flare *= Math.pow(.25, dt);
    const n = parts.length;
    for (let i = 0; i < n; i++) {
      const p = parts[i], tg = target(p, i, n);
      p.x += (tg.pos[0] - p.x) * k * (.6 + p.sh * .8);
      p.y += (tg.pos[1] - p.y) * k * (.6 + p.sh * .8);
      p.r += (tg.col[0] - p.r) * k; p.g += (tg.col[1] - p.g) * k; p.b += (tg.col[2] - p.b) * k;
      const tw = .7 + .3 * Math.sin(t * 1.4 + p.ph * 3);
      const a = Math.min(1, tg.a * tw * (.55 + p.sh * .45) + flare * .4);
      ctx.fillStyle = 'rgba(' + (p.r | 0) + ',' + (p.g | 0) + ',' + (p.b | 0) + ',' + a.toFixed(2) + ')';
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (!paused && !reduce.matches) raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }

  const api = {
    mount(host) { (host || document.body).prepend(canvas); resize(); addEventListener('resize', resize, { passive: true }); },
    // set({type:'orb'|'creature', scale, y, rings, dim})
    set(next) { mode = Object.assign({}, mode, next); wake(); },
    async form(entry) {
      if (!entry) { shape = null; return; }
      if (shapeId === entry.id && shape) return;
      shapeId = entry.id;
      const s = await sample(entry.imageUrl, entry.id);
      if (shapeId === entry.id) { shape = s; wake(); }
    },
    flare() { flare = 1; wake(); },
    pause(v) { paused = !!v; if (!paused) { last = 0; wake(); } },
    get mode() { return mode; }
  };
  reduce.addEventListener('change', () => { last = 0; wake(); });
  root.WishField = api;
})(window);
