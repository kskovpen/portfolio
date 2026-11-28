// Scintillation crystal: gamma spectroscopy with a 3" x 3" NaI(Tl) crystal and a photomultiplier.
//
// Geant4 (scint/g4/g4scint.cc) gives, per decay, the energy deposited in the crystal (source 10 cm away,
// lead shield around: the backscatter peak comes from gammas bouncing off the lead) and, for a few
// thousand decays, the interaction points. The app smears energies with NaI's resolution
// (FWHM 7% at 662 keV, scaling as 1/sqrt(E)) and fills the spectrum. In the side view, slowed down
// ~10 million times: the gamma (invisible, dashed) scatters or is absorbed; each interaction makes a
// flash of scintillation light (NaI(Tl): ~38,000 photons/MeV at 415 nm, decay time 230 ns) which the
// photomultiplier turns into a pulse proportional to the energy.

const FWHM662 = 0.07, DECAY_NS = 230;
const SRC = {
  cs137: { label: 'Cs-137 (661.7 keV gamma + 32 keV barium X-rays)', max: 800,
    marks: [[32, 'X-ray'], [184, 'backscatter'], [477, 'Compton edge'], [662, 'photopeak 662 keV']] },
  co60: { label: 'Co-60 (1173 + 1332 keV gammas, emitted together)', max: 2800,
    marks: [[210, 'backscatter'], [963, 'Compton edges'], [1173, '1173'], [1332, '1332'], [2505, 'sum peak']] },
};
// Real-time counting rate for a 1 uCi (37 kBq) source: decays/s x fraction depositing energy (Geant4: 1.2 M decays simulated)
const ACTIVITY = 37000, DECAYS = 1.2e6;
const CAP = 60000;          // the spectrum stops growing once its shape is clear

function gauss() { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); }
function smear(e) { return e + gauss() * FWHM662 / 2.355 * Math.sqrt(661.7 * e); }

// Optical photons (a drawn sample: ~2000 per 662 keV out of ~25,000 real ones, i.e. 1 in ~12), all shown at
// once: the real light comes out over ~0.2 us, which is 'at once' for any eye. Each is emitted at an
// interaction point at a time from NaI's 230 ns decay, flies straight at c/n (n = 1.85), reflects off the
// wrapped walls (5% lost per bounce) and is collected at the photomultiplier window (z = 76.2 mm).
// Side view: z along the axis, x across; the third coordinate only stretches the path.
const R_X = 38.1, Z_PMT = 76.2, SLOW = 1.2 / 230;     // display seconds per ns
function makePhotons(pts, per662 = 2000) {
  const out = [];
  for (const [x0, y0, z0, e] of pts) {
    for (let n = Math.round(per662 * e / 662); n > 0; n--) {
      const c = 2 * Math.random() - 1, ph = 2 * Math.PI * Math.random(), s = Math.sqrt(1 - c * c);
      let x = x0, z = z0, dx = s * Math.cos(ph), dz = c;
      const stretch = 1 / Math.max(0.2, Math.hypot(dx, dz));   // out-of-plane component makes the true path longer
      const path = [[z, x]]; let L = 0, fate = 'lost';
      for (let b = 0; b < 12; b++) {
        const tx = dx > 0 ? (R_X - x) / dx : dx < 0 ? (-R_X - x) / dx : Infinity, tz = dz > 0 ? (Z_PMT - z) / dz : dz < 0 ? (0 - z) / dz : Infinity;
        const t = Math.min(tx, tz); x += dx * t; z += dz * t; L += t * stretch; path.push([z, x]);
        if (t === tz && dz > 0) { fate = 'pmt'; break; }        // reached the photomultiplier window
        if (Math.random() < 0.05) break;                         // absorbed in the wrapping
        if (t === tx) dx = -dx; else dz = -dz;                   // reflect
      }
      const tEmit = -230 * Math.log(1 - Math.random());          // ns, NaI(Tl) decay
      out.push({ path, L, fate, t0: 0 });               // one flash: emission (~0.2 us) and flight (~1 ns) are instantaneous to the eye
    }
  }
  return out;
}

// One clock for both halves: gammas arrive as events; each one flashes in the crystal and is added to the
// spectrum in the same instant. Speed 1 = ~2 gammas/s (follow each one), up to real time for a 1 uCi source.
export const SPEEDS = { 1: 2, 10: 20, 100: 200, real: null };
const MAX_DRAWN = 30;            // gammas per second actually drawn; above that a sample is drawn, all are counted

function describe(src, pts) {
  const Et = pts.reduce((a, p) => a + p[3], 0), n = pts.length;
  const scat = (k) => (k > 1 ? `after ${k - 1} Compton scatter${k > 2 ? 's' : ''}, ` : '');
  if (src === 'cs137') return Et < 45 ? 'a 32 keV barium X-ray, absorbed → the X-ray peak'
    : Et > 655 ? `all 662 keV absorbed (${scat(n)}photoelectric absorption) → the photopeak`
    : `Compton-scattered ${n === 1 ? 'once' : n + ' times'}, then the gamma escaped with the rest → the Compton continuum`;
  return Et > 2490 ? 'both gammas absorbed at once → the sum peak at 2505 keV'
    : Math.abs(Et - 1332.5) < 6 ? `the 1332 keV gamma fully absorbed (${scat(n)}photoelectric) → its photopeak`
    : Math.abs(Et - 1173.2) < 6 ? `the 1173 keV gamma fully absorbed (${scat(n)}photoelectric) → its photopeak`
    : 'Compton-scattered, part of the energy escaped → the Compton continuum';
}

export class ScintScene {
  constructor(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.lib = null; this.src = 'cs137'; this.speed = 1; }
  async load(url = 'assets/scint-spectra.json') {
    if (this.lib) return;
    this.lib = await (await fetch(url)).json();
  }
  setSource(s, now) { this.src = s; if (this.lib) this.start(now); }
  setSpeed(v) { this.speed = v; }
  start(now) {
    this.S = SRC[this.src]; this.data = this.lib[this.src];
    this.nb = 200; this.bins = new Float64Array(this.nb); this.n = 0; this.ptr = 0; this.last = now;
    this.realRate = ACTIVITY * this.data.h.length / DECAYS;
    this.active = []; this.acc = 0.6; this.latest = null; this.flashes = []; // bins lighting up
  }
  rate() { return SPEEDS[this.speed] ?? this.realRate; }

  // a gamma arrives now
  arrive(now, drawn) {
    if (drawn) {
      const vis = this.data.vis, ev = vis[(Math.random() * vis.length) | 0];
      const pts = [...ev].sort((a, b) => Math.hypot(a[0], a[1], a[2] + 100) - Math.hypot(b[0], b[1], b[2] + 100));
      const E = smear(pts.reduce((a, p) => a + p[3], 0)), sp = typeof this.speed === 'number' ? this.speed : 1000;
      const nPh = sp <= 1 ? 2000 : sp <= 10 ? 700 : 250;
      const g = { pts, E, t0: now, travel: sp <= 1 ? 0.35 : sp <= 10 ? 0.12 : 0.05, fade: sp <= 1 ? 0.9 : sp <= 10 ? 0.45 : 0.25,
        photons: makePhotons(pts, nPh), desc: describe(this.src, pts), counted: false };
      this.active.push(g); this.latest = g;
    } else this.count(smear(this.data.h[this.ptr = (this.ptr + 1) % this.data.h.length]), now);
  }
  count(E, now) {
    if (this.n >= CAP) return;
    const b = Math.floor(E / this.S.max * this.nb);
    if (b >= 0 && b < this.nb) { this.bins[b]++; if (this.flashes.length < 40) this.flashes.push([b, now]); }
    this.n++;
  }
  step(now, dt) {
    this.acc += this.rate() * dt;
    let k = Math.floor(this.acc); this.acc -= k;
    const drawFrac = Math.min(1, MAX_DRAWN / this.rate());
    for (; k > 0; k--) this.arrive(now, Math.random() < drawFrac);
    // drawn gammas are counted at the moment their light flashes
    for (const g of this.active) if (!g.counted && now - g.t0 >= g.travel) { g.counted = true; this.count(g.E, now); }
    this.active = this.active.filter((g) => now - g.t0 < g.travel + g.fade);
    this.flashes = this.flashes.filter(([, t]) => now - t < 0.6);
  }

  draw(now) {
    if (!this.lib) return;
    const dt = Math.min(0.05, now - this.last); this.last = now;
    this.step(now, dt);
    const cv = this.cv, ctx = this.ctx, dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#020305'; ctx.fillRect(0, 0, W, H);
    const wide = W > H * 1.1, vw = wide ? W * 0.5 : W, vh = wide ? H - 150 : (H - 150) * 0.5;

    // ---- side view (mm): source at z = -100, crystal z 0..76, PMT behind; shield around ----
    const s = Math.min((vw - 60) / 420, (vh - 40) / 220), ox = 30 + (vw - 60 - 420 * s) / 2 + 160 * s, oy = 30 + vh / 2;
    const P = (z, x) => [ox + z * s, oy - x * s];
    ctx.fillStyle = '#2a2f36';
    const [l0x] = P(-160, 0), [l1x] = P(260, 0);
    ctx.fillRect(l0x, oy - 110 * s, l1x - l0x, 12 * s); ctx.fillRect(l0x, oy + 98 * s, l1x - l0x, 12 * s);
    ctx.fillRect(l0x - 12 * s, oy - 110 * s, 12 * s, 220 * s); ctx.fillRect(l1x, oy - 110 * s, 12 * s, 220 * s);
    ctx.fillStyle = '#7d8894'; ctx.font = '10px system-ui, sans-serif'; ctx.fillText('lead shield', l0x, oy - 114 * s);
    const [cx0, cy0] = P(0, 38.1), cwid = 76.2 * s;
    ctx.fillStyle = 'rgba(40,60,140,0.35)'; ctx.fillRect(cx0, cy0, cwid, cwid);
    ctx.strokeStyle = '#9aa6b2'; ctx.strokeRect(cx0, cy0, cwid, cwid);
    ctx.fillStyle = '#9aa6b2'; ctx.fillText('NaI(Tl) crystal 7.6 cm', cx0, cy0 - 6);
    {
      const pm = [[78, 38], [92, 38], [112, 22], [165, 22], [165, -22], [112, -22], [92, -38], [78, -38]].map(([z, x]) => P(z, x));
      ctx.beginPath(); pm.forEach(([X, Y], i) => (i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y))); ctx.closePath();
      ctx.fillStyle = 'rgba(120,135,155,0.28)'; ctx.fill(); ctx.strokeStyle = '#7d8894'; ctx.lineWidth = 1; ctx.stroke();
      const [bx0, by0] = P(165, 26); ctx.fillStyle = '#3a4250'; ctx.fillRect(bx0, by0, 16 * s, 52 * s);
      for (const x of [-15, -5, 5, 15]) { const [qx, qy] = P(181, x); ctx.fillStyle = '#9aa6b2'; ctx.fillRect(qx, qy - 1, 6 * s, 2); }
      ctx.fillStyle = '#9aa6b2'; ctx.fillText('photomultiplier', P(96, 0)[0], P(0, -38)[1] + 14);
    }
    const [sx, sy] = P(-100, 0); ctx.fillStyle = '#ffb066'; ctx.beginPath(); ctx.arc(sx, sy, 4, 0, 2 * Math.PI); ctx.fill();
    ctx.fillText('source', sx - 14, sy + 18);

    // ---- the gammas in flight / flashing ----
    let pmtGlow = 0;
    for (const g of this.active) {
      const T = now - g.t0, path = [[-100, 0, 0], ...g.pts.map((p) => [p[2], p[0], p[3]])], seg = Math.max(1, path.length - 1);
      const reach = Math.min(1, T / g.travel), upto = reach * seg;
      ctx.strokeStyle = `rgba(255,176,102,${T < g.travel ? 0.75 : 0.75 * Math.max(0, 1 - (T - g.travel) / g.fade)})`; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(...P(path[0][0], path[0][1]));
      for (let i = 1; i < path.length && i - 1 < upto; i++) { const f = Math.min(1, upto - (i - 1)), a = path[i - 1], b = path[i]; ctx.lineTo(...P(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)); }
      ctx.stroke(); ctx.setLineDash([]);
      if (T < g.travel) continue;
      const k = Math.max(0, 1 - (T - g.travel) / g.fade);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
      for (let i = 1; i < path.length; i++) {          // bright spot at each interaction
        const [x, y] = P(path[i][0], path[i][1]), r = (3 + 8 * Math.sqrt(path[i][2] / 662)) * (0.5 + k);
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(225,215,255,${0.9 * k})`); gr.addColorStop(1, 'rgba(120,100,255,0)');
        ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      ctx.strokeStyle = `rgba(150,140,255,${Math.min(0.25, 0.03 * k * 2000 / Math.max(1, g.photons.length * 662 / Math.max(1, g.E)))})`; ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (const f of g.photons) { ctx.moveTo(...P(...f.path[0])); for (let i = 1; i < f.path.length; i++) ctx.lineTo(...P(...f.path[i])); if (f.fate === 'pmt') pmtGlow += k; }
      ctx.stroke(); ctx.restore();
    }
    if (pmtGlow) { const [wx, wy] = P(Z_PMT + 3, 38); ctx.fillStyle = `rgba(150,200,255,${Math.min(0.6, pmtGlow / 1500)})`; ctx.fillRect(wx, wy, 4, 76 * s); }

    // ---- what is happening ----
    ctx.fillStyle = '#cfd6de'; ctx.font = '600 12px system-ui, sans-serif';
    const slow = this.speed === 1;
    ctx.fillText(slow ? 'The latest gamma:' : `${Math.round(this.rate())} gammas per second${this.rate() > MAX_DRAWN ? ` (${MAX_DRAWN} per second drawn, all counted)` : ''}`, l0x, oy + 128 * s);
    if (slow && this.latest) {
      ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = '#ffffff';
      const words = `${this.latest.desc} (${this.latest.E.toFixed(0)} keV)`.split(' '), maxW = vw - 40 - l0x;
      let line = '', yy = oy + 128 * s + 18;
      for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, l0x, yy); yy += 16; line = w; } else line = t; }
      ctx.fillText(line, l0x, yy);
    }
    ctx.font = '10px system-ui, sans-serif';

    // ---- spectrum ----
    const gx = wide ? W * 0.5 + 40 : 50, gy = wide ? 50 : vh + 60, gw = (wide ? W * 0.5 : W) - 90, gh = wide ? H - 220 : (H - 150) * 0.5 - 60;
    let ymax = 1; for (let i = 3; i < this.nb; i++) ymax = Math.max(ymax, this.bins[i]);
    ctx.fillStyle = 'rgba(12,14,18,0.85)'; ctx.fillRect(gx - 40, gy - 30, gw + 60, gh + 64);
    const bw = gw / this.nb;
    ctx.fillStyle = '#7fb8ff';
    for (let i = 0; i < this.nb; i++) { const h = Math.min(1, this.bins[i] / (ymax * 1.1)) * gh; ctx.fillRect(gx + i * bw, gy + gh - h, Math.max(1, bw - 0.5), h); }
    for (const [b, t] of this.flashes) {                 // the bins that just received a gamma
      const k = 1 - (now - t) / 0.6, h = Math.min(1, this.bins[b] / (ymax * 1.1)) * gh;
      ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`; ctx.fillRect(gx + b * bw - 1, gy + gh - h - 5, bw + 2, 5);
    }
    ctx.strokeStyle = '#2a323b'; ctx.strokeRect(gx, gy, gw, gh);
    ctx.fillStyle = '#7d8894';
    const step = this.S.max > 1000 ? 500 : 100;
    for (let e = 0; e <= this.S.max; e += step) ctx.fillText(`${e}`, gx + e / this.S.max * gw - 8, gy + gh + 14);
    ctx.fillText('energy deposited (keV)', gx + gw - 120, gy + gh + 28);
    ctx.fillText('counts', gx - 34, gy - 8);
    ctx.fillStyle = '#cfd6de'; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(this.n >= CAP ? `spectrum complete (${CAP.toLocaleString()} gammas)` : `${this.n.toLocaleString()} gammas counted · each one lands here as it flashes`, gx + 40, gy - 8);
    ctx.font = '10px system-ui, sans-serif';
    this.S.marks.forEach(([e, name], i) => {
      const x = gx + e / this.S.max * gw;
      ctx.strokeStyle = 'rgba(255,211,77,0.35)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy + gh); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffd34d'; ctx.fillText(name, Math.min(x + 3, gx + gw - 70), gy + 12 + (i % 3) * 12);
    });
    if (slow && this.latest && this.latest.counted) { const x = gx + this.latest.E / this.S.max * gw; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x, gy + gh + 2); ctx.lineTo(x - 5, gy + gh + 10); ctx.lineTo(x + 5, gy + gh + 10); ctx.fill(); }

    ctx.fillStyle = '#cfd6de'; ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(this.S.label, 16, H - 92);
    ctx.fillStyle = '#7d8894'; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`a 1 µCi source sends ~${Math.round(this.realRate)} gammas/s into the crystal · each flash: the light of one gamma, all at once (it comes out within 0.2 µs)`, 16, H - 76);
  }
}
