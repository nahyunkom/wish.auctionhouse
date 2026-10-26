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

  // A stippled organism of nested membranes: points crowd at each membrane's rim
  // and thin toward its inside, like the particle studies this is modelled on.
  const SHELLS = [1, .93, .87, .82, .76, .62];
  function build() {
    const n = Math.round(Math.min(15000, Math.max(6000, (w * h) / 58)));
    parts = [];
    for (let i = 0; i < n; i++) {
      const haze = rand() < .3;                       // inner haze vs. membrane rim
      const shell = haze ? SHELLS.length - 1 : Math.floor(Math.pow(rand(), 1.4) * (SHELLS.length - 1));
      const depth = haze ? Math.sqrt(rand()) : Math.pow(rand(), 7) * .16;   // 0 = rim
      parts.push({
        x: w / 2 + (rand() - .5) * w, y: h / 2 + (rand() - .5) * h,
        shell, depth, haze, a: rand() * Math.PI * 2, sh: rand(), jit: (rand() - .5) * .006,
        r: 120, g: 180, b: 255, size: rand() < .06 ? 1.7 : 1.15, ph: rand() * 6.283,
        yearRing: rand(), edge: rand()
      });
    }
  }
  // Colour by membrane: deep blue outside, cyan, then a warm gold innermost rim.
  const SHELL_COL = [[38, 110, 255], [50, 150, 255], [70, 190, 255], [90, 215, 240], [235, 205, 110], [150, 175, 150]];

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
          for (let n = 0; n < 12000; n++) {
            const r = rand() * total; let lo = 0, hi = weights.length - 1;
            while (lo < hi) { const m = (lo + hi) >> 1; if (weights[m] < r) lo = m + 1; else hi = m; }
            const i = cells[lo], px = (i / 4) % cw, py = Math.floor(i / 4 / cw);
            const nb = (dx, dy) => { const xx = Math.min(cw - 1, Math.max(0, px + dx)), yy = Math.min(ch - 1, Math.max(0, py + dy)); return d[(yy * cw + xx) * 4 + 3] / 255 * (opaque ? Math.min(1, Math.max(Math.abs(d[(yy * cw + xx) * 4] - bg[0]), Math.abs(d[(yy * cw + xx) * 4 + 1] - bg[1]), Math.abs(d[(yy * cw + xx) * 4 + 2] - bg[2])) / 60) : 1); };
            const e = Math.min(nb(-2, 0), nb(2, 0), nb(0, -2), nb(0, 2)) < .15;
            const m = Math.max(d[i], d[i + 1], d[i + 2], 1), lift = Math.min(1.6, 210 / m);
            pts.push({ e, x: (px + rand()) / cw - .5, y: (py + rand()) / ch - .5,
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

  // Organic membrane outline: a slightly flattened, breathing circle with a soft neck on one side.
  function membrane(a, k) {
    const wob = .035 * Math.sin(a * 2 + t * .25 + k) + .02 * Math.sin(a * 3 - t * .18) + .012 * Math.sin(a * 5 + t * .4);
    const neck = -.09 * Math.exp(-Math.pow(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI)) / .55, 2)) * (k / (SHELLS.length - 1) * .5 + .5);
    return 1 + wob + neck;
  }
  function target(p, i, n) {
    const cx = w / 2, cy = h * (mode.y || .47), R = size();
    const k = p.shell, spin = t * .012 * (k % 2 ? 1 : -1);
    const a = p.a + spin;
    const rr = R * SHELLS[k] * membrane(a, k) * (1 - p.depth) * (1 + p.jit) * (1 + .012 * Math.sin(t * .5 + k));
    const ox = R * (.06 - k * .012);   // nested shells sit off-centre, like the reference organism
    const orb = [cx + ox + Math.cos(a) * rr * 1.04, cy + Math.sin(a) * rr];
    if (mode.type === 'orb' || !shape) {
      const c = SHELL_COL[k], rim = p.haze ? .2 : Math.min(1.25, (1 - p.depth / .16) * 1.2 + .15);
      return { pos: orb, col: c, a: mode.dim * rim };
    }
    // Points beyond the form become the years rings (or a faint halo when there are none).
    const yearsShare = mode.rings ? Math.min(.45, .08 + mode.rings * .035) : .1;
    if (p.yearRing < yearsShare) {
      const k = mode.rings ? Math.floor(p.yearRing / yearsShare * mode.rings) : 0;
      const ang = p.a + t * (.01 + k * .003) * (k % 2 ? 1 : -1);
      const rr = R * (.84 + (mode.rings ? k / Math.max(1, mode.rings) * .5 : .42)) * membrane(ang, k) * (1 - p.depth * .3);
      const c = SHELL_COL[Math.min(3, k % 4)];
      return { pos: [cx + Math.cos(ang) * rr * 1.04, cy + Math.sin(ang) * rr], col: c, a: (mode.rings ? .8 : .3) * (p.haze ? .3 : 1) };
    }
    const sp = shape.pts[i % shape.pts.length];
    const fw = shape.aspect >= 1 ? R * 1.5 : R * 1.5 * shape.aspect, fh = shape.aspect >= 1 ? R * 1.5 / shape.aspect : R * 1.5;
    const breathe = 1 + .02 * Math.sin(t * .9);
    const sway = Math.sin(t * .35) * .06;
    let x = sp.x * fw * breathe, y = sp.y * fh * breathe;
    const c = Math.cos(sway), s = Math.sin(sway);
    const fx = Math.sin(sp.y * 9 + t * .8 + p.ph) * 2.2, fy = Math.cos(sp.x * 9 + t * .7 + p.ph) * 1.6;
    return { pos: [cx + x * c - y * s + fx, cy + x * s + y * c + fy + Math.sin(t * .45) * 6], col: [sp.r, sp.g, sp.b], a: sp.e ? .95 : .5 };
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
    const n = parts.length, buckets = new Map();
    for (let i = 0; i < n; i++) {
      const p = parts[i], tg = target(p, i, n);
      p.x += (tg.pos[0] - p.x) * k * (.6 + p.sh * .8);
      p.y += (tg.pos[1] - p.y) * k * (.6 + p.sh * .8);
      p.r += (tg.col[0] - p.r) * k; p.g += (tg.col[1] - p.g) * k; p.b += (tg.col[2] - p.b) * k;
      const tw = .75 + .25 * Math.sin(t * 1.1 + p.ph * 3);
      const a = Math.min(1, tg.a * tw * (.5 + p.sh * .5) + flare * .35);
      if (a < .03) continue;
      // quantise colour and alpha so points draw in a few hundred batches
      const key = ((p.r >> 4) << 16) | ((p.g >> 4) << 10) | ((p.b >> 4) << 4) | Math.min(15, (a * 16) | 0);
      let list = buckets.get(key); if (!list) buckets.set(key, list = []);
      list.push(p.x, p.y, p.size);
    }
    for (const [key, list] of buckets) {
      const r = ((key >> 16) & 15) * 16 + 8, g = ((key >> 10) & 63 & 15) * 16 + 8, b = ((key >> 4) & 15) * 16 + 8, a = ((key & 15) + .5) / 16;
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(2) + ')';
      ctx.beginPath();
      for (let j = 0; j < list.length; j += 3) ctx.rect(list[j], list[j + 1], list[j + 2], list[j + 2]);
      ctx.fill();
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
