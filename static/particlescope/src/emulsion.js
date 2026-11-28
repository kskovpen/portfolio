// Nuclear emulsion under the microscope (Powell, Lattes, Occhialini, Bristol 1947).
//
// Tracks are Geant4 steps in G4_PHOTO_EMULSION (emulsion/g4/g4emulsion.cc). After development every
// ionising track is a row of black silver grains. Grain density rises with ionisation and saturates:
//   g = g_max (1 - exp(-k dE/dx)),  g_max = 2 /um,  k set so a minimum-ionising track gives 0.27 /um
// (Ilford G5: ~27 grains per 100 um), so slow pions and muons are solid black lines and the fast
// positron is a faint dotted trail. The 600 um emulsion is deeper than the microscope's depth of field:
// grains away from the focal plane blur, and the focus slowly scans through the layer as an observer's would.

const G_MAX = 2.0, K = 0.268;      // grains/um, 1/(keV/um)
const SHOW = 7.5;                  // seconds per event
const TEXT = {
  'pi+': 'π⁺ stops → μ⁺ (always ~600 µm) → e⁺: the decay chain that revealed the pion',
  'pi-': 'π⁻ captured by a nucleus, which bursts into a “star” of protons and nuclear fragments',
};

function poisson(mu) {
  if (mu > 30) return Math.max(0, Math.round(mu + Math.sqrt(mu) * Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())));
  let L = Math.exp(-mu), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

export class EmulsionScene {
  constructor(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.lib = null; this.k = -1; }
  async load(url = 'assets/emulsion-events.json') {
    if (this.lib) return;
    this.lib = await (await fetch(url)).json();
  }
  start(now) { this.next(now); }

  next(now) {
    const ev = this.lib.events, kind = this.k % 3 === 2 ? 'pi-' : 'pi+';   // mostly pi-mu-e chains, some stars
    this.k++;
    const pool = ev.filter((e) => e.kind === kind);
    this.ev = pool[(Math.random() * pool.length) | 0]; this.t0 = now;
    // grains, in track order (pion first): each remembers when to appear while "following the track"
    this.grains = [];
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    this.ev.tracks.forEach(([pdg, p], ti) => {
      const stage = Math.abs(pdg) === 211 ? 0 : Math.abs(pdg) === 13 ? 1 : pdg === -11 ? 2 : Math.abs(pdg) === 11 ? -1 : 1;
      for (let i = 0; i + 7 < p.length; i += 4) {
        const x0 = p[i], y0 = p[i + 1], z0 = p[i + 2], x1 = p[i + 4], y1 = p[i + 5], z1 = p[i + 6];
        const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0), dedx = p[i + 7];
        const n = poisson(len * G_MAX * (1 - Math.exp(-K * dedx)));
        for (let j = 0; j < n; j++) {
          const f = Math.random();
          this.grains.push({ x: x0 + f * (x1 - x0) + 0.3 * (Math.random() - 0.5), y: y0 + f * (y1 - y0) + 0.3 * (Math.random() - 0.5), z: z0 + f * (z1 - z0),
            r: 0.35 + 0.35 * Math.random(), stage });
        }
        if (stage >= 0 && stage <= 1) { minx = Math.min(minx, x0); maxx = Math.max(maxx, x0); miny = Math.min(miny, y0); maxy = Math.max(maxy, y0); }
      }
    });
    // centre the field on the pion stop + muon (the interesting part)
    this.cx = (minx + maxx) / 2; this.cy = (miny + maxy) / 2;
    this.span = Math.max(500, maxx - minx, maxy - miny) * 1.15;
    // development fog: random grains throughout the layer
    for (let i = 0; i < 2600; i++) this.grains.push({ x: this.cx + (Math.random() - 0.5) * this.span * 1.6, y: this.cy + (Math.random() - 0.5) * this.span * 1.6, z: (Math.random() - 0.5) * 600, r: 0.3 + 0.3 * Math.random(), stage: -2 });
    this.text = TEXT[this.ev.kind];
  }

  draw(now) {
    if (!this.lib) return;
    const cv = this.cv, ctx = this.ctx, dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const T = now - this.t0;
    if (T > SHOW) { this.next(now); return this.draw(now); }
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // microscope field: a bright, slightly warm disc
    const R = Math.min(W, H - 120) * 0.47, cx = W / 2, cy = (H - 120) / 2 + 20, s = 2 * R / this.span;
    const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
    g.addColorStop(0, '#ece6d4'); g.addColorStop(0.85, '#d9d1bb'); g.addColorStop(1, '#a9a18c');
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.fillStyle = g; ctx.fill(); ctx.clip();
    // focus slowly scans through the 600 um layer
    const zf = 180 * Math.sin(T * 0.9), dof = 12;
    // "following the track": pion, then muon, then positron/star prongs appear
    const reveal = [0.0, 1.6, 3.0];
    for (const gr of this.grains) {
      if (gr.stage >= 0 && T < reveal[Math.min(2, gr.stage)] + (gr.stage === 0 ? 0 : 0)) continue;
      if (gr.stage === -1 && T < 1.0) continue;
      const blur = Math.abs(gr.z - zf) / dof, x = cx + (gr.x - this.cx) * s, y = cy - (gr.y - this.cy) * s;
      const rr = Math.max(0.7, gr.r * s * 2.2) * (1 + 0.12 * blur), a = Math.min(0.92, 0.95 / (1 + 0.06 * blur * blur));
      ctx.fillStyle = `rgba(28,22,14,${a})`;
      ctx.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
    }
    ctx.restore();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, 2 * Math.PI); ctx.stroke();
    // scale bar
    const bar = 100 * s;
    ctx.fillStyle = '#cfd6de'; ctx.fillRect(cx + R * 0.45, cy + R * 0.82, bar, 3);
    ctx.font = '11px system-ui, sans-serif'; ctx.fillText('100 µm', cx + R * 0.45, cy + R * 0.82 - 6);
    ctx.fillStyle = '#cfd6de'; ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(this.text, 16, H - 92);
    ctx.fillStyle = '#7d8894'; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`emulsion 600 µm thick · focus at ${zf >= 0 ? '+' : ''}${zf.toFixed(0)} µm (out-of-focus grains blur)`, 16, H - 76);
  }
}
