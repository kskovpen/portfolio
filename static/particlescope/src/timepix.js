// Timepix: a 256 x 256 hybrid pixel detector (55 um pixels, 300 um silicon, 14 x 14 mm), every pixel
// measuring the energy it collects. Deposits come from Geant4 in silicon (pixel/g4/g4pixel.cc).
// Each deposit becomes a charge cloud drifting to the pixel side (z = -150 um):
//   diffusion  sigma_d = sqrt(2 kT/q * d * dz / V)       (~7 um for the full 300 um at 100 V)
//   plasma     sigma_p = 8 um * sqrt(E_cell / 10 keV)     (dense tracks: alphas, ions; semi-empirical)
// shared over pixels by Gaussian integrals; pixels above the 4 keV threshold light up, colour = energy.

const N = 256, PITCH = 55, D = 300, V = 100, KT = 0.0259, THR = 4;   // um, V, eV->V, keV
export const TUNE = { plasma: 3.5 };  // um at 10 keV per 5x5x10 um cell: alpha clusters ~23 pixels, as measured (Timepix3, 300 um Si)
// Pixel front-end response: linear at low energy (~2% off at 150 keV), saturating near 500 keV and falling
// beyond (the "volcano effect": the cores of heavy-ion tracks read LOW). Shape: E / (1 + (E / 1 MeV)^2).
export function response(e) { return e / (1 + (e / 1000) * (e / 1000)); }
const SOURCES = {
  background: { label: 'Natural background (60 s exposure)', mix: { muon: 1.5, gamma: 14, gam60: 0, beta: 0.4 } },
  am241: { label: 'Am-241: alphas + 59.5 keV gammas (1 s)', mix: { alpha: 14, gam60: 35 } },
  sr90: { label: 'Sr-90 / Y-90 beta source (1 s)', mix: { beta: 22, gamma: 2 } },
  space: { label: 'On the International Space Station, 400 km up: cosmic rays with no atmosphere to stop them (3 s exposure)', mix: { proton: 28, helium: 7, oxygen: 1.2, iron: 0.5, beta: 10, muon: 0 } },
};

const KIND = { muon: 1, beta: 2, alpha: 3, proton: 4, gam60: 5, gamma: 5, helium: 3, oxygen: 6, iron: 6 };
const TCOL = [null, [64, 191, 255], [89, 255, 89], [255, 128, 38], [255, 64, 204], [255, 239, 64], [255, 82, 82]];
const KEY = [ // what each signature looks like (rendered from the same simulation), zoomed to a window of n x n pixels
  ['alpha', 'alpha: round blob', 14], ['beta', 'electron: curly worm', 34], ['muon', 'muon: thin straight line', 24],
  ['gam60', 'gamma ray: dot (it kicks out one electron)', 10], ['proton', 'proton: straight, denser line', 24], ['iron', 'heavy nucleus (space): thick bright track', 40],
];

// electron key example: among tracks spanning 0.4-1.5 mm, the one whose cells bend most
// (smallest ratio of straight-line extent to cell count = most wandering)
function curliest(pool) {
  let best = pool[0], score = -1;
  for (const ev of pool) {
    const xs = ev.filter((_, i) => i % 4 === 0), ys = ev.filter((_, i) => i % 4 === 1);
    const ext = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (ext < 400 || ext > 1500) continue;
    const sc = xs.length / ext;
    if (sc > score) { score = sc; best = ev; }
  }
  return best;
}

function erf(x) { // Abramowitz-Stegun 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
}
function poisson(mu) { let L = Math.exp(-mu), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
function color(e) { // measured energy -> colour (log scale, 4 keV .. 500 keV, where pixels saturate), dark blue -> red -> yellow -> white
  const f = Math.min(1, Math.max(0, Math.log(e / THR) / Math.log(500 / THR)));
  const stops = [[0, 20, 60, 160], [0.3, 40, 160, 230], [0.55, 230, 60, 40], [0.8, 255, 210, 40], [1, 255, 255, 230]];
  for (let i = 1; i < stops.length; i++) if (f <= stops[i][0]) {
    const a = stops[i - 1], b = stops[i], t = (f - a[0]) / (b[0] - a[0]);
    return [a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2]), a[3] + t * (b[3] - a[3])];
  }
  return [255, 255, 230];
}

export class TimepixScene {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.lib = null; this.source = 'am241';
    this.img = document.createElement('canvas'); this.img.width = N; this.img.height = N;
    this.ictx = this.img.getContext('2d'); this.E = new Float32Array(N * N); this.T = new Uint8Array(N * N); this.M = new Float32Array(N * N);
    this.colorize = false;
  }
  async load(url = 'assets/timepix-events.json') {
    if (this.lib) return;
    this.lib = await (await fetch(url)).json();
    // key thumbnails: one typical event of each kind, 48 x 48 pixels
    this.key = KEY.map(([kind, label, n]) => {
      const pool = this.lib[kind], c = document.createElement('canvas'); c.width = c.height = n;
      const E = new Float32Array(n * n);
      // pick a typical (median-size) event; for electrons, the curliest of the longer worms
      const ev = kind === 'beta' ? curliest(pool) : [...pool].sort((a, b) => a.length - b.length)[Math.floor(pool.length * (kind === 'muon' ? 0.7 : 0.5))];
      this.depositInto(ev, E, null, null, n, n * PITCH / 2, n * PITCH / 2, 0.5, 0);
      const ctx = c.getContext('2d'), im = ctx.createImageData(n, n);
      for (let k = 0; k < n * n; k++) { const o = k * 4, r = response(E[k]), col = r >= THR ? color(r) : [6, 8, 12]; im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = 255; }
      ctx.putImageData(im, 0, 0);
      return { c, label };
    });
  }
  setSource(s, now) { this.source = s; if (this.lib) this.frame(now); }
  start(now) { this.frame(now); }

  frame(now) {
    this.t0 = now; this.E.fill(0); this.M.fill(0); this.T.fill(0);
    const mix = SOURCES[this.source].mix;
    for (const [kind, rate] of Object.entries(mix)) {
      const pool = this.lib[kind];
      if (!pool || !rate) continue;
      for (let i = poisson(rate); i > 0; i--) this.deposit(pool[(Math.random() * pool.length) | 0], KIND[kind]);
    }
    this.repaint();
  }
  repaint() {
    // per-pixel noise and threshold, then paint
    const im = this.ictx.createImageData(N, N), px = im.data;
    let hit = 0;
    for (let k = 0; k < N * N; k++) {
      const e = response(this.E[k]) + 0.15 * (Math.random() - 0.5);
      const o = k * 4;
      if (e >= THR) { const c = this.colorize ? TCOL[this.T[k]] || [200, 200, 200] : color(e); px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; hit++; } else { px[o] = 6; px[o + 1] = 8; px[o + 2] = 12; }
      px[o + 3] = 255;
    }
    this.ictx.putImageData(im, 0, 0); this.hit = hit;
  }

  // one particle: its charge per pixel; each pixel remembers which particle gave it the most
  deposit(cells, type) {
    const local = new Map();
    this.depositInto(cells, null, local, null, N, Math.random() * N * PITCH, Math.random() * N * PITCH, 2 * Math.PI * Math.random(), 0);
    for (const [k, e] of local) { this.E[k] += e; if (e > this.M[k]) { this.M[k] = e; this.T[k] = type; } }
  }
  depositInto(cells, E, local, _, n, X0, Y0, a) { pixelize(cells, E, local, n, X0, Y0, a); }


  draw(now, colorize = false) {
    if (!this.lib) return;
    if (colorize !== this.colorize) { this.colorize = colorize; this.repaint(); }
    if (now - this.t0 > 2.6) this.frame(now);
    const cv = this.cv, ctx = this.ctx, dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#020305'; ctx.fillRect(0, 0, W, H);
    const keyW = W > 900 ? 300 : 0;
    const S = Math.floor(Math.min(W - 40 - keyW, H - 170) / N) * N || Math.min(W - 40 - keyW, H - 170), x = (W - S - keyW) / 2, y = 30;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.img, x, y, S, S);
    ctx.strokeStyle = '#2a323b'; ctx.strokeRect(x - 0.5, y - 0.5, S + 1, S + 1);
    // scale bar: 1 mm
    const mm = S / (N * PITCH / 1000);
    ctx.fillStyle = '#cfd6de'; ctx.fillRect(x + S - mm - 4, y + S + 10, mm, 3);
    ctx.font = '11px system-ui, sans-serif'; ctx.fillText('1 mm', x + S - mm - 4, y + S + 26);
    // colour bar
    for (let i = 0; i < 120; i++) { const c = color(THR * Math.pow(500 / THR, i / 119)); ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(x + i, y + S + 10, 1, 8); }
    ctx.fillStyle = '#7d8894'; ctx.fillText('4 keV', x, y + S + 30); ctx.fillText('500 keV per pixel (saturates)', x + 92, y + S + 30);
    // how to read it: a key of real examples
    if (keyW) {
      const kx = x + S + 40;
      ctx.fillStyle = '#cfd6de'; ctx.font = '600 12px system-ui, sans-serif'; ctx.fillText('How to read it', kx, y + 12);
      ctx.fillStyle = '#8a949e'; ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('The chip seen from above. Each square is', kx, y + 30); ctx.fillText('one pixel; colour = energy it collected.', kx, y + 44);
      ctx.fillText('The silicon is only 0.3 mm thick: a particle', kx, y + 62); ctx.fillText('going straight down makes a dot; a line means', kx, y + 76);
      ctx.fillText('it came in at a slant (longer = more grazing).', kx, y + 90);
      this.key?.forEach((k, i) => {
        const yy = y + 110 + i * 62;
        ctx.imageSmoothingEnabled = false; ctx.drawImage(k.c, kx, yy, 52, 52);
        ctx.strokeStyle = '#2a323b'; ctx.strokeRect(kx - 0.5, yy - 0.5, 53, 53);
        ctx.fillStyle = '#cfd6de'; ctx.fillText(k.label.split(':')[0], kx + 64, yy + 22);
        ctx.fillStyle = '#8a949e'; ctx.fillText(k.label.split(':')[1].trim(), kx + 64, yy + 38);
      });
    }
    if (this.colorize) {  // Expose legend
      const types = [[1, 'muon'], [2, 'electron'], [3, 'alpha / helium'], [4, 'proton'], [5, 'gamma ray'], [6, 'heavy nucleus']];
      types.forEach(([t, name], i) => { const c = TCOL[t]; ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(16, 30 + i * 18, 10, 10); ctx.fillStyle = '#cfd6de'; ctx.fillText(name, 32, 39 + i * 18); });
    }
    ctx.fillStyle = '#cfd6de'; ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(SOURCES[this.source].label, 16, H - 92);
    ctx.fillStyle = '#7d8894'; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`256 × 256 pixels of 55 µm (1.4 cm chip) · ${this.hit} pixels fired · Expose colours each pixel by the particle that hit it`, 16, H - 76);
  }
}
// charge sharing: one particle's deposits -> pixel energies (E array or Map), chip of n x n pixels
export function pixelize(cells, E, local, n, X0, Y0, a) {
  const ca = Math.cos(a), sa = Math.sin(a);
  for (let i = 0; i < cells.length; i += 4) {
    const cx = X0 + ca * cells[i] - sa * cells[i + 1], cy = Y0 + sa * cells[i] + ca * cells[i + 1], z = cells[i + 2], e = cells[i + 3];
    const dz = Math.max(1, z + D / 2);                       // drift distance to the pixel side
    const sd = Math.sqrt(2 * KT * D * dz / V), sp = TUNE.plasma * Math.sqrt(e / 10), s = Math.hypot(sd, sp > 3 ? sp : 0);
    const i0 = Math.max(0, Math.floor((cx - 3 * s) / PITCH)), i1 = Math.min(n - 1, Math.floor((cx + 3 * s) / PITCH));
    const j0 = Math.max(0, Math.floor((cy - 3 * s) / PITCH)), j1 = Math.min(n - 1, Math.floor((cy + 3 * s) / PITCH));
    const k = Math.SQRT2 * s;
    for (let ii = i0; ii <= i1; ii++) {
      const fx = 0.5 * (erf(((ii + 1) * PITCH - cx) / k) - erf((ii * PITCH - cx) / k));
      if (fx < 1e-4) continue;
      for (let jj = j0; jj <= j1; jj++) {
        const fy = 0.5 * (erf(((jj + 1) * PITCH - cy) / k) - erf((jj * PITCH - cy) / k)), q = e * fx * fy, idx = jj * n + ii;
        if (E) E[idx] += q; else local.set(idx, (local.get(idx) || 0) + q);
      }
    }
  }
}
export const THRESHOLD = THR, PIXEL = PITCH;
export const TIMEPIX_SOURCES = Object.keys(SOURCES);
