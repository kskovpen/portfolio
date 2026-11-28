// Drift-tube chamber (ATLAS MDT-like), replayed from a Garfield++ event library (drift/garfield/mdtgen.cc).
//
// Slow motion of what happens in the ~1 µs after a muon crosses the chamber:
//  1. the muon leaves clusters of ionisation electrons (Heed),
//  2. each electron drifts to the wire (Magboltz transport; arrival time from Garfield, including
//     diffusion), moving along the mean r(t) relation rescaled to its own arrival time,
//  3. at the wire it starts an avalanche (Polya, mean gain 2e4) that induces the shaped signal,
//  4. the signal crossing a threshold gives the drift time -> drift radius (r-t relation) -> a
//     drift circle, and the muon track is fitted tangent to all circles.
// Field is radial and there is no magnetic field, so drift paths are straight radial lines.

const NS_PER_S = 140;          // slow motion: 140 ns of real time per second shown (~7,000,000x slower)
const THRESH = 0.25;           // fraction of the tube's peak signal used as the discriminator (TDC) threshold
const HOLD = 3.0;              // seconds the fitted track stays after the drift is over

export class DriftScene {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.lib = null; this.ev = null; this.t0 = 0; this.k = -1;
  }
  async load(url = 'assets/mdt-events.json') {
    if (this.lib) return;
    this.lib = await (await fetch(url)).json();
    const rt = this.lib.rt;                       // [r cm, t ns], increasing
    this.T = (r) => interp(rt, 0, 1, r);
    this.R = (t) => interp(rt, 1, 0, t);
    this.tMax = rt[rt.length - 1][1];
    const xs = this.lib.tubes.map((p) => p[0]), ys = this.lib.tubes.map((p) => p[1]);
    const R = this.lib.tube.rTube;
    this.box = [Math.min(...xs) - R, Math.min(...ys) - R, Math.max(...xs) + R, Math.max(...ys) + R];
    // t0 calibration, as done for the real chambers: electronics delay between the first electron
    // reaching the wire and the discriminator firing (median over the library)
    const dl = [];
    for (const ev of this.lib.events) for (const h of ev.hits) {
      const { tdc } = this.discriminate(h);
      if (tdc != null) dl.push(tdc - Math.min(...h.e.map((e) => e[3])));
    }
    dl.sort((a, b) => a - b);
    this.t0cal = dl[dl.length >> 1] || 0;
  }
  start(now) { this.next(now); }

  // leading-edge discriminator on the shaped signal
  discriminate(h) {
    const sig = h.sig.map((v) => -v), peak = Math.max(...sig);
    let tdc = null;
    for (let i = 1; i < sig.length; i++) if (sig[i] >= THRESH * peak) { tdc = this.lib.tMin + i * this.lib.tStep; break; }
    return { sig, peak, tdc };
  }

  next(now) {
    const L = this.lib.events;
    this.k = (this.k + 1 + ((Math.random() * 3) | 0)) % L.length;
    this.ev = L[this.k]; this.t0 = now; this.shown = (this.shown || 0) + 1;
    const tube = this.lib.tubes, R = this.lib.tube.rTube;
    // pre-compute per hit: wire position, electron paths, discriminator time, avalanche sizes
    this.hits = this.ev.hits.map((h) => {
      const [cx, cy] = tube[h.tube], { sig, peak, tdc } = this.discriminate(h);
      const e = h.e.map(([x, y, t, ta]) => ({ x, y, t, ta, r0: Math.hypot(x, y), T0: this.T(Math.hypot(x, y)), g: polya() }));
      return { cx, cy, sig, peak, tdc, rDrift: tdc == null ? null : Math.min(R, this.R(tdc - this.t0cal)), e, d: h.d };
    });
    this.fit = null;
    this.tEnd = Math.max(...this.hits.map((h) => Math.max(...h.e.map((e) => e.ta)))) + 40;
  }

  // ns since the muon crossed
  clock(now) { return (now - this.t0) * NS_PER_S - 60; }

  draw(now) {
    if (!this.lib) return;
    const cv = this.cv, ctx = this.ctx, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#020305'; ctx.fillRect(0, 0, W, H);
    let tns = this.clock(now);
    if (tns > this.tEnd + HOLD * NS_PER_S) { this.next(now); tns = this.clock(now); }

    // layout: chamber on the left, oscilloscope on the right (stacked on narrow screens)
    const wide = W > H * 1.1, scopeW = wide ? Math.min(380, W * 0.32) : W - 32, scopeH = wide ? H - 140 : Math.min(260, H * 0.32);
    const areaW = wide ? W - scopeW - 48 : W - 32, areaH = wide ? H - 200 : H - scopeH - 210;
    const [x0, y0, x1, y1] = this.box, s = Math.min(areaW / (x1 - x0), areaH / (y1 - y0));
    const ox = 16 + (areaW - (x1 - x0) * s) / 2 - x0 * s, oy = 70 + (areaH - (y1 - y0) * s) / 2 + y1 * s;
    const P = (x, y) => [ox + x * s, oy - y * s];
    this.pxPerCm = s;
    const R = this.lib.tube.rTube;

    // tubes and wires
    ctx.lineWidth = 1.5;
    for (const [cx, cy] of this.lib.tubes) {
      const [px, py] = P(cx, cy);
      ctx.beginPath(); ctx.arc(px, py, R * s, 0, 2 * Math.PI);
      ctx.fillStyle = '#0a0d12'; ctx.fill();
      ctx.strokeStyle = '#59626e'; ctx.stroke();
      ctx.fillStyle = '#9aa6b2'; ctx.fillRect(px - 1, py - 1, 2, 2);
    }

    // muon: flies through in slow motion during the first ~60 ns of the clock
    const [mx, my, dx, dy] = this.ev.mu, span = 30;
    const fly = Math.min(1, (tns + 60) / 50);
    const a = P(mx - dx * span, my - dy * span), b = P(mx - dx * span + 2 * span * dx * fly, my - dy * span + 2 * span * dy * fly);
    ctx.strokeStyle = tns < this.tEnd ? 'rgba(64,191,255,0.55)' : 'rgba(64,191,255,0.18)';
    ctx.lineWidth = 1.2; ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);

    // electrons and avalanches
    ctx.globalCompositeOperation = 'lighter';
    let drifting = 0;
    for (const h of this.hits) {
      let glow = 0;
      for (const e of h.e) {
        if (tns < e.t) continue;
        if (tns >= e.ta) { const age = tns - e.ta; if (age < 60) glow += e.g * Math.exp(-age / 15); continue; }
        drifting++;
        const f = (e.ta - tns) / Math.max(e.ta - e.t, 1e-3);          // remaining fraction of the drift time
        const r = this.R(f * e.T0), k = e.r0 > 0 ? r / e.r0 : 0;
        const [px, py] = P(h.cx + e.x * k, h.cy + e.y * k);
        ctx.fillStyle = 'rgba(150,255,170,0.75)';
        ctx.fillRect(px - 1, py - 1, 2.2, 2.2);
      }
      if (glow > 0) {
        // True scale: the avalanche lives within ~0.1 mm of the wire (here < 1 px) and lasts < 1 ns.
        // Drawn as a minimum-size flash on the wire, brightness ~ charge arriving.
        const [px, py] = P(h.cx, h.cy), g = Math.min(1, glow / 4e5);
        ctx.fillStyle = `rgba(255,236,170,${0.25 + 0.75 * g})`;
        ctx.beginPath(); ctx.arc(px, py, 1.6 + 1.4 * g, 0, 2 * Math.PI); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // drift circles appear when each tube's signal crosses threshold; then the track fit
    let nCirc = 0;
    for (const h of this.hits) {
      if (h.tdc == null || tns < h.tdc || h.rDrift == null) continue;
      nCirc++;
      const [px, py] = P(h.cx, h.cy);
      ctx.strokeStyle = 'rgba(143,200,255,0.9)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, h.rDrift * s), 0, 2 * Math.PI); ctx.stroke();
    }
    if (tns > this.tEnd && nCirc >= 3) {
      if (!this.fit) this.fit = fitTangent(this.hits.filter((h) => h.rDrift != null));
      const { n, c } = this.fit, dir = [-n[1], n[0]], p0 = [n[0] * c, n[1] * c];
      const A = P(p0[0] - dir[0] * span, p0[1] - dir[1] * span), B = P(p0[0] + dir[0] * span, p0[1] + dir[1] * span);
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
    }

    // oscilloscope: one trace per hit tube
    const sx = wide ? W - scopeW - 16 : 16, sy = wide ? 70 : H - scopeH - 70;
    ctx.fillStyle = 'rgba(12,14,18,0.85)'; ctx.fillRect(sx, sy, scopeW, scopeH);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.strokeRect(sx + 0.5, sy + 0.5, scopeW - 1, scopeH - 1);
    ctx.fillStyle = '#7d8894'; ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('WIRE SIGNALS (shaped)', sx + 10, sy + 16);
    const tSpan = 900, rows = this.hits.length, rh = (scopeH - 40) / Math.max(rows, 1);
    const gmax = Math.max(...this.hits.map((h) => h.peak));
    const X = (t) => sx + 10 + (scopeW - 20) * (t - this.lib.tMin) / tSpan;
    // time grid every 100 ns
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let t = 0; t <= tSpan; t += 100) { ctx.beginPath(); ctx.moveTo(X(t), sy + 24); ctx.lineTo(X(t), sy + scopeH - 14); ctx.stroke(); }
    ctx.fillStyle = '#5f6973';
    for (let t = 0; t <= tSpan; t += 200) ctx.fillText(`${t}`, X(t) - 6, sy + scopeH - 3);
    this.hits.forEach((h, i) => {
      const base = sy + 30 + (i + 0.8) * rh;
      ctx.strokeStyle = h.tdc != null && tns >= h.tdc ? '#8fc8ff' : '#4f8f5a'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      const nb = Math.min(h.sig.length, Math.floor((Math.min(tns, tSpan) - this.lib.tMin) / this.lib.tStep));
      for (let j = 0; j < nb; j++) {
        const xx = X(this.lib.tMin + j * this.lib.tStep), yy = base - (h.sig[j] / gmax) * rh * 0.85;
        j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      ctx.stroke();
      if (h.tdc != null && tns >= h.tdc) { ctx.fillStyle = '#8fc8ff'; ctx.fillRect(X(h.tdc) - 1, base - rh * 0.85, 2, rh * 0.85); }
    });
    if (tns >= 0 && tns <= tSpan) { ctx.strokeStyle = 'rgba(255,211,77,0.6)'; ctx.beginPath(); ctx.moveTo(X(tns), sy + 24); ctx.lineTo(X(tns), sy + scopeH - 14); ctx.stroke(); }

    // clock / status
    ctx.fillStyle = '#cfd6de'; ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText(`t = ${Math.max(0, Math.min(tns, this.tEnd)).toFixed(0)} ns`, 16, H - 92);
    ctx.fillStyle = '#7d8894'; ctx.font = '11px system-ui, sans-serif';
    const stage = tns < 0 ? 'muon crossing' : tns < this.tEnd ? `${drifting} electrons drifting to the wires` : this.fit ? `track fitted to ${nCirc} drift circles · residual ${(this.fit.rms * 1e4).toFixed(0)} µm` : '';
    ctx.fillText(`${stage}  ·  slow motion ×${(1e9 / NS_PER_S / 1e6).toFixed(0)} million`, 16, H - 76);
  }
}

function interp(tab, i, j, v) {
  if (v <= tab[0][i]) return tab[0][j];
  for (let k = 1; k < tab.length; k++) if (v <= tab[k][i]) {
    const a = tab[k - 1], b = tab[k], f = (v - a[i]) / (b[i] - a[i]);
    return a[j] + f * (b[j] - a[j]);
  }
  return tab[tab.length - 1][j];
}

// avalanche size: Polya with theta = 0 (exponential), mean 2e4 (MDT operating gain)
function polya() { return -2e4 * Math.log(1 - Math.random()); }

// line n.x = c tangent to drift circles: scan the angle, solve the left/right ambiguity iteratively
function fitTangent(hits) {
  let best = null;
  for (let th = -1.2; th <= 1.2; th += 0.001) {
    const n = [Math.cos(th), Math.sin(th)], u = hits.map((h) => n[0] * h.cx + n[1] * h.cy);
    let c = u.reduce((a, b) => a + b, 0) / u.length;
    for (let it = 0; it < 6; it++) c = u.reduce((a, ui, i) => a + ui - Math.sign(ui - c || 1) * hits[i].rDrift, 0) / u.length;
    const chi = u.reduce((a, ui, i) => a + (Math.abs(ui - c) - hits[i].rDrift) ** 2, 0);
    if (!best || chi < best.chi) best = { n, c, chi };
  }
  best.rms = Math.sqrt(best.chi / hits.length);
  return best;
}
