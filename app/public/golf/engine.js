/*
 * Wichita Mini Golf: the shared engine for holes 4–9. Each hole's page calls GolfHole({...}) with its
 * layout, its obstacles and how to draw them; everything else (physics, aiming, sound, the result card,
 * the leaderboard, the sky and the tilted camera) lives here. Holes 1–3 still carry their own copy.
 *
 * A hole can have: bounds (the rail), walls (extra segments), circles and capsules (still bumpers),
 * movers (bumpers that move; at(t) gives their shapes), zones (friction, a push like a slope, or a bumpy
 * jitter), hazards (+1 stroke), rivers, and drawing hooks: paintTurf / paintGround / paintScenery (painted
 * once), drawGround (flat things that move) and uprights (things that stand up, sorted back to front).
 * Shapes are { rect: [x0, y0, x1, y1] }, { circle: [x, y, r] } or { poly: [[x, y], ...] }.
 */
(() => {
  'use strict';
  const TOTAL = 9;
  const COURSE = ['Keeper of the Plains', 'Old Cowtown', 'Century II', 'Botanica', 'Air Capital', 'Old Town', 'Riverfront Stadium', 'Zoo', 'First Pizza Hut'];
  const PARS = [3, 3, 3, 4, 3, 3, 3, 4, 4];
  const holeUrl = (n) => (n === 1 ? '/golf/' : `/golf/${n}/`);

  window.GolfHole = function GolfHole(HOLE) {
  const no = HOLE.no;
  const prevUrl = no > 1 ? holeUrl(no - 1) : null;
  const nextUrl = no < TOTAL ? holeUrl(no + 1) : null;
  const arrow = (url, n, ch) => (url ? `<a class="hole-nav" href="${url}" aria-label="Hole ${n}">${ch}</a>` : `<span class="hole-nav off" aria-hidden="true">${ch}</span>`);
  document.title = `Wichita Mini Golf · Hole ${no}`;
  document.body.innerHTML = `
<header>
  <div class="title">
    <div class="eyebrow">${arrow(prevUrl, no - 1, '‹')} Hole ${no} of ${TOTAL} ${arrow(nextUrl, no + 1, '›')} · Par ${HOLE.par}</div>
    <h1>${HOLE.name}</h1>
  </div>
  <div class="stats">
    <span class="pill" id="strokes">0 strokes</span>
    <button class="icon-btn" id="board-btn" aria-label="Leaderboard">🏆</button>
    <button class="icon-btn" id="mute" aria-label="Sound off">🔊</button>
  </div>
</header>
<div id="stage">
  <canvas id="c" aria-label="Mini golf hole: drag back from anywhere to aim, let go to putt"></canvas>
  <div id="toast" role="status" aria-live="polite"></div>
  <div id="tip">Drag back anywhere to aim, then let go to putt.<br>${HOLE.tip}</div>
  <div id="card" role="dialog" aria-modal="true" aria-labelledby="result">
    <div class="card">
      <h2 id="result">Par!</h2>
      <div class="score" id="scoreline"></div>
      <div class="stars" id="stars" aria-hidden="true"></div>
      <p class="post" id="post" aria-live="polite"></p>
      <p class="vs" id="vs"></p>
      <button class="btn share" id="challenge">📤 Challenge a friend</button>
      <p class="fact"><b>Did you know?</b> ${HOLE.fact}</p>
      <div class="btns">
        <button class="btn${nextUrl ? '' : ' primary'}" id="again">Play again</button>
        <a class="btn" id="go" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(HOLE.maps)}" target="_blank" rel="noopener">Go see it ↗</a>
      </div>
      ${nextUrl ? `<a class="btn primary next" href="${nextUrl}">Next hole: ${COURSE[no]} ›</a>` : '<a class="btn next" href="/golf/">Back to Hole 1 ›</a>'}
      <p class="soon" id="soon">Rough draft · tell us what to fix</p>
    </div>
  </div>
  <div id="board" role="dialog" aria-modal="true" aria-labelledby="board-title">
    <div class="card">
      <h2 id="board-title">🏆 Leaderboard</h2>
      <div class="tabs" role="tablist"><button class="tab on" id="tab-hole" role="tab" aria-selected="true">This hole</button><button class="tab" id="tab-course" role="tab" aria-selected="false">All 9 holes</button></div>
      <p class="sub" id="board-sub">Hole ${no} · ${HOLE.name} · fewest strokes</p>
      <ol class="rows" id="rows"><li class="empty">Loading…</li></ol>
      <p class="note" id="board-note"></p>
      <div class="btns"><button class="btn primary" id="board-close">Close</button></div>
    </div>
  </div>
</div>`;

  const W = 360, H = 640;
  const VIEW = { sq: 0.8, sky: 96, baseSky: 96 };
  let VIEW_H = VIEW.sky + H * VIEW.sq;
  HOLE.walls ??= []; HOLE.circles ??= []; HOLE.capsules ??= []; HOLE.movers ??= []; HOLE.zones ??= []; HOLE.hazards ??= [];
  for (const r of HOLE.rivers || []) {
    const pts = r.line, out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let step = 0; step < 10; step++) {
        const t = step / 10, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(pts[pts.length - 1]);
    r.path = out;
    r.len = out.slice(1).reduce((sum, q, i) => sum + Math.hypot(q[0] - out[i][0], q[1] - out[i][1]), 0);
  }
  const BALL_R = 6;
  const MAX_SPEED = 900; // units per second at full power
  const MAX_DRAG = 130; // drag this far for full power
  const ROLL = 300; // rolling resistance (units/s²)
  const DRAG = 0.4; // extra slowdown proportional to speed
  const STOP = 6;
  const WALL_BOUNCE = 0.72;
  const SINK_SPEED = 340; // faster than this lips out
  const STEP = 1 / 240;
  const walls = HOLE.bounds.map((p, i) => [p, HOLE.bounds[(i + 1) % HOLE.bounds.length]]).concat(HOLE.walls);
  const params = new URLSearchParams(location.search);

  // ---- State ----
  const ball = { x: HOLE.tee.x, y: HOLE.tee.y, vx: 0, vy: 0, scale: 1 };
  let mode = 'aim'; // aim | rolling | penalty | sinking | done
  let strokes = 0;
  let shotFrom = { x: ball.x, y: ball.y };
  let aim = null; // { sx, sy, x, y } pointer start and current, in world units
  let clock = 0;
  let splash = null; // { x, y, t }
  let lastBounce = 0;

  // ---- Screen ----
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  let scale = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    const baseH = VIEW.baseSky + H * VIEW.sq;
    scale = Math.min(r.width / W, r.height / baseH);
    VIEW.sky = VIEW.baseSky + Math.max(0, Math.min(240, r.height / scale - baseH));
    VIEW_H = VIEW.sky + H * VIEW.sq;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${VIEW_H * scale}px`;
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(VIEW_H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  // Inside the app the page can load before its view reaches full size (the screen is still opening), and
  // no window resize follows, so also follow the stage's own size.
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(stage);
  resize();

  // ---- Sound (tiny synth) ----
  // Phones only allow sound after a tap, and on a touch screen it's the finger lifting that counts, so every
  // tap makes sure sound is on. iPhones on silent (the switch on the side) mute web sound.
  let audio = null;
  let unlocked = false;
  let muted = false;
  try { muted = localStorage.getItem('wlgolf:muted') === '1'; } catch {}
  function unlockAudio() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state !== 'running') audio.resume().catch(() => {});
      if (!unlocked) {
        // A silent blip started inside the tap wakes up sound on older iPhones.
        const src = audio.createBufferSource();
        src.buffer = audio.createBuffer(1, 1, 22050);
        src.connect(audio.destination);
        src.start(0);
        unlocked = true;
      }
    } catch {}
  }
  let noiseBuf = null;
  function hiss(dur, vol, type, from, to = 0, q = 1) {
    if (muted || !audio) return;
    if (!noiseBuf) {
      noiseBuf = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.6), audio.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = noiseBuf;
    const f = audio.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = audio.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(audio.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
  function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0) {
    if (muted || !audio) return;
    const t = audio.currentTime;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  // Pitched high enough to come through a phone's small speaker.
  const sfx = {
    putt: (p = 0.5) => { hiss(0.05, 0.25 + p * 0.35, 'bandpass', 2400, 0, 1.5); tone(720, 0.06, 'triangle', 0.18 + p * 0.12, -200); },
    bounce: (v) => { const vol = Math.min(0.3, v / 1800); hiss(0.04, vol, 'bandpass', 1800, 0, 2); tone(980, 0.04, 'sine', vol * 0.6); },
    cup: () => {
      hiss(0.12, 0.3, 'bandpass', 1500, 600, 2);
      setTimeout(() => tone(1046, 0.16, 'sine', 0.22), 90);
      setTimeout(() => tone(1318, 0.16, 'sine', 0.22), 190);
      setTimeout(() => tone(1568, 0.3, 'sine', 0.24), 290);
    },
    splash: () => { hiss(0.5, 0.45, 'lowpass', 3200, 350, 0.8); tone(700, 0.25, 'sine', 0.1, -450); },
    hot: () => { hiss(0.45, 0.32, 'highpass', 2500, 5000, 0.7); tone(420, 0.2, 'sawtooth', 0.06, -200); },
    moo: () => { tone(310, 0.6, 'sawtooth', 0.08, -120); tone(232, 0.65, 'triangle', 0.14, -80); },
    bell: () => { tone(1320, 0.25, 'triangle', 0.18); setTimeout(() => tone(1320, 0.3, 'triangle', 0.18), 180); },
    trumpet: () => { tone(520, 0.45, 'sawtooth', 0.09, 260); tone(780, 0.4, 'square', 0.04, 200); },
    whoosh: () => hiss(0.35, 0.3, 'bandpass', 800, 3000, 0.8),
    crack: () => { hiss(0.06, 0.5, 'highpass', 1800, 0, 0.7); tone(900, 0.05, 'square', 0.08, -300); },
  };
  const muteBtn = document.getElementById('mute');
  const showMute = () => {
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', muted ? 'Sound on' : 'Sound off');
  };
  showMute();
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem('wlgolf:muted', muted ? '1' : '0'); } catch {}
    showMute();
    unlockAudio();
    if (!muted) sfx.bounce(400); // a little click so you know it's on
  });

  // ---- Messages ----
  const toastEl = document.getElementById('toast');
  let toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1300);
  }
  const strokesEl = document.getElementById('strokes');
  const setStrokes = (n) => { strokes = n; strokesEl.textContent = `${n} stroke${n === 1 ? '' : 's'}`; };

  // ---- Geometry ----
  function inPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function segDist(x, y, [ax, ay], [bx, by]) {
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  }
  const pathDist = (x, y, path) => { let d = Infinity; for (let i = 1; i < path.length; i++) d = Math.min(d, segDist(x, y, path[i - 1], path[i])); return d; };
  function bounceOff(nx, ny, e) {
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot >= 0) return 0;
    ball.vx -= (1 + e) * dot * nx;
    ball.vy -= (1 + e) * dot * ny;
    return -dot;
  }
  function hitSegment([a, b], e) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((ball.x - a[0]) * dx + (ball.y - a[1]) * dy) / (dx * dx + dy * dy)));
    const px = a[0] + t * dx, py = a[1] + t * dy;
    const ox = ball.x - px, oy = ball.y - py;
    const d = Math.hypot(ox, oy);
    if (d >= BALL_R || d === 0) return 0;
    const nx = ox / d, ny = oy / d;
    ball.x = px + nx * BALL_R;
    ball.y = py + ny * BALL_R;
    return bounceOff(nx, ny, e);
  }
  function hitCircle(c, r, e) {
    const ox = ball.x - c.x, oy = ball.y - c.y;
    const d = Math.hypot(ox, oy);
    if (d >= r + BALL_R || d === 0) return 0;
    const nx = ox / d, ny = oy / d;
    ball.x = c.x + nx * (r + BALL_R);
    ball.y = c.y + ny * (r + BALL_R);
    return bounceOff(nx, ny, e);
  }

  /** Is (x, y) inside a shape: { rect: [x0, y0, x1, y1] }, { circle: [x, y, r] } or { poly: [...] }? */
  function inShape(s, x, y) {
    if (s.rect) return x > s.rect[0] && x < s.rect[2] && y > s.rect[1] && y < s.rect[3];
    if (s.circle) return Math.hypot(x - s.circle[0], y - s.circle[1]) < s.circle[2];
    if (s.poly) return inPoly(x, y, s.poly);
    return false;
  }
  // Rivers: worked out once per square unit of the course and remembered (1 = water, 2 = dry).
  const waterMap = new Uint8Array(W * H);
  const waterAt = (x, y) => (HOLE.rivers || []).some((r) => pathDist(x, y, r.path) < r.hw);
  const inWater = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return waterAt(x, y);
    const i = iy * W + ix;
    if (!waterMap[i]) waterMap[i] = waterAt(ix + 0.5, iy + 0.5) ? 1 : 2;
    return waterMap[i] === 1;
  };
  const inRiver = (x, y) => !!HOLE.rivers && inWater(x, y) && !(HOLE.dry && HOLE.dry(x, y));
  /** The ground under the ball: friction multiplier, a push (slopes) and a jitter (bumpy bricks). */
  function zoneAt(x, y) {
    let f = 1, ax = 0, ay = 0, jit = 0;
    for (const z of HOLE.zones) {
      if (!inShape(z, x, y)) continue;
      f *= z.friction ?? 1;
      if (z.push) { const [px, py] = typeof z.push === 'function' ? z.push(x, y) : z.push; ax += px; ay += py; }
      jit += z.jitter || 0;
    }
    return { f, ax, ay, jit };
  }
  /**
   * Bounce off a circle { kind: 'circle', x, y, r } or a capsule { kind: 'capsule', ax, ay, bx, by, r } that
   * may be moving: vx, vy, or vel(px, py) for things that turn. The bounce happens in its own frame.
   */
  function hitShape(sh, e) {
    let px = sh.x, py = sh.y;
    if (sh.kind === 'capsule') {
      const dx = sh.bx - sh.ax, dy = sh.by - sh.ay;
      const t = Math.max(0, Math.min(1, ((ball.x - sh.ax) * dx + (ball.y - sh.ay) * dy) / (dx * dx + dy * dy || 1)));
      px = sh.ax + t * dx; py = sh.ay + t * dy;
    }
    const ox = ball.x - px, oy = ball.y - py, d = Math.hypot(ox, oy);
    if (d >= sh.r + BALL_R) return 0;
    const nx = d ? ox / d : 0, ny = d ? oy / d : 1;
    ball.x = px + nx * (sh.r + BALL_R);
    ball.y = py + ny * (sh.r + BALL_R);
    const [mvx, mvy] = sh.vel ? sh.vel(px, py) : [sh.vx || 0, sh.vy || 0];
    ball.vx -= mvx; ball.vy -= mvy;
    const h = bounceOff(nx, ny, e);
    ball.vx += mvx; ball.vy += mvy;
    return h;
  }
  const moverShapes = (m, t = clock) => [].concat(m.at(t));
  function moverHit(m, h) {
    if (h < 15 || !(m.sound || m.toast) || clock - (m.lastHit ?? -9) < 1.4) return;
    m.lastHit = clock;
    if (m.sound && sfx[m.sound]) sfx[m.sound]();
    if (m.toast) toast(m.toast);
  }
  // Something moving into a ball that's sitting still shoves it aside (no stroke).
  function nudge() {
    for (const m of HOLE.movers) {
      for (const sh of moverShapes(m)) {
        if (!hitShape(sh, m.e ?? 0.5) && !touching(sh)) continue;
        aim = null;
        const sp = Math.hypot(ball.vx, ball.vy);
        if (sp < 40) { ball.vx *= 40 / (sp || 1); ball.vy *= 40 / (sp || 1); if (!sp) ball.vy = 40; }
        mode = 'rolling';
        if (m.nudge && clock - (m.lastHit ?? -9) > 1.4) { m.lastHit = clock; if (m.sound && sfx[m.sound]) sfx[m.sound](); toast(m.nudge); }
        return;
      }
    }
  }
  function touching(sh) {
    let px = sh.x, py = sh.y;
    if (sh.kind === 'capsule') {
      const dx = sh.bx - sh.ax, dy = sh.by - sh.ay;
      const t = Math.max(0, Math.min(1, ((ball.x - sh.ax) * dx + (ball.y - sh.ay) * dy) / (dx * dx + dy * dy || 1)));
      px = sh.ax + t * dx; py = sh.ay + t * dy;
    }
    return Math.hypot(ball.x - px, ball.y - py) < sh.r + BALL_R - 0.5;
  }

  let stuck = 0;
  function step(dt) {
    const z = zoneAt(ball.x, ball.y);
    let speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0) {
      const next = Math.max(0, speed - ROLL * z.f * dt) * (1 - DRAG * z.f * dt);
      ball.vx *= next / speed;
      ball.vy *= next / speed;
      speed = next;
    }
    if (z.ax || z.ay) { ball.vx += z.ax * dt; ball.vy += z.ay * dt; }
    if (z.jit && speed > 30) {
      const a = (Math.random() - 0.5) * z.jit * dt * 60, cs = Math.cos(a), sn = Math.sin(a);
      [ball.vx, ball.vy] = [ball.vx * cs - ball.vy * sn, ball.vx * sn + ball.vy * cs];
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    let hit = 0;
    for (const w of walls) hit = Math.max(hit, hitSegment(w, WALL_BOUNCE));
    for (const o of HOLE.circles) hit = Math.max(hit, hitCircle(o, o.r, o.e ?? 0.6));
    for (const o of HOLE.capsules) hit = Math.max(hit, hitShape({ kind: 'capsule', ...o }, o.e ?? WALL_BOUNCE));
    for (const m of HOLE.movers) {
      for (const sh of moverShapes(m)) {
        const h = hitShape(sh, m.e ?? 0.5);
        moverHit(m, h);
        hit = Math.max(hit, h);
      }
    }
    if (hit > 60 && clock - lastBounce > 0.06) { sfx.bounce(hit); lastBounce = clock; }

    for (const hz of HOLE.hazards) {
      if (!inShape(hz, ball.x, ball.y)) continue;
      splash = { x: ball.x, y: ball.y, t: clock, fire: !!hz.fire };
      return penalty(hz.text || '💦 Splash! +1 stroke', hz.fire ? sfx.hot : sfx.splash);
    }
    if (inRiver(ball.x, ball.y)) {
      splash = { x: ball.x, y: ball.y, t: clock };
      return penalty(HOLE.riverText || '💦 Splash! +1 stroke', sfx.splash);
    }

    // The cup: slow balls drop, fast ones lip out; nearly-stopped balls get pulled in.
    const cx = ball.x - HOLE.cup.x, cy = ball.y - HOLE.cup.y;
    const cd = Math.hypot(cx, cy);
    speed = Math.hypot(ball.vx, ball.vy);
    if (cd < HOLE.cup.r) {
      if (speed < SINK_SPEED) {
        mode = 'sinking';
        sinkStart = clock;
        sfx.cup();
        return;
      }
      ball.vx = ball.vx * 0.55 + (cx / (cd || 1)) * 60;
      ball.vy = ball.vy * 0.55 + (cy / (cd || 1)) * 60;
    } else if (cd < HOLE.cup.r + 5 && speed < 90) {
      ball.vx -= (cx / cd) * 400 * dt;
      ball.vy -= (cy / cd) * 400 * dt;
    }

    if (Math.hypot(ball.vx, ball.vy) < STOP) {
      // On a slope the ball keeps rolling unless something holds it there.
      if ((z.ax || z.ay) && ++stuck < 90) return;
      stuck = 0;
      ball.vx = ball.vy = 0;
      mode = 'aim';
    } else stuck = 0;
  }

  // ---- Play ----
  function shoot(dirX, dirY, power) {
    if (mode !== 'aim') return;
    const len = Math.hypot(dirX, dirY) || 1;
    const speed = Math.max(0.04, Math.min(1, power)) * MAX_SPEED;
    ball.vx = (dirX / len) * speed;
    ball.vy = (dirY / len) * speed;
    shotFrom = { x: ball.x, y: ball.y };
    setStrokes(strokes + 1);
    mode = 'rolling';
    sfx.putt(power);
    tipEl.classList.add('hide');
  }

  function penalty(text, sound) {
    mode = 'penalty';
    ball.vx = ball.vy = 0;
    sound();
    toast(text);
    setStrokes(strokes + 1);
    setTimeout(() => {
      ball.x = shotFrom.x;
      ball.y = shotFrom.y;
      mode = 'aim';
    }, 900);
  }

  let sinkStart = 0;
  function sinking() {
    const k = Math.min(1, (clock - sinkStart) / 0.3);
    ball.x += (HOLE.cup.x - ball.x) * 0.3;
    ball.y += (HOLE.cup.y - ball.y) * 0.3;
    ball.scale = 1 - k * 0.6;
    if (k >= 1) {
      mode = 'done';
      setTimeout(finish, 350);
    }
  }

  // ---- Result card ----
  const NAMES = { '-3': 'Albatross!', '-2': 'Eagle! 🦅', '-1': 'Birdie! 🐦', '0': 'Par!', '1': 'Bogey', '2': 'Double bogey', '3': 'Triple bogey' };
  // There's no stroke limit: keep putting until it drops.
  function finish() {
    mode = 'done';
    const diff = strokes - HOLE.par;
    const name = strokes === 1 ? 'Hole in one! 🎉' : NAMES[String(diff)] ?? `+${diff}`;
    const stars = diff <= -1 ? 3 : diff === 0 ? 2 : diff === 1 ? 1 : 0;
    document.getElementById('result').textContent = name;
    document.getElementById('scoreline').textContent = `${strokes} stroke${strokes === 1 ? '' : 's'} · Par ${HOLE.par}`;
    document.getElementById('stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    document.getElementById('card').classList.add('show');
    let best = 0;
    try {
      best = Number(localStorage.getItem(`wlgolf:h${no}:best`) || 0);
      if (!best || strokes < best) localStorage.setItem(`wlgolf:h${no}:best`, String(strokes));
    } catch {}
    postEl.textContent = '';
    lastStrokes = strokes;
    showVersus(strokes);
    sharerName();
    if (no === TOTAL) {
      // The last hole: add up their best on every hole.
      let bests = [];
      try { bests = PARS.map((_, i) => Number(localStorage.getItem(`wlgolf:h${i + 1}:best`) || 0)); } catch {}
      const done = bests.filter(Boolean).length;
      document.getElementById('soon').textContent = done === TOTAL
        ? `Your best on all 9 holes adds up to ${bests.reduce((a, b) => a + b, 0)} (par ${PARS.reduce((a, b) => a + b, 0)})`
        : `You've sunk ${done} of 9 holes. Finish them all to see your best round.`;
    }
    if (strokes <= 99) postScore(strokes, best && strokes < best);
  }
  function restart() {
    document.getElementById('card').classList.remove('show');
    Object.assign(ball, { x: HOLE.tee.x, y: HOLE.tee.y, vx: 0, vy: 0, scale: 1 });
    shotFrom = { x: ball.x, y: ball.y };
    setStrokes(0);
    mode = 'aim';
  }
  document.getElementById('again').addEventListener('click', () => { unlockAudio(); restart(); });

  // ---- Leaderboard ----
  // Uses the same sign-in as the Wichita Life website (this page is on the same site), so members signed
  // in there post their score automatically. Signed out, the score waits here while they sign in.
  const SUPABASE_URL = 'https://rbxmzybuduluzpvtgfil.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_s7hjBmulNZngD8loif06Rg_HiMGwTd7';
  const HOLE_NO = no;
  const PENDING = 'wlgolf:pending';
  const SIGN_IN = `/sign-in?next=${encodeURIComponent(location.pathname.replace(/\/$/, '') || '/golf')}&reason=${encodeURIComponent('Sign in to get on the leaderboard')}`;
  const postEl = document.getElementById('post');
  const boardEl = document.getElementById('board');
  const rowsEl = document.getElementById('rows');
  const boardNote = document.getElementById('board-note');
  let sb = null;
  function client() {
    sb ??= new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = '/golf/supabase-js-2.118.0.js';
      // Inside the Wichita Life app, use the sign-in the app handed over; on the website, the website's own.
      tag.onload = () => resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, appToken()
        ? { accessToken: async () => appToken() }
        : { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' } }));
      tag.onerror = () => { sb = null; reject(new Error('offline')); };
      document.head.appendChild(tag);
    });
    return sb;
  }
  // The Wichita Life app hands over its sign-in as #app=<token> in the address; keep it for the other holes.
  function appToken() {
    if (window.WL_APP_TOKEN) return window.WL_APP_TOKEN;
    try {
      const m = location.hash.match(/(?:^#|&)app=([^&]+)/);
      if (m) sessionStorage.setItem('wl:app-token', decodeURIComponent(m[1]));
      window.WL_APP_TOKEN = sessionStorage.getItem('wl:app-token') || '';
    } catch {
      window.WL_APP_TOKEN = '';
    }
    return window.WL_APP_TOKEN;
  }
  async function signedIn() {
    const c = await client();
    if (appToken()) return c;
    const { data } = await c.auth.getSession();
    return data.session ? c : null;
  }
  const strokeWord = (n) => `${n} stroke${n === 1 ? '' : 's'}`;
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  function placeLine(r) {
    return r.place === 1 ? '🏆 You’re #1 on the leaderboard!' : `🏆 You’re #${r.place} on the leaderboard`;
  }
  async function postScore(n, personalBest = false) {
    postEl.textContent = 'Posting your score…';
    try {
      const c = await signedIn();
      if (!c) {
        try { localStorage.setItem(PENDING, JSON.stringify({ hole: HOLE_NO, strokes: n, at: Date.now() })); } catch {}
        postEl.innerHTML = `<a href="${SIGN_IN}">Sign in to put this on the leaderboard ›</a>`;
        return;
      }
      const { data, error } = await c.rpc('golf_post_score', { p_hole: HOLE_NO, p_strokes: n });
      if (error) throw error;
      const r = data?.[0];
      if (!r) throw new Error('no result');
      postEl.innerHTML = `${personalBest ? 'New personal best! ' : ''}${esc(placeLine(r))}<br><button class="linkish" id="see-board">See the leaderboard ›</button>${HOLE_NO === TOTAL ? ' · <button class="linkish" id="see-course">All 9 holes ›</button>' : ''}`;
      document.getElementById('see-board').addEventListener('click', () => openBoard('hole'));
      document.getElementById('see-course')?.addEventListener('click', () => openBoard('course'));
    } catch {
      postEl.innerHTML = 'Couldn’t reach the leaderboard. <button class="linkish" id="retry-post">Try again</button>';
      document.getElementById('retry-post').addEventListener('click', () => postScore(n, personalBest));
    }
  }
  // The board has two tabs: this hole, and all 9 holes (each golfer's best on every hole, added up).
  let boardKind = 'hole';
  const boardSub = document.getElementById('board-sub');
  const HOLE_SUB = boardSub.textContent;
  for (const [id, kind] of [['tab-hole', 'hole'], ['tab-course', 'course']]) {
    document.getElementById(id).addEventListener('click', () => openBoard(kind));
  }
  async function openBoard(kind) {
    if (kind === 'hole' || kind === 'course') boardKind = kind;
    const course = boardKind === 'course';
    boardEl.classList.add('show');
    for (const [id, on] of [['tab-hole', !course], ['tab-course', course]]) {
      const tab = document.getElementById(id);
      tab.classList.toggle('on', on);
      tab.setAttribute('aria-selected', String(on));
    }
    boardSub.textContent = course ? 'Your best on every hole, added up · par 30' : HOLE_SUB;
    rowsEl.innerHTML = '<li class="empty">Loading…</li>';
    boardNote.textContent = '';
    try {
      const c = await client();
      const [{ data, error }, me] = await Promise.all([
        course ? c.rpc('golf_course_leaderboard', { p_limit: 10 }) : c.rpc('golf_leaderboard', { p_hole: HOLE_NO, p_limit: 10 }),
        signedIn(),
      ]);
      if (error) throw error;
      const all = data ?? [];
      const rows = all.filter((r) => r.place != null);
      const mine = all.find((r) => r.is_me);
      if (!rows.length) {
        rowsEl.innerHTML = course
          ? '<li class="empty">Nobody has finished all 9 holes yet. Be the first!</li>'
          : '<li class="empty">No scores yet. Sink one and you’re #1.</li>';
      } else {
        let html = '';
        rows.forEach((r, i) => {
          if (i && r.place - rows[i - 1].place > 1) html += '<li class="gap">⋯</li>';
          html += `<li class="${r.is_me ? 'me' : ''}"><span class="place">${r.place}</span><span class="who">${esc(r.name)}${r.is_me ? ' (you)' : ''}</span><span class="n">${strokeWord(course ? r.total : r.best)}</span></li>`;
        });
        rowsEl.innerHTML = html;
      }
      const players = rows[0]?.players ?? mine?.players ?? 0;
      const who = `${players} golfer${players === 1 ? '' : 's'}`;
      boardNote.innerHTML = !me
        ? `<a class="linkish" href="${SIGN_IN}">Sign in</a> to get on the board.`
        : course
          ? mine && mine.place == null
            ? `You’ve sunk ${mine.holes} of 9 holes. Finish them all to get on this board.`
            : mine
              ? `${who} ${players === 1 ? 'has' : 'have'} finished all 9. Ties go to whoever finished first.`
              : 'Sink all 9 holes to get on this board.'
          : mine
            ? `${who} so far. Ties go to whoever got there first.`
            : 'Sink the hole to get on the board.';
    } catch {
      rowsEl.innerHTML = '<li class="empty">Couldn’t load the leaderboard. Check your connection and try again.</li>';
    }
  }
  // ---- Challenges: "Try to beat my score!" ----
  // A shared link carries the sharer's score and name (?c=3&n=Ana%20L.): it's shown over the hole and
  // compared on the result card. Sharing from the result card makes one of those links.
  // (If they had to sign in first, the challenge waited in this tab's storage; see gate.js.)
  const challengeKey = `wl:challenge:${location.pathname.replace(/\/$/, '')}`;
  let cp = params;
  if (!cp.has('c')) {
    try { cp = new URLSearchParams(sessionStorage.getItem(challengeKey) || ''); } catch { cp = params; }
  }
  const challengeStrokes = Number(cp.get('c'));
  const challenge = challengeStrokes >= 1 && challengeStrokes <= 99
    ? { strokes: challengeStrokes, name: (cp.get('n') || '').trim().slice(0, 24) || 'Your friend' }
    : null;
  if (challenge) {
    document.getElementById('tip').innerHTML = `⛳ <b>${esc(challenge.name)}</b> got ${challenge.strokes === 1 ? 'a hole in one' : strokeWord(challenge.strokes)} here. Can you beat it?<br>Drag back anywhere to aim, then let go to putt.`;
  }
  let lastStrokes = 0;
  function showVersus(n) {
    const vs = document.getElementById('vs');
    if (!challenge) { vs.textContent = ''; return; }
    const d = challenge.strokes - n;
    vs.textContent = d > 0 ? `🎉 You beat ${challenge.name} by ${strokeWord(d)}!`
      : d === 0 ? `🤝 You tied ${challenge.name}!`
      : `${challenge.name} still wins with ${strokeWord(challenge.strokes)}. Play again?`;
  }
  // The sharer's display name ("Ana L."), looked up when the card shows so the share can go out on the tap
  // (phones only let a page open the share sheet straight from a tap).
  let myName = null;
  async function sharerName() {
    if (myName !== null) return myName;
    myName = '';
    try {
      const c = await signedIn();
      if (!c) return myName;
      const token = appToken();
      const uid = token
        ? JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub
        : (await c.auth.getSession()).data.session?.user.id;
      const { data } = await c.from('profiles').select('display_name').eq('id', uid).maybeSingle();
      myName = (data?.display_name || '').trim().slice(0, 24);
    } catch {
      myName = '';
    }
    return myName;
  }
  document.getElementById('challenge').addEventListener('click', () => {
    const n = lastStrokes;
    const url = `https://app.wichitalifeict.com/golf/${HOLE_NO === 1 ? '' : `${HOLE_NO}/`}?c=${n}${myName ? `&n=${encodeURIComponent(myName)}` : ''}`;
    const name = document.querySelector('h1').textContent;
    const text = `⛳ I got ${n === 1 ? 'a hole in one' : strokeWord(n)} on Hole ${HOLE_NO} (${name}) in Wichita Mini Golf. Try to beat my score!`;
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'share', hole: HOLE_NO, strokes: n, text, url }));
    } else if (navigator.share) {
      navigator.share({ text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${text} ${url}`).then(() => toast('Link copied. Send it to a friend!'), () => toast(url));
    } else {
      toast(url);
    }
  });
  document.getElementById('board-btn').addEventListener('click', () => { unlockAudio(); openBoard(); });
  document.getElementById('board-close').addEventListener('click', () => boardEl.classList.remove('show'));
  boardEl.addEventListener('click', (e) => { if (e.target === boardEl) boardEl.classList.remove('show'); });

  // Back from signing in with a score waiting (from the last half hour): post it now.
  (async () => {
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(PENDING) || 'null'); } catch {}
    if (!pending || pending.hole !== HOLE_NO || Date.now() - pending.at > 30 * 60 * 1000) return;
    try {
      const c = await signedIn();
      if (!c) return;
      localStorage.removeItem(PENDING);
      const { data, error } = await c.rpc('golf_post_score', { p_hole: HOLE_NO, p_strokes: pending.strokes });
      if (error || !data?.[0]) return;
      toast(`${placeLine(data[0])} 🎉`);
      setTimeout(() => openBoard('hole'), 1400);
    } catch {}
  })();

  // ---- Aiming: drag back from anywhere, the shot goes the other way ----
  const tipEl = document.getElementById('tip');
  const toWorld = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: ((e.clientY - r.top) / scale - VIEW.sky) / VIEW.sq };
  };
  canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    if (mode !== 'aim') return;
    const p = toWorld(e);
    aim = { sx: p.x, sy: p.y, x: p.x, y: p.y };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!aim) return;
    const p = toWorld(e);
    aim.x = p.x;
    aim.y = p.y;
  });
  const release = () => {
    unlockAudio();
    if (!aim) return;
    const dx = aim.sx - aim.x, dy = aim.sy - aim.y;
    const power = Math.min(1, Math.hypot(dx, dy) / MAX_DRAG);
    aim = null;
    if (power > 0.05) shoot(dx, dy, power);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', () => { aim = null; });

  // ---- Drawing ----
  // A tilted camera: the ground is drawn squashed (SQ) under a strip of sunset sky with the Wichita
  // skyline, and upright things (the rails, scenery, trees, the flag, the ball) stand
  // up off it, drawn back to front. The physics stays flat; only the picture tilts. Light comes from
  // the top left. Scenery that never moves is painted once into a background canvas.
  const SQ = VIEW.sq;
  let SKY = VIEW.sky;
  const G = (y) => SKY + y * SQ; // ground y on screen
  const SHADOW = 'rgba(12, 34, 20, .30)';
  const TREES = HOLE.trees || [[10, 150, 14], [350, 146, 15], [8, 300, 13], [352, 300, 16], [10, 470, 17], [350, 520, 15], [12, 590, 14], [348, 604, 13]];
  const RAIL_H = 7;
  const POT_H = 7;

  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  function polyPath(c, poly) {
    c.beginPath();
    poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
  }
  function noise(c, n, light, dark, size, x0 = 0, y0 = 0, w = W, h = H) {
    for (let i = 0; i < n; i++) {
      c.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${light})` : `rgba(0,0,0,${dark})`;
      c.fillRect(x0 + rnd() * w, y0 + rnd() * h, size, size);
    }
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  /** A short upright cylinder standing on the ground at world (x, y). */
  function cylinder(c, x, y, r, h, light, mid, dark, top) {
    const gy = G(y);
    const ry = r * SQ;
    const g = c.createLinearGradient(x - r, 0, x + r, 0);
    g.addColorStop(0, light); g.addColorStop(0.5, mid); g.addColorStop(1, dark);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - r, gy - h);
    c.lineTo(x - r, gy);
    c.ellipse(x, gy, r, ry, 0, Math.PI, 0, true);
    c.lineTo(x + r, gy - h);
    c.closePath();
    c.fill();
    c.strokeStyle = '#15294A'; c.lineWidth = 1.3; c.stroke();
    c.fillStyle = top;
    c.beginPath(); c.ellipse(x, gy - h, r, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  }

  function tree(c, x, y, r) {
    const gy = G(y);
    c.fillStyle = SHADOW;
    c.beginPath(); c.ellipse(x + r * 0.5, gy + 2, r * 1.1, r * 0.55, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6B4A2E';
    c.fillRect(x - 2, gy - 9, 4, 10);
    for (const [dx, dy, s] of [[-0.4, -0.9, 0.7], [0.4, -0.95, 0.72], [0, -1.35, 0.78], [0, -0.85, 0.85]]) {
      const cx = x + dx * r, cy = gy + dy * r - 6, rr = s * r;
      const g = c.createRadialGradient(cx - rr * 0.4, cy - rr * 0.45, rr * 0.1, cx, cy, rr);
      g.addColorStop(0, '#5BAA72');
      g.addColorStop(1, '#245E38');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, rr, 0, Math.PI * 2); c.fill();
    }
  }

  function paintSky(c) {
    const g = c.createLinearGradient(0, 0, 0, SKY);
    g.addColorStop(0, '#79AEE1'); g.addColorStop(0.55, '#BFD7EE'); g.addColorStop(1, '#FAD4A0');
    c.fillStyle = g;
    c.fillRect(0, 0, W, SKY + 2);
    const sx = 292, sy = SKY - 30;
    const sg = c.createRadialGradient(sx, sy, 4, sx, sy, 70);
    sg.addColorStop(0, 'rgba(255,238,190,.95)'); sg.addColorStop(0.25, 'rgba(255,214,150,.5)'); sg.addColorStop(1, 'rgba(255,200,140,0)');
    c.fillStyle = sg;
    c.fillRect(0, 0, W, SKY);
    c.fillStyle = '#FFEDC2';
    c.beginPath(); c.arc(sx, sy, 13, 0, Math.PI * 2); c.fill();
    const clouds = [[58, SKY - 72, 1], [176, SKY - 82, 0.75], [338, SKY - 56, 0.65]];
    if (SKY > 170) clouds.push([110, SKY - 150, 0.9], [280, SKY - 135, 1.1], [20, SKY - 185, 0.7], [220, SKY - 210, 0.8]);
    for (const [x, y, s] of clouds) {
      c.fillStyle = 'rgba(255,255,255,.78)';
      c.beginPath();
      c.ellipse(x, y, 22 * s, 6.5 * s, 0, 0, Math.PI * 2);
      c.ellipse(x + 11 * s, y - 4 * s, 13 * s, 6.5 * s, 0, 0, Math.PI * 2);
      c.ellipse(x - 11 * s, y - 2 * s, 11 * s, 5 * s, 0, 0, Math.PI * 2);
      c.fill();
    }
    // Hazy far buildings.
    c.fillStyle = 'rgba(105,135,180,.42)';
    for (const [x, w, h] of [[6, 18, 22], [30, 13, 30], [118, 20, 27], [146, 11, 36], [246, 16, 31], [268, 22, 24], [314, 14, 29], [336, 20, 21]]) c.fillRect(x, SKY - h, w, h);
    // Downtown Wichita.
    const ink = '#3F5C88', inkDark = '#344E77';
    const towers = [[22, 15, 27], [150, 18, 45], [171, 13, 34], [232, 20, 53], [255, 14, 38], [272, 18, 30]];
    for (const [x, w, h] of towers) {
      c.fillStyle = ink; c.fillRect(x, SKY - h, w, h);
      c.fillStyle = inkDark; c.fillRect(x + w - 4, SKY - h, 4, h);
    }
    // The Epic Center: stepped top and spire.
    c.fillStyle = ink;
    c.fillRect(196, SKY - 58, 28, 58); c.fillRect(200, SKY - 66, 20, 8); c.fillRect(204, SKY - 73, 12, 7); c.fillRect(207.5, SKY - 79, 5, 6);
    c.fillRect(209.3, SKY - 91, 1.4, 12);
    c.fillStyle = inkDark; c.fillRect(219, SKY - 58, 5, 58);
    if (HOLE.century !== false) {
    // Century II's round blue roof.
    c.fillStyle = inkDark; c.fillRect(56, SKY - 11, 86, 11);
    const dg = c.createLinearGradient(56, 0, 142, 0);
    dg.addColorStop(0, '#6C9BD6'); dg.addColorStop(1, '#3E6CAD');
    c.fillStyle = dg;
    c.beginPath(); c.ellipse(99, SKY - 11, 41, 17, 0, Math.PI, 0); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 0.8;
    for (const f of [0.35, 0.6, 0.85]) {
      c.beginPath(); c.ellipse(99, SKY - 11, 41 * f, 17, 0, Math.PI, 0); c.stroke();
    }
    }
    // Lit windows.
    seed = 99;
    c.fillStyle = 'rgba(255,230,165,.9)';
    for (const [x, w, h] of [[150, 18, 45], [232, 20, 53], [196, 28, 58], [255, 14, 38], [171, 13, 34]]) {
      for (let yy = SKY - h + 5; yy < SKY - 5; yy += 6) for (let xx = x + 3; xx < x + w - 4; xx += 5) if (rnd() < 0.28) c.fillRect(xx, yy, 2, 2.4);
    }
    // Tree line along the horizon.
    for (let x = -6, i = 0; x < W + 10; x += 12, i++) {
      c.fillStyle = i % 2 ? '#2F6E46' : '#28623E';
      c.beginPath(); c.arc(x, SKY + 2, 8 + ((i * 7) % 5), Math.PI, 0); c.fill();
    }
  }

  // What a hole's drawing hooks get: the camera, the helpers and the live state.
  const api = {
    W, H, SQ, BALL_R, G: (y) => G(y), SHADOW,
    get SKY() { return SKY; }, get clock() { return clock; }, get ball() { return ball; }, get mode() { return mode; },
    rnd: () => rnd(), noise: (...a) => noise(...a), polyPath, roundRect, cylinder, tree, inShape,
    shapes: (m, t) => moverShapes(m, t),
    /** A flat world-space shape path on c (rect / circle / poly), for painting zones and hazards. */
    shapePath(c, s) {
      c.beginPath();
      if (s.rect) c.rect(s.rect[0], s.rect[1], s.rect[2] - s.rect[0], s.rect[3] - s.rect[1]);
      else if (s.circle) c.arc(s.circle[0], s.circle[1], s.circle[2], 0, Math.PI * 2);
      else if (s.poly) s.poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
    },
    /** An upright box standing on a capsule's footprint (hedges, wings, walls): top and near face. */
    box(c, ax, ay, bx, by, r, h, top, side, edge = '#15294A') {
      const x0 = Math.min(ax, bx) - r, x1 = Math.max(ax, bx) + r, y0 = Math.min(ay, by) - r, y1 = Math.max(ay, by) + r;
      c.fillStyle = side; c.fillRect(x0, G(y1) - h, x1 - x0, h);
      c.strokeStyle = edge; c.lineWidth = 1.1; c.strokeRect(x0, G(y1) - h, x1 - x0, h);
      c.fillStyle = top; c.fillRect(x0, G(y0) - h, x1 - x0, G(y1) - G(y0));
      c.strokeRect(x0, G(y0) - h, x1 - x0, G(y1) - G(y0));
    },
  };

  function paintGround(c) {
    // Everything here lies flat, so it's drawn in world units with the tilt applied.
    c.save();
    c.transform(1, 0, 0, SQ, 0, SKY);
    c.beginPath(); c.rect(0, 0, W, H); c.clip();
    c.fillStyle = HOLE.outside || '#2D7045';
    c.fillRect(0, 0, W, H);
    noise(c, 2400, 0.05, 0.08, 1.3);
    if (HOLE.paintOutside) HOLE.paintOutside(c, api);
    c.save(); c.translate(2, 6); polyPath(c, HOLE.bounds); c.fillStyle = SHADOW; c.fill(); c.restore();
    c.save();
    polyPath(c, HOLE.bounds);
    c.fillStyle = HOLE.turf || '#5DB574';
    c.fill();
    c.clip();
    if (HOLE.stripes !== false) {
      for (let i = 0, y = -60; y < H + 60; y += 34, i++) {
        c.fillStyle = i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.04)';
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y + 26); c.lineTo(W, y + 60); c.lineTo(0, y + 34); c.closePath(); c.fill();
      }
    }
    noise(c, 2800, 0.07, 0.05, 1);
    if (HOLE.paintTurf) HOLE.paintTurf(c, api);
    const lg = c.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, 'rgba(255,220,150,.10)'); lg.addColorStop(1, 'rgba(0,30,20,.10)');
    c.fillStyle = lg; c.fillRect(0, 0, W, H);
    c.restore();

    if (HOLE.rivers) {
      const stroke = (path, w, color) => {
        c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); path.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      };
      for (const r of HOLE.rivers) stroke(r.path, 2 * r.hw + 14, '#D9C59B');
      for (const [inset, color] of [[0, '#3F77B6'], [5, '#5A93CD'], [14, '#6AA3D8']]) {
        for (const r of HOLE.rivers) stroke(r.path, Math.max(2, 2 * (r.hw - inset)), color);
      }
    }
    if (HOLE.paintGround) HOLE.paintGround(c, api);

    const t = HOLE.tee;
    c.fillStyle = SHADOW; roundRect(c, t.x - 17, t.y - 10, 36, 23, 4); c.fill();
    c.fillStyle = '#3B8F52'; roundRect(c, t.x - 18, t.y - 12, 36, 23, 4); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; c.stroke();
    const cu = HOLE.cup;
    c.fillStyle = '#EAF3E7';
    c.beginPath(); c.arc(cu.x, cu.y, cu.r + 2.5, 0, Math.PI * 2); c.fill();
    const cg = c.createRadialGradient(cu.x + 2, cu.y + 3, 1, cu.x, cu.y, cu.r);
    cg.addColorStop(0, '#0B120E'); cg.addColorStop(1, '#2B3A30');
    c.fillStyle = cg;
    c.beginPath(); c.arc(cu.x, cu.y, cu.r, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  const RAIL = { side: '#9C3338', top: '#C6464B', light: '#EE8A8E', cap: '#F5E6C8', ...(HOLE.rail || {}) };
  /** The bumper rail, standing RAIL_H tall, its edges drawn far to near. */
  function paintRails(c) {
    const pts = HOLE.bounds.map(([x, y]) => [x, G(y)]);
    const edges = pts.map((p, i) => [p, pts[(i + 1) % pts.length]]).sort((a, b) => (a[0][1] + a[1][1]) - (b[0][1] + b[1][1]));
    c.lineJoin = 'round';
    for (const [a, b] of edges) {
      c.fillStyle = RAIL.side;
      c.beginPath();
      c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0], b[1] - RAIL_H); c.lineTo(a[0], a[1] - RAIL_H);
      c.closePath(); c.fill();
      c.strokeStyle = '#15294A'; c.lineWidth = 1.2; c.stroke();
    }
    const top = pts.map(([x, y]) => [x, y - RAIL_H]);
    polyPath(c, top);
    c.strokeStyle = '#15294A'; c.lineWidth = 10; c.stroke();
    c.strokeStyle = RAIL.top; c.lineWidth = 7.5; c.stroke();
    c.save(); c.translate(-0.7, -1); polyPath(c, top); c.strokeStyle = RAIL.light; c.lineWidth = 2.2; c.stroke(); c.restore();
    if (RAIL.cap) {
      for (const [x, y] of top) {
        c.fillStyle = RAIL.cap; c.strokeStyle = '#15294A'; c.lineWidth = 1;
        c.beginPath(); c.arc(x, y, 2.3, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    }
  }

  function paintBackground(c) {
    seed = 20261123 + no;
    paintSky(c);
    paintGround(c);
    if (HOLE.paintScenery) HOLE.paintScenery(c, api);
    [...TREES].filter(([, y]) => y < 200).sort((a, b) => a[1] - b[1]).forEach(([x, y, r]) => tree(c, x, y, r));
    paintRails(c);
    [...TREES].filter(([, y]) => y >= 200).sort((a, b) => a[1] - b[1]).forEach(([x, y, r]) => tree(c, x, y, r));
  }

  const bg = document.createElement('canvas');
  const bgx = bg.getContext('2d');
  let bgKey = '';
  function ensureBackground() {
    const key = `${canvas.width}x${canvas.height}x${VIEW.sky}`;
    if (key === bgKey) return;
    bgKey = key;
    SKY = VIEW.sky;
    bg.width = canvas.width;
    bg.height = canvas.height;
    const k = canvas.width / W;
    bgx.setTransform(k, 0, 0, k, 0, 0);
    paintBackground(bgx);
  }
  // Repaint once the brand fonts arrive (the mowed "ICT" uses Poppins).
  if (document.fonts) document.fonts.ready.then(() => { bgKey = ''; });

  // ---- Effects (particles live on the ground at x, y and rise to height z) ----
  const parts = [];
  function burst(x, y, n, kind, z = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = kind === 'confetti' ? 30 + Math.random() * 70 : 20 + Math.random() * 60;
      parts.push({
        x, y, z, kind,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        vz: kind === 'confetti' ? 130 + Math.random() * 90 : 70 + Math.random() * 90,
        life: 0, max: kind === 'confetti' ? 1.2 + Math.random() * 0.5 : 0.6 + Math.random() * 0.4,
        size: kind === 'confetti' ? 2.6 + Math.random() * 2 : 1.4 + Math.random() * 1.8,
        color: kind === 'drop' ? (Math.random() < 0.5 ? '#FFFFFF' : '#A8CCF0')
          : kind === 'spark' ? (Math.random() < 0.5 ? '#FFD27A' : '#F59A3C')
          : ['#DC5B5F', '#F8BE6A', '#6AA1D6', '#FFFFFF', '#3F8F5A'][Math.floor(Math.random() * 5)],
        spin: Math.random() * 6,
      });
    }
  }
  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life > p.max || p.z < 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.kind === 'ember') { p.vx *= 0.98; }
      else { p.vz -= (p.kind === 'confetti' ? 260 : 340) * dt; p.vx *= 0.97; p.vy *= 0.97; p.spin += dt * 9; }
    }
  }
  function drawParts() {
    for (const p of parts) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      const sx = p.x, sy = G(p.y) - p.z;
      if (p.kind === 'confetti') {
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.spin);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(sx, sy, p.size * (p.kind === 'ember' ? 0.4 + a * 0.6 : 1), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function ground(fn) {
    ctx.save();
    ctx.transform(1, 0, 0, SQ, 0, SKY);
    fn();
    ctx.restore();
  }

  /** A point `d` along a river's smoothed line, with its direction. */
  function alongRiver(r, d) {
    const p = r.path;
    for (let i = 1; i < p.length; i++) {
      const sl = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (d <= sl || i === p.length - 1) {
        const t = Math.min(1, d / sl);
        return { x: p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, y: p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t, ux: (p[i][0] - p[i - 1][0]) / sl, uy: (p[i][1] - p[i - 1][1]) / sl };
      }
      d -= sl;
    }
    return null;
  }
  function drawWater() {
    ground(() => {
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      ctx.lineCap = 'round';
      HOLE.rivers.forEach((r, ri) => {
        const n = Math.round(r.len / 22);
        for (let i = 0; i < n; i++) {
          const q = alongRiver(r, (i * 22 + ((i * 7) % 5) * 4 + clock * (12 + ri * 3)) % r.len);
          const side = (((i * 37) % 7) / 6 - 0.5) * r.hw * 1.3;
          const x = q.x - q.uy * side, y = q.y + q.ux * side;
          if (!inRiver(x - q.ux * 9, y - q.uy * 9) || !inRiver(x + q.ux * 9, y + q.uy * 9)) continue;
          ctx.strokeStyle = `rgba(255,255,255,${0.24 + 0.12 * Math.sin(clock * 2 + i)})`;
          ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(x - q.ux * 9, y - q.uy * 9);
          ctx.quadraticCurveTo(x + q.uy * 3.5, y - q.ux * 3.5, x + q.ux * 9, y + q.uy * 9); ctx.stroke();
        }
        for (let i = 0; i < n / 2; i++) {
          const q = alongRiver(r, (i * 41 + 13) % r.len);
          const side = (((i * 13) % 9) / 8 - 0.5) * r.hw * 1.4;
          const x = q.x - q.uy * side, y = q.y + q.ux * side;
          if (!inRiver(x, y)) continue;
          const a = Math.max(0, Math.sin(clock * 3 + i * 1.7 + ri));
          ctx.fillStyle = `rgba(255,255,255,${0.6 * a})`;
          ctx.fillRect(x, y, 6, 1.8);
        }
        if (r.label) {
          const q = alongRiver(r, r.at);
          ctx.save();
          ctx.translate(q.x, q.y); ctx.rotate(Math.atan2(q.uy, q.ux));
          ctx.fillStyle = 'rgba(255,255,255,.6)';
          ctx.font = 'italic 600 11px "Open Sans", sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(r.label, 0, r.hw > 30 ? 12 : 0);
          ctx.restore();
        }
      });
    });
  }

  function drawSplashRings() {
    if (!splash) return;
    if (!splash.fx) {
      splash.fx = true;
      burst(splash.x, splash.y, splash.fire ? 22 : 18, splash.fire ? 'spark' : 'drop', splash.fire ? POT_H + 8 : 2);
    }
    const age = clock - splash.t;
    if (age > 0.9) { splash = null; return; }
    if (splash.fire) return;
    ground(() => {
      ctx.strokeStyle = `rgba(255,255,255,${1 - age / 0.9})`;
      ctx.lineWidth = 2;
      for (const r of [age * 34, age * 58]) {
        ctx.beginPath(); ctx.arc(splash.x, splash.y, r + 4, 0, Math.PI * 2); ctx.stroke();
      }
    });
  }

  function drawFlag() {
    const c = HOLE.cup;
    const base = G(c.y);
    const top = base - 50;
    ctx.strokeStyle = '#E9E4DA'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(c.x, base); ctx.lineTo(c.x, top); ctx.stroke();
    ctx.strokeStyle = '#15294A'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(c.x + 1.2, base); ctx.lineTo(c.x + 1.2, top); ctx.stroke();
    const w1 = Math.sin(clock * 4) * 2.5, w2 = Math.sin(clock * 4 + 1.2) * 2.5;
    ctx.fillStyle = '#DC5B5F'; ctx.strokeStyle = '#15294A'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(c.x + 1, top);
    ctx.bezierCurveTo(c.x + 9, top - 3 + w1, c.x + 17, top + 3 + w2, c.x + 27, top + 7 + w1 * 0.5);
    ctx.bezierCurveTo(c.x + 18, top + 10 + w2, c.x + 10, top + 13 + w1, c.x + 1, top + 16);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 9px Poppins, sans-serif';
    ctx.fillText(String(no), c.x + 8, top + 11 + w1 * 0.3);
  }

  const trail = [];
  let confettiFor = -1;
  function drawBallShadowAndTrail() {
    if (mode === 'rolling') {
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 9) trail.shift();
    } else if (trail.length) trail.shift();
    if (mode === 'penalty') return;
    ground(() => {
      trail.forEach((t, i) => {
        ctx.fillStyle = `rgba(255,255,255,${(i / trail.length) * 0.3})`;
        ctx.beginPath(); ctx.arc(t.x, t.y, BALL_R * (0.4 + (0.6 * i) / trail.length), 0, Math.PI * 2); ctx.fill();
      });
      if (mode !== 'sinking' && mode !== 'done') {
        ctx.fillStyle = 'rgba(0,0,0,.30)';
        ctx.beginPath(); ctx.ellipse(ball.x + 3, ball.y + 4, BALL_R * 1.05, BALL_R * 0.9, 0.5, 0, Math.PI * 2); ctx.fill();
      }
    });
  }
  function drawBall() {
    if (mode === 'penalty') return;
    const r = BALL_R * ball.scale;
    // In the cup the ball sinks below the lip; elsewhere it sits on the grass.
    const lift = mode === 'sinking' || mode === 'done' ? r * 0.2 : r * 0.95;
    const sx = ball.x, sy = G(ball.y) - lift;
    const g = ctx.createRadialGradient(sx - r * 0.4, sy - r * 0.45, r * 0.1, sx, sy, r);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.7, '#F1F3F5'); g.addColorStop(1, '#C3CAD1');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#15294A'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.09)';
    for (const [dx, dy] of [[0.3, 0.2], [-0.15, 0.45], [0.45, -0.25], [-0.4, -0.05]]) {
      ctx.beginPath(); ctx.arc(sx + dx * r, sy + dy * r, r * 0.11, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawAim() {
    if (!aim || mode !== 'aim') return;
    const dx = aim.sx - aim.x, dy = aim.sy - aim.y;
    const len = Math.hypot(dx, dy);
    if (len < 3) return;
    const power = Math.min(1, len / MAX_DRAG);
    const ux = dx / len, uy = dy / len;
    const reach = 26 + power * 120;
    const color = power < 0.45 ? '#4CC274' : power < 0.8 ? '#F8A33E' : '#E2474C';
    ground(() => {
      for (let d = 14; d < reach; d += 9) {
        const s = 3 * (1 - d / (reach + 40));
        ctx.fillStyle = 'rgba(21,41,74,.35)';
        ctx.beginPath(); ctx.arc(ball.x + ux * d + 0.8, ball.y + uy * d + 1.4, s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(ball.x + ux * d, ball.y + uy * d, s, 0, Math.PI * 2); ctx.fill();
      }
      const tx = ball.x + ux * (reach + 4), ty = ball.y + uy * (reach + 4);
      ctx.fillStyle = color; ctx.strokeStyle = '#15294A'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx + ux * 10, ty + uy * 10);
      ctx.lineTo(tx - uy * 7, ty + ux * 7);
      ctx.lineTo(tx + uy * 7, ty - ux * 7);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(21,41,74,.35)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R + 9, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R + 9, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2); ctx.stroke();
    });
  }

  function drawVignette() {
    const vh = VIEW_H;
    const g = ctx.createRadialGradient(W / 2, vh * 0.55, vh * 0.35, W / 2, vh * 0.55, vh * 0.8);
    g.addColorStop(0, 'rgba(10,20,40,0)'); g.addColorStop(1, 'rgba(10,20,40,.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, vh);
  }

  let lastDraw = performance.now();
  function draw() {
    const now = performance.now();
    const fdt = Math.min(0.05, (now - lastDraw) / 1000);
    lastDraw = now;
    ensureBackground();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    const k = canvas.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (HOLE.rivers) drawWater();
    if (HOLE.drawGround) ground(() => HOLE.drawGround(ctx, api));
    drawSplashRings();
    drawBallShadowAndTrail();
    drawAim();
    if (mode === 'sinking' && confettiFor !== sinkStart) {
      confettiFor = sinkStart;
      burst(HOLE.cup.x, HOLE.cup.y, 44, 'confetti', 4);
    }
    // Upright things, back to front.
    const items = [
      { y: HOLE.cup.y + 0.5, draw: drawFlag },
      { y: ball.y, draw: drawBall },
      ...(HOLE.uprights ? HOLE.uprights(ctx, api) : []),
    ].sort((a, c) => a.y - c.y);
    for (const it of items) it.draw();
    // A ball hidden behind something tall still shows, faintly.
    if (HOLE.hides && HOLE.hides(ball.x, ball.y) && mode !== 'penalty') {
      ctx.save(); ctx.globalAlpha = 0.45; drawBall(); ctx.restore();
    }
    updateParts(fdt);
    drawParts();
    drawVignette();
  }

  // ---- Loop ----
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= STEP) {
      clock += STEP;
      if (mode === 'rolling') step(STEP);
      else if (mode === 'sinking') sinking();
      else if (mode === 'aim') nudge();
      acc -= STEP;
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // For automated checks only (?debug=1): shoot by angle and power, read the state.
  if (params.get('debug') === '1') {
    window.__golf = {
      shoot: (deg, power) => shoot(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), power),
      state: () => ({ mode, strokes, x: ball.x, y: ball.y, audio: audio ? audio.state : 'none' }),
      reset: (x, y, t = 0) => { Object.assign(ball, { x, y, vx: 0, vy: 0, scale: 1 }); mode = 'aim'; strokes = 0; clock = t; },
      tick: () => { clock += STEP; if (mode === 'rolling') step(STEP); },
      sim: (deg, power) => {
        shoot(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), power);
        for (let n = 0; mode === 'rolling' && n < 40000; n++) { clock += STEP; step(STEP); }
        return { mode, x: ball.x, y: ball.y };
      },
    };
  }
  };
})();
