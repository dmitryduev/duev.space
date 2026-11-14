// duev.space: pixel font, two hero scenes (dithered planet, Pioneer-plaque line art), palette swaps.
// No dependencies.
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  // 8x8 Bayer matrix, normalized to (-0.5, 0.5).
  const BAYER = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
  ].map((v) => (v + 0.5) / 64 - 0.5);

  // ---------- palettes ----------
  const PALS = ['viridis', 'graphite'];
  // Ramp the portrait PNG was baked with (tools/make_assets.py).
  const BAKED_PAL = 'viridis';
  const BAKED = ['#0d0a1c', '#360741', '#42527a', '#3b8a86', '#75c078', '#d6c951'];
  const hex2rgb = (h) => { const n = parseInt(h.trim().slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const cssVar = (n) => getComputedStyle(root).getPropertyValue(n).trim();
  const ramp = () => [0, 1, 2, 3, 4, 5].map((i) => cssVar('--r' + i));
  const onPal = [];

  function setPal(name) {
    root.dataset.pal = name;
    store.set('pal', name);
    const label = $('#pal-name');
    if (label) label.textContent = name.toUpperCase();
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = cssVar('--bg');
    onPal.forEach((f) => f());
  }

  // ---------- 5x7 pixel font: char + 7 rows, each row a base-32 bitmask ----------
  const FONT = {};
  {
    const s = 'AehhvhhhBuhhuhhuCehgggheDuhhhhhuEvgguggvFvggugggGehgnhhfHhhhvhhhIs88888sJ72222icKhikokihLggggggvMhrllhhhNhhpljhhOehhhhhePuhhugggQehhhlidRuhhukihSfgge11uTv444444UhhhhhheVhhhhha4WhhhlllaXhha4ahhYhha4444Zv1248gv0ehjlphe18o8888s2eh1248v3v2421he426aiv225vgu11he668guhhe7v1248888ehhehhe9ehhf12c.00000oo,000088g:0oo0oo0!ggggg0g?eh12404\'gg00000-000u000+044v440_000000v/01248g0>g84248g<248g842▶gosusog·000oo00*04lel40@ehnlnge♥0avve40&cik8lid';
    for (let i = 0; i < s.length; i += 8) {
      const rows = [...s.slice(i + 1, i + 8)].map((c) => parseInt(c, 32));
      const mask = rows.reduce((a, r) => a | r, 0);
      let w = 0;
      for (let c = 0; c < 5; c++) if (mask & (16 >> c)) w = c + 1;
      FONT[s[i]] = { rows, w };
    }
    FONT[' '] = { rows: [0, 0, 0, 0, 0, 0, 0], w: 3 };
  }
  const glyph = (ch) => FONT[ch] || FONT[' '];
  const measure = (str) => [...str].reduce((a, ch) => a + glyph(ch).w + 1, -1);

  function wrap(text, maxW) {
    const lines = [];
    let cur = '';
    for (const word of text.split(' ')) {
      const next = cur ? cur + ' ' + word : word;
      if (cur && measure(next) > maxW) { lines.push(cur); cur = word; } else cur = next;
    }
    lines.push(cur);
    return lines;
  }

  function pixelText(el) {
    if (!el.dataset.px) el.dataset.px = el.textContent.trim().toUpperCase();
    const text = el.dataset.px;
    let cv = el.querySelector('canvas');
    if (!cv) {
      el.textContent = '';
      const sr = document.createElement('span');
      sr.className = 'sr';
      sr.textContent = text;
      cv = document.createElement('canvas');
      cv.setAttribute('aria-hidden', 'true');
      el.append(sr, cv);
      el.classList.add('on');
    }
    const cs = getComputedStyle(el);
    const want = (innerWidth < 560 && +el.dataset.scaleSm) || +el.dataset.scale || 3;
    const min = +el.dataset.min || 2;
    const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const avail = Math.min(el.parentElement.clientWidth, innerWidth - 32) - pad;

    let scale = want;
    let lines = [text];
    while (scale > min && (measure(text) + 1) * scale > avail) scale--;
    if ((measure(text) + 1) * scale > avail) lines = wrap(text, Math.floor(avail / scale) - 1);

    const w = Math.max(...lines.map(measure)) + 1;
    const h = lines.length * 9 - 1;
    cv.width = w;
    cv.height = h;
    cv.style.width = w * scale + 'px';
    cv.style.height = h * scale + 'px';
    const ctx = cv.getContext('2d');
    const draw = (color, ox, oy) => {
      if (!color || color === 'transparent') return;
      ctx.fillStyle = color;
      lines.forEach((line, li) => {
        let x = ox;
        for (const ch of line) {
          const g = glyph(ch);
          g.rows.forEach((row, y) => {
            for (let c = 0; c < 5; c++) if (row & (16 >> c)) ctx.fillRect(x + c, oy + li * 9 + y, 1, 1);
          });
          x += g.w + 1;
        }
      });
    };
    draw(cs.getPropertyValue('--px-shadow').trim(), 1, 1);
    draw(cs.color, 0, 0);
  }

  const pxEls = $$('.px');
  const renderPx = () => pxEls.forEach(pixelText);

  // ---------- sprites (12x12, digits index the ramp) ----------
  const SPRITES = {"term": "............555555555555534355555555511111111115514111111115511411111115514144411115511111111115511111111115555555555555....5555......55555555..", "chip": "..4.4..4.4....4.4..4.4..445555555544..51111115..445133331544..51344315....51344315..445133331544..51111115..445555555544..4.4..4.4....4.4..4.4..", "pulse": "555555555555511111111115511111111115511111141115511111414115544111414115511414111445511141111115511111111115555555555555.....55........555555...", "comet": "........444........45554......345554.....3345544....3.33444....3.3.3......3.2.3......2.3.2......2.2.2........2.2........2.2..........2..........", "rock": ".................3333......33444433...3445444443..3444444343.33443344443.34443344433..344444443...3344434433...3344433.......333................", "flame": ".....4...........44.........444.........4434..4....443344.4....4333444....44355344....43555534....43555534.....435534.....22222222...2.2.2.2.2..", "penguin": "....2222.......222222.....22522522....22244222....22555522...2225555222..2255555522..2255555522...25555552....22555522.....222222.....444..444..", "scope": "..........55........5545......554455....55445555..5544555....3355555.....333.4...........4..........4.4........4...4......4.....4..............."};

  function drawSprites() {
    const r = ramp();
    $$('canvas.spr').forEach((cv) => {
      const data = SPRITES[cv.dataset.spr] || '';
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 12, 12);
      [...data].forEach((c, i) => {
        if (c === '.') return;
        ctx.fillStyle = r[+c];
        ctx.fillRect(i % 12, (i / 12) | 0, 1, 1);
      });
    });
  }

  // ---------- Bayer-dithered gradient strips (CSS backgrounds) ----------
  function ditherURL(color) {
    const cv = document.createElement('canvas');
    cv.width = 8;
    cv.height = 16;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = color;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 8; x++) {
        if ((y + 0.5) / 16 - 0.5 > BAYER[(y % 8) * 8 + x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    return `url(${cv.toDataURL()})`;
  }
  function setDithers() {
    root.style.setProperty('--dither-bg', ditherURL(cssVar('--bg')));
    root.style.setProperty('--dither-a3', ditherURL(cssVar('--a3')));
  }

  // ---------- portrait palette swap ----------
  function portrait() {
    const img = $('#portrait');
    if (!img) return;
    let idx = null;
    const src = new Image();
    src.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = src.width;
        cv.height = src.height;
        const ctx = cv.getContext('2d');
        ctx.drawImage(src, 0, 0);
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        const baked = BAKED.map(hex2rgb);
        idx = new Uint8Array(d.length / 4);
        for (let i = 0; i < idx.length; i++) {
          let best = 0;
          let bestD = 1e9;
          for (let k = 0; k < 6; k++) {
            const [r, g, b] = baked[k];
            const dd = (d[i * 4] - r) ** 2 + (d[i * 4 + 1] - g) ** 2 + (d[i * 4 + 2] - b) ** 2;
            if (dd < bestD) { bestD = dd; best = k; }
          }
          idx[i] = best;
        }
        recolor();
      } catch { /* file:// or tainted canvas: keep the baked image */ }
    };
    src.src = img.getAttribute('src');
    const orig = img.src;

    function recolor() {
      if (!idx) return;
      if (root.dataset.pal === BAKED_PAL) { img.src = orig; return; }
      const r = ramp().map(hex2rgb);
      const cv = document.createElement('canvas');
      cv.width = src.width;
      cv.height = src.height;
      const ctx = cv.getContext('2d');
      const out = ctx.createImageData(cv.width, cv.height);
      for (let i = 0; i < idx.length; i++) {
        const [cr, cg, cb] = r[idx[i]];
        out.data.set([cr, cg, cb, 255], i * 4);
      }
      ctx.putImageData(out, 0, 0);
      img.src = cv.toDataURL();
    }
    onPal.push(recolor);
  }

  // ---------- hero canvas: two scenes ----------
  const VIEWS = ['planet', 'plaque'];
  // Starlink-style flat bus with two long solar arrays.
  const SAT = [
    '2333233323.454.3233323332',
    '2333233323455543233323332',
    '...........444...........',
  ];
  // Pioneer-style probe: big dish, small bus.
  const PROBE = ['..555..', '.55555.', '5555555', '...4...', '.44444.'];
  let warpUntil = 0;

  function sky() {
    const cv = $('#sky');
    if (!cv) return null;
    const ctx = cv.getContext('2d', { alpha: false });
    let W = 0, H = 0, img, buf, stars = [], pal = [], P, Q;
    let view = VIEWS.includes(store.get('view')) ? store.get('view') : 'planet';
    let viewT0 = performance.now();
    let last = 0, prev = 0, drift = 0, running = false, onScreen = true;
    let shoot = null, nextShoot = performance.now() + 15000;

    const toU32 = (h) => {
      const [r, g, b] = hex2rgb(h);
      return (255 << 24) | (b << 16) | (g << 8) | r;
    };
    const setRamp = () => { pal = ramp().map(toU32); };
    const clamp5 = (i) => (i < 0 ? 0 : i > 5 ? 5 : i);

    function put(x, y, c) {
      x = Math.round(x);
      y = Math.round(y);
      if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c;
    }
    function line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (let n = 0; n < 4096; n++) {
        put(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    function circle(cx, cy, r, c, fill) {
      cx = Math.round(cx);
      cy = Math.round(cy);
      if (r < 1) { put(cx, cy, c); return; }
      const e = Math.ceil(r) + 1;
      for (let y = -e; y <= e; y++) {
        for (let x = -e; x <= e; x++) {
          const d = Math.sqrt(x * x + y * y);
          if (Math.abs(d - r) <= 0.5) put(cx + x, cy + y, c);
          else if (fill !== undefined && d < r) put(cx + x, cy + y, fill);
        }
      }
    }
    function sprite(rows, x, y, shade = 0) {
      rows.forEach((row, j) => {
        for (let k = 0; k < row.length; k++) {
          if (row[k] !== '.') put(x + k, y + j, pal[Math.max(1, +row[k] - shade)]);
        }
      });
    }
    function bezier(out, p0, p1, p2, p3, n = 80) {
      for (let i = 0; i <= n; i++) {
        const s = i / n, m = 1 - s;
        const a = m * m * m, b = 3 * m * m * s, c = 3 * m * s * s, d = s * s * s;
        out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
      }
    }

    function resize() {
      const px = innerWidth < 720 ? 3 : 4;
      W = Math.max(1, Math.ceil(cv.clientWidth / px));
      H = Math.max(1, Math.ceil(cv.clientHeight / px));
      cv.width = W;
      cv.height = H;
      img = ctx.createImageData(W, H);
      buf = new Uint32Array(img.data.buffer);
      let seed = 1337;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      stars = Array.from({ length: Math.round((W * H) / 110) }, () => {
        const z = rnd();
        return { x: rnd() * W, y: rnd() * H, v: 0.2 + z * z * 1.6, b: 1 + Math.floor(z * 4.99), ph: rnd() * 6.28 };
      });
      const wide = W > H * 1.05;

      // Planet: the ring plane's normal is the spin axis. E1/E2 span the equator.
      const R = wide ? Math.min(H * 0.27, W * 0.16) : W * 0.28;
      const a = -0.38, nz = 0.26, sn = Math.sqrt(1 - nz * nz);
      const N = [sn * Math.sin(a), -sn * Math.cos(a), nz];
      const n1 = Math.hypot(N[0], N[1]);
      const E1 = [N[1] / n1, -N[0] / n1, 0];
      const E2 = [N[1] * E1[2] - N[2] * E1[1], N[2] * E1[0] - N[0] * E1[2], N[0] * E1[1] - N[1] * E1[0]];
      P = { x: wide ? W * 0.74 : W * 0.58, y: wide ? H * 0.58 : H * 0.8, R, N, E1, E2 };

      Q = plaqueLayout(wide, rnd);
      frame(performance.now(), true);
    }

    // ----- Pioneer-plaque layout: solar system row, trajectory, pulsar map, hydrogen -----
    function plaqueLayout(wide, rnd) {
      const u = Math.min(W, H * 1.8) / 180;
      const y = Math.round(H * (wide ? 0.85 : 0.93));
      const x0 = W * 0.05, x1 = W * 0.97;
      const F = [0, 0.1, 0.15, 0.2, 0.25, 0.4, 0.56, 0.71, 0.85, 0.97];
      const SZ = [3.4, 0.6, 1.2, 1.3, 0.9, 3.2, 2.7, 1.9, 1.9, 0.6];
      const bodies = F.map((f, i) => ({ x: Math.round(x0 + f * (x1 - x0)), r: SZ[i] * u }));
      const e = bodies[3], j = bodies[5];
      const yj = y + j.r + 3 * u;
      const pts = [];
      bezier(pts, [e.x, y + e.r + 2], [e.x + (j.x - e.x) * 0.4, y + 9 * u], [j.x - 9 * u, yj + 3 * u], [j.x, yj]);
      bezier(pts, [j.x, yj], [j.x + 16 * u, yj - 3 * u], [W * 0.6, y - 24 * u], [W * 0.985, y - 34 * u]);
      const pc = wide ? { x: W * 0.7, y: H * 0.36, r: H * 0.27 } : { x: W * 0.52, y: H * 0.77, r: W * 0.22 };
      const pulsars = Array.from({ length: 14 }, (_, i) => ({
        a: (i / 14) * Math.PI * 2 + (rnd() - 0.5) * 0.35,
        l: 0.35 + rnd() * 0.65,
        bits: ((rnd() * 1024) | 0) | 512,
      }));
      const hy = wide ? { x: W * 0.9, y: H * 0.12 } : null;
      return { y, u, bodies, pts, pc, pulsars, hy };
    }

    function drawStars(t, warp) {
      const cap = view === 'plaque' ? 2 : 5;
      for (const s of stars) {
        const x = (((s.x - drift * s.v) % W) + W) % W;
        // slow twinkle (~20 s period), never fully off
        const b = Math.min(cap, s.b - (Math.sin(t * 0.0003 + s.ph) < -0.6 ? 1 : 0));
        if (b < 1) continue;
        if (warp) {
          const len = Math.min(30, s.v * 18);
          for (let i = 0; i < len; i++) put(x + i, s.y, pal[Math.max(1, b - ((i / len) * 3 | 0))]);
        } else put(x, s.y, pal[b]);
      }
    }

    function shootingStar(now, warp) {
      if (reduced || warp) return;
      if (!shoot && now > nextShoot) {
        shoot = { t0: now, x: W * (0.2 + Math.random() * 0.6), y: H * Math.random() * 0.3 };
        nextShoot = now + 20000 + Math.random() * 20000;
      }
      if (!shoot) return;
      const k = (now - shoot.t0) / 1100;
      if (k > 1) { shoot = null; return; }
      const hx = shoot.x - k * W * 0.25, hy = shoot.y + k * W * 0.12;
      for (let i = 0; i < 14; i++) {
        if (i > 6 && BAYER[(i * 9) % 64] > 0.1) continue;
        const c = pal[i < 2 ? 5 : i < 6 ? 4 : i < 10 ? 3 : 2];
        put(hx + i * 2, hy - i, c);
        put(hx + i * 2 + 1, hy - i, c);
      }
    }

    function drawPlanet(t) {
      const { x: cx, y: cy, R, N, E1, E2 } = P;
      // The light swings slowly from front-left (full) to behind (crescent) and back, ~2.7 min a cycle.
      const phi = reduced ? -0.75 : -1.45 + 0.8 * Math.cos((t / 160000) * 2 * Math.PI);
      const el = 0.35;
      const L = [Math.sin(phi) * Math.cos(el), -Math.sin(el), Math.cos(phi) * Math.cos(el)];
      const NL = N[0] * L[0] + N[1] * L[1] + N[2] * L[2];
      // the ring is a thin sheet: lit side facing us is bright, otherwise we see light leaking through
      const ringLit = (0.35 + 0.65 * Math.abs(NL)) * (NL * N[2] > 0 ? 1 : 0.55);
      const rin = R * 1.35, rout = R * 2.15, g0 = R * 1.72, g1 = R * 1.8;
      const inRing = (r) => r > rin && r < rout && !(r > g0 && r < g1);
      const spin = t * 0.00002;
      const R2 = R * R;
      const ext = Math.ceil(rout) + 1;
      const xa = Math.max(0, (cx - ext) | 0), xb = Math.min(W - 1, (cx + ext) | 0);
      const ya = Math.max(0, (cy - ext) | 0), yb = Math.min(H - 1, (cy + ext) | 0);

      for (let y = ya; y <= yb; y++) {
        const dy = y + 0.5 - cy;
        const brow = (y & 7) * 8;
        for (let x = xa; x <= xb; x++) {
          const dx = x + 0.5 - cx;
          const d2 = dx * dx + dy * dy;
          const th = BAYER[brow + (x & 7)];
          const inP = d2 < R2;
          const zs = inP ? Math.sqrt(R2 - d2) : 0;
          // where this pixel's line of sight crosses the ring plane
          const zr = -(N[0] * dx + N[1] * dy) / N[2];
          const r = Math.sqrt(d2 + zr * zr);

          if (inRing(r) && (!inP || zr > zs)) {
            let val = (0.55 + 0.2 * Math.sin((r / R) * 21) + 0.1 * Math.sin((r / R) * 57)) * ringLit;
            // the planet's shadow on the ring
            const pl = dx * L[0] + dy * L[1] + zr * L[2];
            if (pl < 0) {
              const qx = dx - pl * L[0], qy = dy - pl * L[1], qz = zr - pl * L[2];
              if (qx * qx + qy * qy + qz * qz < R2) val *= 0.15;
            }
            const i = Math.round(val * 5 + th);
            if (i > 0) buf[y * W + x] = pal[clamp5(i)];
            continue;
          }
          if (!inP) continue;

          const nx = dx / R, ny = dy / R, nz2 = zs / R;
          let lam = nx * L[0] + ny * L[1] + nz2 * L[2];
          if (lam < 0) lam = 0;
          // the ring's shadow on the planet
          if (lam > 0 && Math.abs(NL) > 1e-3) {
            const tt = -(dx * N[0] + dy * N[1] + zs * N[2]) / NL;
            if (tt > 0) {
              const qx = dx + tt * L[0], qy = dy + tt * L[1], qz = zs + tt * L[2];
              if (inRing(Math.sqrt(qx * qx + qy * qy + qz * qz))) lam *= 0.3;
            }
          }
          const lat = nx * N[0] + ny * N[1] + nz2 * N[2];
          const lon = Math.atan2(nx * E2[0] + ny * E2[1] + nz2 * E2[2], nx * E1[0] + ny * E1[1] + nz2 * E1[2]) + spin;
          let band = Math.sin(lat * 10 + 0.9 * Math.sin(lon * 2 + lat * 5) + 0.4 * Math.sin(lon * 5 - lat * 3));
          // a storm, carried around by the rotation
          const sl = (((lon - 1.2) % 6.283) + 6.283) % 6.283 - 3.14;
          const sd = (sl * sl) / 0.1 + ((lat + 0.3) ** 2) / 0.005;
          if (sd < 1) band = -1 + sd;
          const val = 0.07 + 0.93 * lam * (0.78 + 0.22 * band);
          buf[y * W + x] = pal[clamp5(Math.round(val * 5.4 + th))];
        }
      }

      // satellite on a slightly inclined orbit; hidden behind the planet, dimmed in its shadow
      const inc = 0.22, rO = R * 2.5;
      const th2 = t * 0.00014;
      const c = Math.cos(th2) * rO, s = Math.sin(th2) * rO;
      const pos = [0, 1, 2].map((k) => c * E1[k] + s * (Math.cos(inc) * E2[k] + Math.sin(inc) * N[k]));
      if (pos[2] < 0 && pos[0] ** 2 + pos[1] ** 2 < R2) return;
      const pl = pos[0] * L[0] + pos[1] * L[1] + pos[2] * L[2];
      const dark = pl < 0 && (pos[0] - pl * L[0]) ** 2 + (pos[1] - pl * L[1]) ** 2 + (pos[2] - pl * L[2]) ** 2 < R2;
      sprite(SAT, cx + pos[0] - 12, cy + pos[1] - 1, dark ? 2 : 0);
    }

    function drawPlaque(t) {
      const k = reduced ? 1e9 : t - viewT0; // ms since this view appeared
      const { y, u, bodies, pts, pc, pulsars, hy } = Q;
      const ink = pal[5], bright = pal[4], soft = pal[3], faint = pal[2];
      const ease = (a, b) => Math.min(1, Math.max(0, (k - a) / b));

      // pulsar map: lines draw in one by one; then, every 9 s, one of them slowly brightens and fades
      const focus = Math.floor(t / 9000) % pulsars.length;
      const glow = Math.sin(((t % 9000) / 9000) * Math.PI);
      line(pc.x, pc.y, pc.x + pc.r * 1.45 * ease(200, 1600), pc.y, faint);
      pulsars.forEach((p, i) => {
        const grow = ease(400 + i * 220, 900);
        if (grow <= 0) return;
        const len = p.l * pc.r * grow;
        const dx = Math.cos(p.a), dy = Math.sin(p.a);
        const col = i === focus && !reduced ? (glow > 0.7 ? ink : glow > 0.35 ? bright : soft) : soft;
        line(pc.x, pc.y, pc.x + dx * len, pc.y + dy * len, col);
        if (grow < 1) return;
        // binary period: one-pixel ticks on one side, near the tip
        for (let b = 0; b < 6; b++) {
          const d = len - 2 - b * 3;
          if (d < 6) break;
          if ((p.bits >> b) & 1) put(pc.x + dx * d - dy * 1.5, pc.y + dy * d + dx * 1.5, col);
        }
      });
      put(pc.x, pc.y, ink);

      // the solar system, Sun first
      bodies.forEach((b, i) => {
        if (ease(i * 120, 600) <= 0) return;
        if (i === 0) circle(b.x, y, b.r, ink, bright);
        else circle(b.x, y, b.r, ink);
        if (i === 6) line(b.x - b.r * 2, y + b.r * 0.5, b.x + b.r * 2, y - b.r * 0.5, ink);
      });

      // trajectory: Earth, around Jupiter, and out
      const n = pts.length;
      const shown = Math.floor(ease(1500, 2500) * n);
      for (let i = 1; i < shown; i++) line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], bright);
      if (shown === n) {
        const [ax, ay] = pts[n - 1], [bx, by] = pts[n - 5];
        const ang = Math.atan2(ay - by, ax - bx), al = Math.max(3, 3 * u);
        line(ax, ay, ax - Math.cos(ang - 0.5) * al, ay - Math.sin(ang - 0.5) * al, bright);
        line(ax, ay, ax - Math.cos(ang + 0.5) * al, ay - Math.sin(ang + 0.5) * al, bright);
        const [px, py] = pts[Math.floor(((t % 40000) / 40000) * (n - 1))];
        sprite(PROBE, px - 3, py - 6);
      }

      // hydrogen's hyperfine transition: the plaque's unit of length and time
      if (hy && ease(2500, 1) > 0) {
        const r = Math.max(2, 2.2 * u), gap = 7 * r;
        [[-1, -1], [1, 1]].forEach(([side, spinDir]) => {
          const hx = hy.x + (side * gap) / 2;
          circle(hx, hy.y, r, soft);
          put(hx, hy.y, ink);
          line(hx, hy.y - spinDir * (r + 1), hx, hy.y - spinDir * (r + 1 + 2 * u), ink);
        });
        line(hy.x - gap / 2 + r + 2, hy.y, hy.x + gap / 2 - r - 2, hy.y, faint);
        line(hy.x, hy.y - 2, hy.x, hy.y + 2, soft);
      }
    }

    function frame(now, force) {
      if (!buf || (!force && (!running || !onScreen))) return;
      const t = reduced ? 30000 : now;
      const dt = prev ? Math.min(100, now - prev) : 0;
      prev = now;
      const warp = !reduced && now < warpUntil;
      if (!reduced) drift += dt * 0.0006 * (warp ? 80 : 1);
      buf.fill(pal[0]);
      drawStars(t, warp);
      if (view === 'planet') {
        shootingStar(now, warp);
        drawPlanet(t);
      } else drawPlaque(t);
      ctx.putImageData(img, 0, 0);
    }

    function loop(now) {
      if (!running) return;
      if (now - last > 33) { last = now; frame(now); }
      requestAnimationFrame(loop);
    }

    setRamp();
    onPal.push(() => { setRamp(); frame(performance.now(), true); });
    let size = '';
    new ResizeObserver(() => {
      const next = cv.clientWidth + 'x' + cv.clientHeight;
      if (next !== size) { size = next; resize(); }
    }).observe(cv);
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(cv);
    document.addEventListener('visibilitychange', () => {
      const was = running;
      running = !document.hidden && !reduced;
      if (running && !was) requestAnimationFrame(loop);
    });
    running = !reduced;
    if (running) requestAnimationFrame(loop);

    return {
      get view() { return view; },
      setView(v) {
        view = v;
        store.set('view', v);
        viewT0 = performance.now();
        frame(viewT0, true);
      },
    };
  }

  // ---------- small things ----------
  function scores() {
    const els = $$('.n[data-n]');
    if (!els.length || reduced || !('IntersectionObserver' in window)) return;
    const fmt = (n) => n.toLocaleString('en-US');
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target, n = +el.dataset.n, suf = el.dataset.suffix || '';
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 1200);
        el.textContent = fmt(Math.round(n * (1 - (1 - k) ** 3))) + (k === 1 ? suf : '');
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }), { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function palettes() {
    const btn = $('#pal');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const i = PALS.indexOf(root.dataset.pal);
      const next = PALS[(i + 1) % PALS.length];
      setPal(next);
      toast('PALETTE: ' + next.toUpperCase());
    });
  }

  function views(scene) {
    const btn = $('#view');
    if (!btn) return;
    if (!scene) { btn.remove(); return; }
    const label = $('#view-name');
    label.textContent = scene.view.toUpperCase();
    btn.addEventListener('click', () => {
      const next = VIEWS[(VIEWS.indexOf(scene.view) + 1) % VIEWS.length];
      scene.setView(next);
      label.textContent = next.toUpperCase();
      toast('VIEW: ' + next.toUpperCase());
    });
  }

  // Quests / items / hi-scores share one window; links to a panel open its tab.
  function tabs() {
    const list = $('[role="tablist"]');
    if (!list) return () => false;
    const tabEls = $$('[role="tab"]', list);
    const panels = tabEls.map((t) => document.getElementById(t.getAttribute('aria-controls')));
    function select(i, focus) {
      tabEls.forEach((t, k) => {
        t.setAttribute('aria-selected', String(k === i));
        t.tabIndex = k === i ? 0 : -1;
        panels[k].hidden = k !== i;
      });
      tabEls.forEach(pixelText); // tab colors depend on the selected state
      if (focus) tabEls[i].focus();
    }
    tabEls.forEach((t, i) => t.addEventListener('click', () => select(i)));
    list.addEventListener('keydown', (e) => {
      const i = tabEls.indexOf(document.activeElement);
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (i < 0 || !d) return;
      e.preventDefault();
      select((i + d + tabEls.length) % tabEls.length, true);
    });
    const open = (id, smooth = true) => {
      const i = panels.findIndex((p) => p.id === id);
      if (i < 0) return false;
      select(i);
      list.parentElement.scrollIntoView({ behavior: smooth && !reduced ? 'smooth' : 'auto' });
      return true;
    };
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (a && open(a.getAttribute('href').slice(1))) {
        e.preventDefault();
        history.replaceState(null, '', a.getAttribute('href'));
      }
    });
    select(0);
    return open;
  }

  function konami() {
    const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let pos = 0;
    addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      pos = k === code[pos] ? pos + 1 : k === code[0] ? 1 : 0;
      if (pos < code.length) return;
      pos = 0;
      warpUntil = performance.now() + 4000;
      toast('WARP DRIVE ENGAGED');
      const hero = $('.hero');
      if (hero && !reduced) hero.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function gameOver() {
    const el = $('#count');
    if (!el) return;
    let n = 9;
    const tick = () => {
      el.textContent = n;
      if (n-- > 0) setTimeout(tick, 1000);
      else { el.textContent = ''; $('#insert')?.removeAttribute('hidden'); }
    };
    tick();
  }

  // ---------- boot ----------
  const label = $('#pal-name');
  if (label) label.textContent = (root.dataset.pal || BAKED_PAL).toUpperCase();
  setDithers();
  renderPx();
  drawSprites();
  onPal.push(setDithers, renderPx, drawSprites);
  portrait();
  const openTab = tabs();
  views(sky());
  scores();
  palettes();
  konami();
  gameOver();
  // pixel headings change heights after load; land on the #anchor again
  const hash = location.hash.slice(1);
  if (hash) {
    requestAnimationFrame(() => {
      if (!openTab(hash, false)) document.getElementById(hash)?.scrollIntoView();
    });
  }

  let rw = innerWidth, rt;
  addEventListener('resize', () => {
    if (innerWidth === rw) return;
    rw = innerWidth;
    clearTimeout(rt);
    rt = setTimeout(renderPx, 120);
  });
})();
