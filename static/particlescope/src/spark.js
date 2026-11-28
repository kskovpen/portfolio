// Spark chamber (museum style): a stack of parallel aluminium plates in neon/helium between two
// scintillator paddles. When both paddles fire, a ~10 kV pulse is put on every second plate within
// ~0.5 µs, while the muon's ionisation trail is still there: each gap breaks down along the trail,
// giving a bright neon spark perpendicular to the plates (narrow gaps).
// A small clearing field sweeps old ions away between events, so only the triggering track sparks.
//
// Rates: sea-level muons ~1 /cm^2/min (cos^2 zenith law) through the 60 x 40 cm paddles.
import { TYPE } from './physics.js';
import { crack } from './sound.js';

export const SPARK = {
  halfW: 30, halfD: 20,         // plates 60 x 40 cm
  nGap: 20, pitch: 1.6,         // 20 gaps, 1.6 cm pitch
  plate: 0.3,                   // 3 mm aluminium
  eff: 0.97,                    // per-gap spark efficiency for a single track
  secondEff: 0.45,              // a second track in the same gap often loses the current race
  dead: 0.45,                   // s: the HV pulser recharges after each discharge (limits museum chambers to ~1-3 Hz)
};
const H = SPARK.nGap * SPARK.pitch / 2;          // half height of the stack

function rand() { return Math.random(); }
function gauss() { let u = 0; while (!u) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); }

export class SparkChamber {
  constructor(renderer) {
    this.r = renderer; this.next = 0; this.count = 0;
    const area = 4 * SPARK.halfW * SPARK.halfD;      // cm^2 of the top paddle
    this.rate = area / 60;                            // muons/s crossing the top paddle plane
  }
  // aluminium plates + the two scintillator paddles, as boxes for the renderer
  boxes() {
    const b = [], { halfW: w, halfD: d, plate: t, pitch: p, nGap: n } = SPARK;
    for (let i = 0; i <= n; i++) { const y = -H + i * p; b.push([-w, w, y - t / 2, y + t / 2, -d, d]); }
    b.push([-w, w, H + 2.5, H + 4.5, -d, d], [-w, w, -H - 4.5, -H - 2.5, -d, d]); // paddles
    return b;
  }
  reset(t) { this.next = t + 0.4; }

  step(t, dt) {
    // Poisson arrivals at the top paddle; keep those that also cross the bottom paddle (coincidence)
    while (this.next <= t + dt) {
      const fired = this.muon(this.next);
      this.next += (fired ? SPARK.dead : 0) - Math.log(1 - rand()) / this.rate; // dead while the pulser recharges
    }
  }

  muon(t) {
    // through a horizontal plane the angular distribution is cos^2(theta) * cos(theta)
    const c = Math.pow(rand(), 1 / 4), s = Math.sqrt(1 - c * c), ph = 2 * Math.PI * rand();
    const d = [s * Math.cos(ph), -c, s * Math.sin(ph)];
    const x0 = (2 * rand() - 1) * SPARK.halfW, z0 = (2 * rand() - 1) * SPARK.halfD, yTop = H + 3.5;
    const k = (2 * yTop) / c, xb = x0 + d[0] * k, zb = z0 + d[2] * k;
    if (Math.abs(xb) > SPARK.halfW || Math.abs(zb) > SPARK.halfD) return false; // missed the bottom paddle: no trigger
    // ~1% of triggers are small air showers: 2-3 parallel muons
    const tracks = [[x0, z0]];
    if (rand() < 0.01) for (let i = 1 + (rand() < 0.4); i > 0; i--) tracks.push([x0 + 8 * gauss(), z0 + 8 * gauss()]);
    let n = 0;
    for (let g = 0; g < SPARK.nGap; g++) {
      const yc = -H + (g + 0.5) * SPARK.pitch, kk = (yTop - yc) / c;
      tracks.forEach(([xa, za], i) => {
        const x = xa + d[0] * kk, z = za + d[2] * kk;
        if (Math.abs(x) > SPARK.halfW || Math.abs(z) > SPARK.halfD) return;
        if (rand() > (i ? SPARK.secondEff : SPARK.eff)) return;
        this.spark(x, yc, z, t + 2e-3 * rand()); n++;
      });
    }
    if (rand() < 0.03) { // occasional spurious spark at a plate edge
      const g = (rand() * SPARK.nGap) | 0;
      this.spark((rand() < 0.5 ? -1 : 1) * (SPARK.halfW - 0.5), -H + (g + 0.5) * SPARK.pitch, (2 * rand() - 1) * SPARK.halfD, t, TYPE.RAIN);
    }
    this.count++;
    crack(n);
    return true;
  }

  // one spark: a slightly jagged bright filament bridging the gap
  spark(x, yc, z, t, type = TYPE.MUON) {
    const gap = SPARK.pitch - SPARK.plate, b = 0.7 + 0.6 * rand(), N = 260;
    let ox = 0, oz = 0;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      ox += 0.012 * gauss(); oz += 0.012 * gauss();
      const y = yc - gap / 2 + f * gap;
      this.r.push(x + ox, y, z + oz, t, 1.0, (rand() * 16777215) | 0, 1.6 * b, type);
      if (rand() < 0.3) this.r.push(x + ox + 0.05 * gauss(), y, z + oz + 0.05 * gauss(), t, 1.4, (rand() * 16777215) | 0, 0.35 * b, type); // glow sheath
    }
  }
}
