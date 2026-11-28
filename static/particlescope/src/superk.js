// Super-Kamiokande: Cherenkov rings on a wall of photomultipliers.
//
// Inner detector: water cylinder R = 16.9 m, height 36.2 m, 11,146 20-inch PMTs on a ~70.7 cm grid
// (40% photocathode coverage). Charged-particle steps above the Cherenkov threshold come from Geant4
// (cherenkov/g4/g4water.cc). Light is generated here:
//   Frank-Tamm, 300-600 nm:  dN/dx = 2 pi alpha (1/l1 - 1/l2) (1 - 1/(n beta)^2)  ~ 764 (1 - 1/(n beta)^2) per cm
//   emitted on a cone cos(theta_c) = 1/(n beta) around the step, propagated in straight lines to the wall,
//   attenuated (L_att ~ 90 m) and detected with SK's coverage x quantum efficiency x collection.
// Check: this gives ~6 photoelectrons per MeV for electrons, as SK measures (see tests/superk-check.mjs).
// Display: the classic unrolled event display: top cap, barrel, bottom cap; colour = hit time, size = charge.

export const SK = {
  R: 1690, HZ: 1810, n: 1.334, pitch: 70.7,
  coverage: 0.40,      // photocathode area fraction
  qe: 0.17,            // quantum efficiency averaged over the 300-600 nm Cherenkov spectrum (peak ~22% at 390 nm)
  collection: 0.70,    // photoelectron collection efficiency
  latt: 9000,          // cm, light attenuation length in SK water
  dark: 4e3,           // Hz per PMT dark rate
};
const FT = 2 * Math.PI / 137.036 * (1 / 300e-7 - 1 / 600e-7); // photons per cm at sin^2 = 1
const C = 29.98;       // cm/ns

// ---- PMT layout -------------------------------------------------------------------------
export function pmtLayout() {
  const { R, HZ, pitch } = SK, nCol = Math.round(2 * Math.PI * R / pitch), nRow = Math.round(2 * HZ / pitch);
  const pm = [];
  for (let j = 0; j < nRow; j++) for (let i = 0; i < nCol; i++) pm.push({ part: 1, phi: (i + 0.5) / nCol * 2 * Math.PI, z: -HZ + (j + 0.5) * 2 * HZ / nRow });
  for (const part of [0, 2]) for (let x = -R; x <= R; x += pitch) for (let y = -R; y <= R; y += pitch) if (Math.hypot(x, y) < R - pitch / 2) pm.push({ part, x, y });
  return { pm, nCol, nRow };
}
// index of the PMT nearest to a wall point
function pmtIndex(L, p, x, y, z) {
  const { R, HZ, pitch } = SK;
  if (p === 1) {
    let phi = Math.atan2(y, x); if (phi < 0) phi += 2 * Math.PI;
    const i = Math.min(L.nCol - 1, Math.floor(phi / (2 * Math.PI) * L.nCol)), j = Math.min(L.nRow - 1, Math.max(0, Math.floor((z + HZ) / (2 * HZ) * L.nRow)));
    return j * L.nCol + i;
  }
  const key = `${p}:${Math.round((x + R) / pitch)}:${Math.round((y + R) / pitch)}`;
  return L.capIndex.get(key) ?? -1;
}
export function indexCaps(L) {
  const { R, pitch } = SK;
  L.capIndex = new Map();
  L.pm.forEach((m, k) => { if (m.part !== 1) L.capIndex.set(`${m.part}:${Math.round((m.x + R) / pitch)}:${Math.round((m.y + R) / pitch)}`, k); });
}

// ---- light: returns Map pmt -> { q (p.e.), t (ns, first hit) } ----------------------------
export function simulate(ev, L, rand = Math.random) {
  const { R, HZ, n, coverage, qe, collection, latt } = SK, eff = coverage * qe * collection;
  const hits = new Map(), s = ev.s, v = ev.v;
  for (let k = 0; k < s.length; k += 7) {
    const x0 = s[k], y0 = s[k + 1], z0 = s[k + 2], dx = s[k + 3] - x0, dy = s[k + 4] - y0, dz = s[k + 5] - z0, beta = s[k + 6];
    const len = Math.hypot(dx, dy, dz), ct = 1 / (n * beta);
    if (len <= 0 || ct >= 1) continue;
    const st = Math.sqrt(1 - ct * ct), nph = poisson(FT * st * st * len * eff, rand);
    if (!nph) continue;
    const ux = dx / len, uy = dy / len, uz = dz / len;
    // perpendicular basis around the step
    const ax = Math.abs(ux) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let px = uy * ax[2] - uz * ax[1], py = uz * ax[0] - ux * ax[2], pz = ux * ax[1] - uy * ax[0];
    const pl = Math.hypot(px, py, pz); px /= pl; py /= pl; pz /= pl;
    const qx = uy * pz - uz * py, qy = uz * px - ux * pz, qz = ux * py - uy * px;
    for (let i = 0; i < nph; i++) {
      const f = rand(), ex = x0 + f * dx, ey = y0 + f * dy, ez = z0 + f * dz, ph = 2 * Math.PI * rand(), cp = Math.cos(ph), sp = Math.sin(ph);
      const wx = ct * ux + st * (cp * px + sp * qx), wy = ct * uy + st * (cp * py + sp * qy), wz = ct * uz + st * (cp * pz + sp * qz);
      // distance to the cylinder wall / caps
      const a = wx * wx + wy * wy, b = ex * wx + ey * wy, c = ex * ex + ey * ey - R * R;
      let d = a > 1e-12 ? (-b + Math.sqrt(Math.max(0, b * b - a * c))) / a : Infinity, part = 1;
      const dzc = wz > 0 ? (HZ - ez) / wz : wz < 0 ? (-HZ - ez) / wz : Infinity;
      if (dzc < d) { d = dzc; part = wz > 0 ? 0 : 2; }
      if (rand() > Math.exp(-d / latt)) continue;
      const hx = ex + d * wx, hy = ey + d * wy, hz = ez + d * wz, idx = pmtIndex(L, part, hx, hy, hz);
      if (idx < 0) continue;
      const t = Math.hypot(ex - v[0], ey - v[1], ez - v[2]) / C + d * n / C + 1.2 * gauss(rand); // ~1.2 ns PMT timing
      const h = hits.get(idx);
      if (h) { h.q++; h.t = Math.min(h.t, t); } else hits.set(idx, { q: 1, t });
    }
  }
  return hits;
}
function gauss(rand) { let u = 0; while (!u) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); }
function poisson(mu, rand) {
  if (mu > 40) return Math.max(0, Math.round(mu + Math.sqrt(mu) * gauss(rand)));
  let L = Math.exp(-mu), k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

// pi0 events: the two photons are invisible until they convert. Group the shower steps into two
// directions seen from the vertex (2-means on unit vectors); the step nearest the vertex in each
// group is where that photon converted.
function photonStarts(ev) {
  const v = ev.v, s = ev.s, pts = [];
  for (let k = 0; k < s.length; k += 7) {
    const dx = s[k] - v[0], dy = s[k + 1] - v[1], dz = s[k + 2] - v[2], r = Math.hypot(dx, dy, dz);
    if (r > 1) pts.push([dx / r, dy / r, dz / r, r, s[k], s[k + 1], s[k + 2]]);
  }
  if (pts.length < 2) return [];
  let c = [pts[0].slice(0, 3), pts.reduce((b, p) => (p[0] * pts[0][0] + p[1] * pts[0][1] + p[2] * pts[0][2] < b[0] * pts[0][0] + b[1] * pts[0][1] + b[2] * pts[0][2] ? p : b)).slice(0, 3)];
  let lab = [];
  for (let it = 0; it < 8; it++) {
    lab = pts.map((p) => (p[0] * c[0][0] + p[1] * c[0][1] + p[2] * c[0][2] >= p[0] * c[1][0] + p[1] * c[1][1] + p[2] * c[1][2] ? 0 : 1));
    c = [0, 1].map((g) => { const m = [0, 0, 0]; pts.forEach((p, i) => { if (lab[i] === g) { m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; } }); const l = Math.hypot(...m) || 1; return m.map((x) => x / l); });
  }
  return [0, 1].map((g) => { let best = null; pts.forEach((p, i) => { if (lab[i] === g && (!best || p[3] < best[3])) best = p; }); return best ? [best[4], best[5], best[6], best[3] / C] : null; }).filter(Boolean);
}

const TRACK_COL = { muon: '#7fd4ff', cosmic: '#7fd4ff', electron: '#ffe066', pi0: '#ffb066', low: '#ffe066' };

const KIND_TEXT = {
  muon: 'muon from a neutrino interaction (800 MeV): a sharp ring',
  electron: 'electron from a neutrino interaction (500 MeV): its shower blurs the ring',
  pi0: 'neutral current: the neutrino bounces off and leaves unseen, making a π⁰ → γγ; each photon showers further on: two fuzzy rings, no lepton',
  cosmic: 'cosmic-ray muon crossing the whole tank (5 GeV): a filled-in disc on the bottom',
  low: 'low-energy electron (12 MeV, like a solar neutrino): only a few dozen photomultipliers fire',
};

// ---- the scene ---------------------------------------------------------------------------
export class SuperKScene {
  constructor(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.k = -1; this.lib = null; }
  async load(url = 'assets/superk-events.json') {
    if (this.lib) return;
    this.lib = await (await fetch(url)).json();
    this.L = pmtLayout(); indexCaps(this.L);
  }
  start(now) { this.next(now); }
  next(now) {
    // show every type in turn, a random event of each
    const order = ['cosmic', 'muon', 'electron', 'pi0', 'low'], kind = order[(this.k = (this.k + 1) % order.length)];
    const pool = this.lib.events.filter((e) => e.kind === kind), ev = pool[(Math.random() * pool.length) | 0];
    this.ev = ev; this.t0 = now;
    this.hits = [...simulate(ev, this.L).entries()];
    // dark noise: ~4 kHz per PMT in a 1.3 us window
    for (let i = 0, nd = poisson(this.L.pm.length * SK.dark * 1.3e-6, Math.random); i < nd; i++) this.hits.push([(Math.random() * this.L.pm.length) | 0, { q: 1, t: -300 + 1300 * Math.random(), noise: true }]);
    this.pe = this.hits.reduce((a, [, h]) => a + (h.noise ? 0 : h.q), 0);
    const ts = this.hits.filter(([, h]) => !h.noise).map(([, h]) => h.t).sort((a, b) => a - b);
    this.tLo = ts[Math.floor(ts.length * 0.02)] ?? 0; this.tHi = ts[Math.floor(ts.length * 0.98)] ?? 100;
    this.text = KIND_TEXT[ev.kind];
    // charged steps for the 3D view (at most ~5000), each with its time (particles move at ~c)
    const st = ev.s, n = st.length / 7, every = Math.max(1, Math.ceil(n / 5000));
    this.gammas = ev.kind === 'pi0' ? photonStarts(ev) : [];
    this.steps = [];
    for (let k = 0; k < n; k += every) {
      const o = k * 7, mx = (st[o] + st[o + 3]) / 2, my = (st[o + 1] + st[o + 4]) / 2, mz = (st[o + 2] + st[o + 5]) / 2;
      this.steps.push([st[o], st[o + 1], st[o + 2], st[o + 3], st[o + 4], st[o + 5], Math.hypot(mx - ev.v[0], my - ev.v[1], mz - ev.v[2]) / C]);
    }
  }
  // rotating 3D view of the tank: track (grows with time) + PMT hits on the cylinder
  draw3d(ctx, x0, y0, w, h, now, tNow) {
    const { R, HZ } = SK, yaw = 0.6 + 0.18 * now, tilt = 0.32, cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    const k = Math.min(w / (2.3 * R), h / (2 * HZ * ct + 2 * R * st + 200)), ox = x0 + w / 2, oy = y0 + h / 2;
    const P = (x, y, z) => { const xr = x * cy - y * sy, yr = x * sy + y * cy; return [ox + xr * k, oy - (z * ct - yr * st) * k, yr]; };
    // cylinder outline
    ctx.strokeStyle = '#2a323b'; ctx.lineWidth = 1;
    for (const z of [HZ, -HZ]) { ctx.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * 2 * Math.PI, [px, py] = P(R * Math.cos(a), R * Math.sin(a), z); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
    for (const sgn of [-1, 1]) { const [ax, ay] = P(sgn * R * cy, -sgn * R * sy, HZ), [bx, by] = P(sgn * R * cy, -sgn * R * sy, -HZ); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
    // hits on the far side first (dimmer), then the track, then near-side hits
    const pmPos = (m) => m.part === 1 ? [R * Math.cos(m.phi), R * Math.sin(m.phi), m.z] : [m.x, m.y, m.part === 0 ? HZ : -HZ];
    const drawHits = (far) => {
      for (const [idx, h] of this.hits) {
        if (h.t > tNow) continue;
        const [px, py, depth] = P(...pmPos(this.L.pm[idx]));
        if ((depth > 0) !== far) continue;
        const f = Math.min(1, Math.max(0, (h.t - this.tLo) / (this.tHi - this.tLo + 1e-9)));
        ctx.globalAlpha = far ? 0.35 : 0.95;
        ctx.fillStyle = h.noise ? '#79828c' : `hsl(${(1 - f) * 260}, 95%, 58%)`;
        const rr = Math.min(3.2, 1.1 + 0.5 * Math.log2(1 + h.q));
        ctx.fillRect(px - rr / 2, py - rr / 2, rr, rr);
      }
      ctx.globalAlpha = 1;
    };
    drawHits(true);
    // the invisible neutrino that started a contained event: dashed, from outside the tank
    const v = this.ev.v, [vx, vy] = P(...v);
    if (this.ev.kind !== 'cosmic') {
      const d = this.ev.d, L = 2600, [ax, ay] = P(v[0] - d[0] * L, v[1] - d[1] * L, v[2] - d[2] * L);
      ctx.strokeStyle = 'rgba(220,225,235,0.55)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(vx, vy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(220,225,235,0.8)'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText('ν (invisible)', ax + 4, ay - 4);
      if (this.ev.kind === 'pi0') {
        // the neutrino leaves again (neutral current), and two invisible photons fly to their conversion points
        const [bx, by] = P(v[0] + d[1] * 1200, v[1] - d[0] * 1200, v[2] + 600);
        ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillText('ν leaves', bx + 4, by - 4);
        ctx.strokeStyle = 'rgba(255,176,102,0.8)'; ctx.setLineDash([1.5, 4]); ctx.lineWidth = 1.5;
        for (const g of this.gammas) {
          const f = Math.min(1, Math.max(0, (tNow - 0) / Math.max(g[3], 1e-3))), [gx, gy] = P(v[0] + (g[0] - v[0]) * f, v[1] + (g[1] - v[1]) * f, v[2] + (g[2] - v[2]) * f);
          ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(gx, gy); ctx.stroke();
          if (f >= 1) { ctx.fillStyle = 'rgba(255,176,102,0.9)'; ctx.fillText('γ', gx + 4, gy - 4); }
        }
        ctx.setLineDash([]);
      }
    }
    ctx.save(); ctx.shadowColor = TRACK_COL[this.ev.kind] || '#fff'; ctx.shadowBlur = 10;
    ctx.strokeStyle = TRACK_COL[this.ev.kind] || '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
    for (const q of this.steps) { if (q[6] > tNow) continue; const [ax, ay] = P(q[0], q[1], q[2]), [bx, by] = P(q[3], q[4], q[5]); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
    ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(vx, vy, 3.5, 0, 2 * Math.PI); ctx.fill();
    drawHits(false);
  }

  draw(now) {
    if (!this.lib) return;
    const cv = this.cv, ctx = this.ctx, dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); this.bg = null; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // slow motion: the hits arrive over ~2.5 s, stay 3 s
    const T = now - this.t0, show = 2.5, hold = 3.5;
    if (T > show + hold) { this.next(now); return this.draw(now); }
    const { R, HZ } = SK, bw = 2 * Math.PI * R, tot = 2 * HZ + 4 * R;     // unrolled extent (cm)
    // wide screens: 3D left, unrolled right; tall screens (phones): 3D on top, unrolled below
    const wide = W > H * 1.2, uW = wide ? W * 0.5 : W, uX = wide ? W * 0.5 : 0, uY = wide ? 0 : (H - 150) * 0.48, uH = wide ? H : H - uY;
    const s = Math.min((uW - 40) / bw, (uH - 150) / tot), cx = uX + uW / 2, top = uY + 40 + (uH - 150 - tot * s) / 2;
    const capY0 = top + R * s, barY0 = top + 2 * R * s, capY2 = barY0 + 2 * HZ * s + R * s;
    const P = (m) => m.part === 1 ? [cx + (m.phi / (2 * Math.PI) - 0.5) * bw * s, barY0 + (HZ - m.z) * s]
      : m.part === 0 ? [cx + m.x * s, capY0 - m.y * s] : [cx + m.x * s, capY2 + m.y * s];
    // background: all PMTs, drawn once
    if (!this.bg) {
      const bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
      const b = bg.getContext('2d'); b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.fillStyle = '#020305'; b.fillRect(0, 0, W, H);
      b.strokeStyle = '#1d242c'; b.lineWidth = 1;
      b.strokeRect(cx - bw * s / 2, barY0, bw * s, 2 * HZ * s);
      b.beginPath(); b.arc(cx, capY0, R * s, 0, 2 * Math.PI); b.stroke();
      b.beginPath(); b.arc(cx, capY2, R * s, 0, 2 * Math.PI); b.stroke();
      b.fillStyle = '#161c22';
      for (const m of this.L.pm) { const [x, y] = P(m); b.fillRect(x - 0.6, y - 0.6, 1.2, 1.2); }
      this.bg = bg;
    }
    ctx.drawImage(this.bg, 0, 0, W, H);
    const tNow = this.tLo + (this.tHi - this.tLo) * Math.min(1, T / show) + (T > show ? 1e4 : 0);
    if (wide) this.draw3d(ctx, 16, 30, W * 0.5 - 32, H - 150, now, tNow); else this.draw3d(ctx, 16, 24, W - 32, uY - 24, now, tNow);
    const r0 = Math.max(0.8, SK.pitch * s * 0.5);
    for (const [idx, h] of this.hits) {
      if (h.t > tNow) continue;
      const [x, y] = P(this.L.pm[idx]), f = Math.min(1, Math.max(0, (h.t - this.tLo) / (this.tHi - this.tLo + 1e-9)));
      ctx.fillStyle = h.noise ? 'rgba(120,130,140,0.7)' : `hsl(${(1 - f) * 260}, 95%, ${55 + 10 * Math.min(1, h.q / 10)}%)`;
      const rr = r0 * Math.min(1.6, 0.55 + 0.25 * Math.log2(1 + h.q));
      ctx.beginPath(); ctx.arc(x, y, rr, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.fillStyle = '#7d8894'; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('top', cx, capY0 - R * s - 6); ctx.fillText('bottom', cx, capY2 + R * s + 12);
    ctx.fillText('wall (unrolled)', cx - bw * s / 2 + 44, barY0 - 6);
    if (wide) ctx.fillText('the tank in 3D: the particle’s track and the light it makes', W * 0.25, 22);
    ctx.textAlign = 'start';
    // colour scale: time
    const gx = W - 260, gy = wide ? H - 96 : H - 128;
    for (let i = 0; i < 120; i++) { ctx.fillStyle = `hsl(${(1 - i / 119) * 260}, 95%, 58%)`; ctx.fillRect(gx + i, gy, 1, 8); }
    ctx.fillStyle = '#7d8894'; ctx.fillText('early', gx - 30, gy + 8); ctx.fillText('late  (hit time)', gx + 124, gy + 8);
    ctx.fillStyle = '#cfd6de'; ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(this.text, 16, H - 92);
    ctx.fillStyle = '#7d8894'; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`${this.pe.toLocaleString()} photoelectrons · grey dots: photomultiplier dark noise`, 16, H - 76);
  }
}
