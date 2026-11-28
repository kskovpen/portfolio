// Cloud chamber physics: event generation and charged-particle transport in air.
// Units: cm, MeV, seconds. The chamber floor is at z = floorZ, the supersaturated
// (sensitive) layer is centred at z = 0. Every ion pair produced inside the
// sensitive layer may nucleate a droplet; droplets are handed to the GPU sink.
//
// Transport is a "class II" condensed history, as in Geant4/EGS:
//  * energy loss: restricted stopping power (continuous) + explicit delta rays
//    above T_CUT (Bhabha-like 1/T^2 for heavy particles, Moller for electrons),
//    which gives realistic energy-loss straggling and visible secondary branches;
//  * ionisation is deposited as primary clusters with a measured size distribution;
//  * elastic scattering: screened Rutherford (Wentzel, Moliere screening) with the
//    Mott factor for electrons; soft collisions -> Gaussian kick, hard collisions
//    (angle > theta_c) simulated one by one (gives the kinks, incl. alpha-N recoils).

export const CHAMBER = { halfW: 20, halfH: 15 };
const HW = CHAMBER.halfW, HH = CHAMBER.halfH;

const ME = 0.511, MMU = 105.658, MP = 938.272, MALPHA = 3727.38, MN14 = 13040.2, MPI = 139.570, MK0 = 497.611;
const W_ION = 34e-6;           // MeV per ion pair in air
const RHO = 1.205e-3;          // g/cm^3, air at 20 C
const MIP_DEDX = 1.815 * RHO;  // MeV/cm at minimum ionisation
const K_DELTA = 0.1535 * 0.4992 * RHO; // MeV/cm : d2N/dTdx = K/beta^2/T^2 (Z/A of air)
const T_CUT = 0.005;           // MeV, delta rays above this are tracked explicitly
const I_AIR = 85.7e-6;         // MeV, mean excitation energy
const DENSE = 2500;            // max droplets per cm actually generated (subsampling for speed)
const N_SAT = 200;             // pairs/cm above which vapour depletion limits droplet growth (tuned to footage)
const SIG_ION = 0.013;         // cm, ion diffusion before capture (sqrt(2 D_ion t_capture))

// Elastic scattering constants
const Z_AIR = 7.2, N_ATOM = RHO * 6.022e23 / 14.5;           // effective Z, atoms/cm^3
const E2 = 1.44e-13, HBARC = 197.327e-13, ALPHA_FS = 1 / 137.036;   // MeV cm
const A_TF = 0.885 * 0.529e-8 * Math.pow(Z_AIR, -1 / 3);     // Thomas-Fermi radius, cm

// Particle type ids (also used by the shader for the colour-coded mode)
export const TYPE = { RAIN: 0, MUON: 1, ELECTRON: 2, ALPHA: 3, PROTON: 4, DELTA: 5, POSITRON: 6, PION: 7, KAON: 8 };

const rand = Math.random;
function gauss() { let u = 0; while (u === 0) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); }
function poisson(l) {
  if (l <= 0) return 0;
  if (l > 40) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss()));
  const L = Math.exp(-l); let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}
function gammaSample(k) {
  if (k < 1) return gammaSample(k + 1) * Math.pow(rand(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v; do { x = gauss(); v = 1 + c * x; } while (v <= 0);
    v = v * v * v; const u = rand();
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}
function isotropic() { const z = 2 * rand() - 1, s = Math.sqrt(1 - z * z), ph = 2 * Math.PI * rand(); return [s * Math.cos(ph), s * Math.sin(ph), z]; }
function normalize(d) { const l = Math.hypot(d[0], d[1], d[2]); d[0] /= l; d[1] /= l; d[2] /= l; return d; }
function rotZ(d, a) { const c = Math.cos(a), s = Math.sin(a), x = d[0], y = d[1]; d[0] = c * x - s * y; d[1] = s * x + c * y; }
function basis(d) {
  const a = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = normalize([d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]]);
  return [u, [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]];
}
// Unit vector perpendicular to d with random azimuth
function randPerp(d) { const [u, v] = basis(d), ph = 2 * Math.PI * rand(), c = Math.cos(ph), s = Math.sin(ph); return [c * u[0] + s * v[0], c * u[1] + s * v[1], c * u[2] + s * v[2]]; }
// Direction at polar angle acos(cosA) to d (along perpendicular w, random if not given)
function deflect(d, cosA, w = randPerp(d)) {
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  return normalize([d[0] * cosA + w[0] * sinA, d[1] * cosA + w[1] * sinA, d[2] * cosA + w[2] * sinA]);
}
function gaussKick(d, th0) {
  const [u, v] = basis(d), tx = gauss() * th0, ty = gauss() * th0;
  d[0] += tx * u[0] + ty * v[0]; d[1] += tx * u[1] + ty * v[1]; d[2] += tx * u[2] + ty * v[2];
  normalize(d);
}
function interp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let i = 1; while (xs[i] < x) i++;
  return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
}

// ---- Tables ------------------------------------------------------------------
// Electron collision stopping power in air (MeV cm^2/g; Geant4 11.3 G4EmCalculator, = ESTAR within ~2%), log-log interpolated.
const E_T = [0.001, 0.002, 0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 2, 5, 10];
const E_S = [102.687, 65.349, 33.569, 19.781, 11.584, 8.501, 5.826, 4.204, 3.638, 2.475, 2.09, 1.809, 1.694, 1.674, 1.711, 1.912, 2.159];
function eStop(T) {
  if (T <= E_T[0]) return E_S[0] * RHO;
  if (T >= E_T[E_T.length - 1]) return E_S[E_S.length - 1] * RHO;
  let i = 1; while (E_T[i] < T) i++;
  const f = Math.log(T / E_T[i - 1]) / Math.log(E_T[i] / E_T[i - 1]);
  return Math.exp(Math.log(E_S[i - 1]) + f * Math.log(E_S[i] / E_S[i - 1])) * RHO;
}
// Katz-Penfold electron CSDA range in air, cm
function eRange(T) { return 0.412 * Math.pow(T, 1.265 - 0.0954 * Math.log(T)) / RHO; }

// Alpha CSDA range in air (20 C, 1.205 mg/cm^3), integrated from the ICRU 49 / ASTAR
// stopping powers used by Geant4 11.3 (electronic + nuclear). Its derivative is the
// Bragg curve: 0.92 MeV/cm at 5 MeV rising to a 2.43 MeV/cm peak near 0.75 MeV.
const A_E = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10];
const A_R = [0, 0.0902, 0.1373, 0.2043, 0.2571, 0.3035, 0.3467, 0.3884, 0.4296, 0.4708, 0.5125, 0.5551, 0.644, 0.7389, 0.8409, 0.9502, 1.0668, 1.3893, 1.7554, 2.1632, 2.6115, 3.0993, 3.6256, 4.1896, 4.7907, 5.4283, 6.1017, 6.8105, 7.5539, 8.3315, 9.143, 10.8665];
const alphaRange = (E) => interp(A_E, A_R, E);
const alphaEnergy = (R) => interp(A_R, A_E, R);

// Primary-cluster size distribution: shape of Fischle et al. (1991) for n <= 10, then ~1/n^2
// up to the delta-ray cut (~150 pairs = 5 keV). The tail weight is set so a MIP makes
// ~22 primary clusters/cm in air (mean cluster 2.4 pairs), which reproduces the Geant4
// PAI-model energy-loss straggling in 1 cm of air (most probable 1.25 keV, median 1.6 keV).
const CLUSTER_CDF = (() => {
  const P = [0.656, 0.15, 0.064, 0.035, 0.0225, 0.0155, 0.0105, 0.0081, 0.0061, 0.0049];
  for (let n = 11; n <= 150; n++) P.push(0.25 / (n * n));
  const tot = P.reduce((a, b) => a + b, 0);
  let c = 0; return P.map((p) => (c += p / tot));
})();
const CLUSTER_MEAN = CLUSTER_CDF.reduce((m, c, i) => m + (i + 1) * (c - (i ? CLUSTER_CDF[i - 1] : 0)), 0);
function clusterSize() {
  const u = rand(); let lo = 0, hi = CLUSTER_CDF.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (CLUSTER_CDF[m] < u) lo = m + 1; else hi = m; }
  return lo + 1;
}

// Moller (e-e-) cross section: d2N/dTdx = K/beta^2/T^2 * g(eps), eps = T_delta/T in [T_CUT/T, 1/2];
// g -> 1 for small eps, g <= 2.25.
function mollerG(eps, gam) {
  const a = (gam - 1) / gam;
  return 1 + eps * eps / ((1 - eps) * (1 - eps)) + eps * eps * a * a - (2 * gam - 1) / (gam * gam) * eps / (1 - eps);
}
// integral of g d(ln T_delta) over [T_CUT, T/2]: energy carried away by delta rays (per K/beta^2)
function mollerLogInt(T, gam) {
  const u0 = Math.log(T_CUT), u1 = Math.log(T / 2), n = 16, h = (u1 - u0) / n;
  let s = 0;
  for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * mollerG(Math.exp(u0 + i * h) / T, gam);
  return s * h / 3;
}

// Bethe-Bloch: total and restricted (T < T_CUT) energy loss relative to minimum ionisation
function betheRel(beta) {
  const b2 = beta * beta, g2 = 1 / (1 - b2);
  const L = Math.log(2 * ME * b2 * g2 / I_AIR) - b2;
  return Math.max(L, 0.5) / b2 / 11.86;
}
function restrictedFrac(beta, Tmax) {
  if (Tmax <= T_CUT) return 1;
  const b2 = beta * beta, a = 2 * ME * b2 / (1 - b2);
  const full = 0.5 * Math.log(a * Tmax / (I_AIR * I_AIR)) - b2;
  const restr = 0.5 * Math.log(a * T_CUT / (I_AIR * I_AIR)) - 0.5 * b2 * (1 + T_CUT / Tmax);
  return Math.min(1, Math.max(0.2, restr / full));
}

// Sea-level muon spectrum (Reyna 2006): I(p, theta) = cos^3(theta) I_V(p cos theta).
// Sample x = p cos(theta) from I_V, then p = x / cos(theta).
const MU_X = [], MU_CDF = [];
(() => {
  const IV = (x) => { if (x < 1) return 0.00253; const L = Math.log10(x); return 0.00253 * Math.pow(x, -(0.2455 + 1.288 * L - 0.2555 * L * L + 0.0209 * L * L * L)); };
  let c = 0, prev = null;
  for (let i = 0; i <= 400; i++) {
    const x = 0.2 * Math.pow(5000, i / 400); // 0.2 GeV .. 1 TeV
    if (prev !== null) c += 0.5 * (IV(prev) + IV(x)) * (x - prev);
    MU_X.push(x); MU_CDF.push(c); prev = x;
  }
  for (let i = 0; i < MU_CDF.length; i++) MU_CDF[i] /= c;
})();
const sampleMuonX = () => interp(MU_CDF, MU_X, rand()) * 1000; // MeV/c

// Environmental gamma rays producing Compton electrons in the chamber: the main
// terrestrial lines (K-40, U/Th chains) plus the down-scattered continuum.
const GAMMA_LINES = [[1.461, 0.25, 'K-40'], [2.614, 0.08, 'Tl-208'], [0.609, 0.12, 'Bi-214'], [1.764, 0.05, 'Bi-214'], [1.120, 0.04, 'Bi-214'], [0.911, 0.06, 'Ac-228'], [0.352, 0.08, 'Pb-214'], [0.295, 0.04, 'Pb-214']];
function sampleGamma() { return sampleGammaSrc()[0]; }
function sampleGammaSrc() {
  let u = rand();
  for (const [E, w, src] of GAMMA_LINES) { if (u < w) return [E, src]; u -= w; }
  return [0.05 * Math.pow(20, rand()), 'scattered']; // continuum 50 keV - 1 MeV, ~1/E
}
export function fmtE(E) { return E < 1 ? `${Math.round(E * 1000)} keV` : E < 1000 ? `${E.toFixed(2)} MeV` : `${(E / 1000).toFixed(1)} GeV`; }
// Klein-Nishina recoil-electron energy
function comptonElectron(Eg) {
  const eps = Eg / ME, Tmax = Eg * 2 * eps / (1 + 2 * eps);
  const f = (T) => { const s = T / Eg; return 2 + s * s / (eps * eps * (1 - s) * (1 - s)) + s / (1 - s) * (s - 2 / eps); };
  let fm = 0; for (let i = 0; i <= 40; i++) fm = Math.max(fm, f(Tmax * i / 40 * 0.9999));
  for (;;) { const T = rand() * Tmax; if (rand() * fm * 1.05 < f(T)) return T; }
}

// Beta spectrum: p E q^2 * F(Z, E) * shape. Sr-90 and Y-90 are both unique
// first-forbidden decays, shape factor (p^2 + q^2). F = non-relativistic Fermi function.
const betaMax = new Map();
function betaSample(Q, Zd) {
  const f = (T) => {
    const p = Math.sqrt(T * T + 2 * T * ME), E = T + ME, q = Q - T;
    if (p <= 0) return 0;
    const eta = 2 * Math.PI * Zd * ALPHA_FS * E / p, F = eta / (1 - Math.exp(-eta));
    return p * E * q * q * F * (p * p + q * q);
  };
  if (!betaMax.has(Q)) { let m = 0; for (let i = 1; i <= 400; i++) m = Math.max(m, f(Q * i / 401)); betaMax.set(Q, m * 1.05); }
  const fm = betaMax.get(Q);
  for (;;) { const T = rand() * Q; if (rand() * fm < f(T)) return T; }
}

// Screened-Rutherford elastic scattering off air nuclei (mixed scheme).
// mu = (1 - cos theta)/2, d(sigma)/d(mu) = pi k / (mu + A)^2.
function elastic(d, p, beta, z, electron, ds, muC, onHard) {
  const ZZ = electron ? Z_AIR * (Z_AIR + 1) : Z_AIR * Z_AIR; // atomic electrons also scatter e-
  const k = ZZ * Math.pow(z * E2 / (p * beta), 2);
  const A = Math.pow(HBARC / (2 * p * A_TF), 2) * (1.13 + 3.76 * Math.pow(ALPHA_FS * Z_AIR * z / beta, 2));
  // soft part: <theta^2> = 4 pi n k ds [ln((muC+A)/A) + A/(muC+A) - 1]
  const soft = 4 * Math.PI * N_ATOM * k * ds * (Math.log((muC + A) / A) + A / (muC + A) - 1);
  if (soft > 0) gaussKick(d, Math.sqrt(soft / 2));
  // hard part: explicit single scatters
  const i0 = 1 / (muC + A), i1 = 1 / (1 + A);
  const nh = poisson(Math.PI * N_ATOM * k * (i0 - i1) * ds);
  for (let i = 0; i < nh; i++) {
    const mu = 1 / (i0 - rand() * (i0 - i1)) - A;
    if (electron && rand() > 1 - beta * beta * mu) continue; // Mott factor
    if (onHard) onHard(mu); else { const nd = deflect(d, 1 - 2 * mu); d[0] = nd[0]; d[1] = nd[1]; d[2] = nd[2]; }
  }
}

export class ChamberPhysics {
  constructor(sink, params) {
    this.sink = sink;   // object with push(x,y,z,t0,size,seed,weight,type)
    this.p = params;
    this.queue = [];    // delayed decays (e.g. Po-216 after thoron)
    this.counts = new Float64Array(6);
    this.labels = [];      // finished labels: {type, title, detail, t, x, y, z}
    this.labelStack = [];  // tracks currently being generated
  }

  // Track labels: deposits of the matching type are collected while a track is
  // generated; the label is anchored at the middle visible point along the track.
  beginLabel(type, title, detail, t) { this.labelStack.push({ type, title, detail, t, pts: [] }); }
  endLabel(minPts = 10) {
    const L = this.labelStack.pop();
    if (!L || L.pts.length < minPts) return;
    const m = L.pts[L.pts.length >> 1];
    this.labels.push({ type: L.type, title: L.title, detail: L.detail, t: L.t, x: m[0], y: m[1], z: m[2] });
    if (this.labels.length > 300) this.labels.splice(0, 150);
  }
  floorZ() { return -this.p.layer * 0.75; }

  // ---- absorber plate (historic experiments): a lead wall across the chamber, x in [x0, x1]
  hitsPlate(xa, xb) { const P = this.plate; return P && Math.max(xa, xb) >= P.x0 && Math.min(xa, xb) <= P.x1; }
  // Thick-absorber passage: ionisation (Bethe, ~MIP), bremsstrahlung for e+- (Bethe-Heitler:
  // ln(E0/E) ~ Gamma(t / (X0 ln2))) and Highland multiple scattering. Returns new kinetic energy (<= 0: absorbed).
  throughPlate(d, T, mass, charge, lepton) {
    const P = this.plate, t = (P.x1 - P.x0) / Math.max(Math.abs(d[0]), 0.05), T0 = T;
    // optional window [lo, hi] on the exit energy: a historic scene can show events like the photographed one
    for (let tries = 0; tries < 200; tries++) {
      T = T0;
      if (lepton) T = (T + mass) * Math.exp(-gammaSample(t / (P.X0 * Math.LN2))) - mass;
      T -= P.dedx * charge * charge * t;
      if (!this.exitWindow || (T >= this.exitWindow[0] && T <= this.exitWindow[1])) break;
    }
    if (T <= (lepton ? 0.5 : 2)) return 0;
    const p = Math.sqrt(T * T + 2 * T * mass), beta = p / (T + mass), x = t / P.X0;
    gaussKick(d, 13.6 / (beta * p) * Math.abs(charge) * Math.sqrt(x) * (1 + 0.038 * Math.log(x)));
    if (Math.sign(d[0]) === 0) d[0] = 1e-3;
    return T;
  }
  plateExitX(d) { return d[0] > 0 ? this.plate.x1 + 1e-3 : this.plate.x0 - 1e-3; }
  zRange() { return this.p.layer * 0.5 * 1.6; }
  sens(z) {
    if (z < this.floorZ()) return 0;
    const u = z / (this.p.layer * 0.5);
    return this.p.efficiency * Math.exp(-u * u * u * u);
  }
  outside(x, y, z) {
    const R = this.scene && this.scene.radius; // historic chambers were small: tracks leave the illuminated volume
    if (R && x * x + y * y > R * R) return true;
    return z < this.floorZ() || Math.abs(z) > Math.max(5, this.p.layer) || Math.abs(x) > HW + 3 || Math.abs(y) > HH + 3; }

  // n expected ion pairs at a point -> droplets (only where vapour is supersaturated)
  deposit(x, y, z, t, n, sigma, weight, type) {
    if (x < -HW || x > HW || y < -HH || y > HH) return;
    if (this.plate && x >= this.plate.x0 && x <= this.plate.x1) return; // no vapour inside the lead
    if (this.scene && this.scene.radius && x * x + y * y > this.scene.radius ** 2) return;
    const s = this.sens(z);
    if (s < 1e-3) return;
    const k = poisson(n * s);
    if (k > 0 && this.labelStack.length) { const L = this.labelStack[this.labelStack.length - 1]; if (L.type === type) L.pts.push([x, y, z]); }
    const sg = Math.sqrt(sigma * sigma + SIG_ION * SIG_ION);
    for (let i = 0; i < k; i++) {
      this.sink.push(
        x + gauss() * sg, y + gauss() * sg, z + gauss() * sg * 0.5,
        // droplets nucleated together in the same vapour grow to nearly equal size (~ +-10%)
        t + rand() * 0.012, 0.9 + 0.2 * rand(), (rand() * 16777215) | 0, weight, type);
    }
  }

  // Ionisation along a straight segment. Sparse ionisation is laid down as primary
  // clusters (beaded look of muon/electron tracks). Vapour depletion: above N_SAT
  // pairs/cm the vapour per unit length is shared among more droplets, so each is
  // smaller and the scattered light grows only as N^(1/3) (light ~ N r^2, N r^3 fixed).
  ionize(x, y, z, d, len, pairsPerCm, t, type, sigma) {
    const zr = this.zRange(), z2 = z + d[2] * len, tr = this.tracer;
    if ((z > zr && z2 > zr) || (z < -zr && z2 < -zr)) { if (tr) tr.step(x + d[0] * len, y + d[1] * len, z2, pairsPerCm * W_ION * len); return; }
    const light = pairsPerCm <= N_SAT ? pairsPerCm : N_SAT * Math.cbrt(pairsPerCm / N_SAT);
    if (pairsPerCm <= DENSE) {
      const w = light / pairsPerCm, nc = poisson(pairsPerCm * len / CLUSTER_MEAN);
      let pairs = 0;
      for (let i = 0; i < nc; i++) {
        const s = rand() * len, n = clusterSize();
        pairs += n;
        // big clusters come from ~keV electrons with ~0.1 mm range: small blobs
        this.deposit(x + d[0] * s, y + d[1] * s, z + d[2] * s, t, n, Math.hypot(sigma, 0.00015 * n), w, type);
      }
      if (tr) tr.step(x + d[0] * len, y + d[1] * len, z2, pairs * W_ION);
    } else {
      if (tr) tr.step(x + d[0] * len, y + d[1] * len, z2, pairsPerCm * W_ION * len);
      const w = light / DENSE, nd = DENSE * len, pieces = Math.max(1, Math.ceil(nd / 8));
      for (let i = 0; i < pieces; i++) {
        const s = (i + rand()) / pieces * len;
        this.deposit(x + d[0] * s, y + d[1] * s, z + d[2] * s, t, nd / pieces, sigma, w, type);
      }
    }
  }

  // Muons, protons, shower particles crossing the sensitive layer; (x0, y0) is where
  // the track pierces z = 0.
  heavyTrack(x0, y0, dir, mass, charge, T, type, t) {
    const zr = this.zRange(), cz = Math.abs(dir[2]);
    const L = Math.min(zr / Math.max(cz, 1e-3), 90);
    this.heavyFrom(x0 - dir[0] * L, y0 - dir[1] * L, -dir[2] * L, dir, mass, charge, T, type, t, 2 * L,
      mass > 500 ? 2212 : -13 * charge);
  }

  // Heavy charged particle (mu, pi, p) from a point, for up to maxLen cm
  heavyFrom(x, y, z, dir, mass, charge, T, type, t, maxLen, pdg) {
    const zr = this.zRange(), d = dir.slice(), B = this.p.bField;
    const ds = Math.max(0.05, Math.min(0.4, maxLen / 200));
    const sigma = type === TYPE.PROTON ? 0.01 : 0.004;
    if (this.tracer) this.tracer.begin(pdg, T, x, y, z, d);
    let inside = false;
    for (let s = 0; s < maxLen; s += ds) {
      const p = Math.sqrt(T * T + 2 * T * mass), beta = p / (T + mass), g = (T + mass) / mass;
      const Tmax = 2 * ME * beta * beta * g * g / (1 + 2 * g * ME / mass + (ME / mass) ** 2);
      const dEdx = MIP_DEDX * charge * charge * Math.min(betheRel(beta), beta > 0.95 ? 1.3 : 1e4);
      if (Math.abs(z) < zr) {
        this.ionize(x, y, z, d, ds, dEdx * restrictedFrac(beta, Tmax) / W_ION, t, type, sigma);
        // knock-on electrons above T_CUT
        const Tm = Math.min(Tmax, 10);
        if (Tm > T_CUT) {
          const nd = poisson(K_DELTA * charge * charge / (beta * beta) * (1 / T_CUT - 1 / Tm) * ds);
          for (let i = 0; i < nd; i++) {
            const Te = 1 / (1 / T_CUT - rand() * (1 / T_CUT - 1 / Tm));
            const cosA = Math.min(1, Math.sqrt(Te / (Te + 2 * ME)) / beta);
            const f = rand() * ds;
            if (Te > 0.03) this.beginLabel(TYPE.DELTA, 'δ-ray', `knock-on e⁻ · ${fmtE(Te)}`, t);
            this.electronTrack(x + d[0] * f, y + d[1] * f, z + d[2] * f, deflect(d, cosA), Te, t, TYPE.DELTA, 1);
            if (Te > 0.03) this.endLabel(6);
          }
        }
        elastic(d, p, beta, charge, false, ds, 1e-4);
      }
      const xPrev = x;
      x += d[0] * ds; y += d[1] * ds; z += d[2] * ds;
      T -= dEdx * ds;
      if (this.hitsPlate(xPrev, x)) { T = this.throughPlate(d, T, mass, charge, false); x = this.plateExitX(d); }
      // stop when the track has LEFT the chamber (it may start outside and fly in: shallow cosmic muons)
      const out = Math.abs(x) > HW + 3 || Math.abs(y) > HH + 3 || (this.scene && this.scene.radius && x * x + y * y > this.scene.radius ** 2 + 4);
      if (!out) inside = true;
      if (T <= 0.5 || (out && (inside || x * d[0] + y * d[1] > 0))) break;
      if (B) rotZ(d, -charge * 3 * B / p * ds);
    }
    if (this.tracer) this.tracer.end();
  }

  // Electrons: restricted ESTAR stopping + Moller delta rays above T_CUT + screened
  // Rutherford/Mott elastic scattering. Low-energy electrons end in curled blobs.
  // charge = +1 gives a positron (Moller used in place of Bhabha for its delta rays: same 1/T^2 leading term)
  electronTrack(x, y, z, dir, T, t, type = TYPE.ELECTRON, depth = 0, charge = -1) {
    const d = dir.slice(), B = this.p.bField;
    if (this.tracer) this.tracer.begin(charge < 0 ? 11 : -11, T, x, y, z, d);
    for (let steps = 0; T > 0.001 && steps < 6000; steps++) {
      const p0 = Math.sqrt(T * T + 2 * T * ME), beta0 = p0 / (T + ME), b2 = beta0 * beta0;
      let ds = Math.min(Math.max(eRange(T) * 0.03, 0.002), 0.2);
      const Tmd = T / 2; // Moller: the faster outgoing electron is the "primary"
      let S = eStop(T);
      const gam = (T + ME) / ME;
      if (Tmd > T_CUT) S = Math.max(0.3 * S, S - K_DELTA / b2 * mollerLogInt(T, gam));
      let dE = S * ds;
      if (dE > T) { ds = T / S; dE = T; }
      this.ionize(x, y, z, d, ds, S / W_ION, t, type, 0.003);

      // explicit delta rays (energy-loss straggling + secondary branches)
      if (Tmd > T_CUT && depth < 3) {
        const nd = poisson(2.25 * K_DELTA / b2 * (1 / T_CUT - 1 / Tmd) * ds);
        for (let i = 0; i < nd && T - dE > 2 * T_CUT; i++) {
          const Te = 1 / (1 / T_CUT - rand() * (1 / T_CUT - 1 / Tmd));
          if (rand() * 2.25 > mollerG(Te / T, gam)) continue;
          const Tp = T - Te, w = randPerp(d);
          const cosD = Math.sqrt(Te * (T + 2 * ME) / (T * (Te + 2 * ME)));
          const cosP = Math.sqrt(Tp * (T + 2 * ME) / (T * (Tp + 2 * ME)));
          const f = rand() * ds;
          this.electronTrack(x + d[0] * f, y + d[1] * f, z + d[2] * f, deflect(d, cosD, w), Te, t, TYPE.DELTA, depth + 1);
          const nd2 = deflect(d, cosP, [-w[0], -w[1], -w[2]]); d[0] = nd2[0]; d[1] = nd2[1]; d[2] = nd2[2];
          T = Tp;
        }
      }
      const xPrev = x;
      x += d[0] * ds; y += d[1] * ds; z += d[2] * ds;
      T -= dE;
      if (this.hitsPlate(xPrev, x)) { T = this.throughPlate(d, T, ME, 1, true); x = this.plateExitX(d); if (T <= 0) break; }
      if (T > 0 && T <= 0.001) this.ionize(x, y, z, d, 0.001, T / W_ION / 0.001, t, type, 0.003); // last ~keV stops locally
      if (T <= 0.001 || this.outside(x, y, z)) break;
      const p = Math.sqrt(T * T + 2 * T * ME), beta = p / (T + ME);
      elastic(d, p, beta, 1, true, ds, 0.02);
      if (B) rotZ(d, -charge * 3 * B / p * ds);
    }
    if (this.tracer) this.tracer.end();
  }

  // Alphas: measured range-energy table (Bragg curve), screened-Rutherford scattering
  // on N/O nuclei with explicit hard collisions; big-angle ones produce a short
  // nuclear-recoil stub (the classic Blackett "fork").
  alphaTrack(x, y, z, dir, E, t) {
    const d = dir.slice(), B = this.p.bField;
    E *= 1 + 0.0075 * gauss(); // gives ~1.2% range straggling (Geant4: 1.2%)
    const mr = MALPHA / MN14, kin = 4 * MALPHA * MN14 / ((MALPHA + MN14) ** 2);
    if (this.tracer) this.tracer.begin(1000020040, E, x, y, z, d);
    for (let guard = 0; E > 0.005 && guard < 2000; guard++) {
      const R = alphaRange(E), step = Math.min(0.025, R);
      const E2_ = alphaEnergy(R - step), dEdx = (E - E2_) / step;
      this.ionize(x, y, z, d, step, dEdx / W_ION, t, TYPE.ALPHA, 0.015);
      x += d[0] * step; y += d[1] * step; z += d[2] * step;
      E = E2_;
      if (E <= 0.005 || this.outside(x, y, z)) break;
      const p = Math.sqrt(E * E + 2 * E * MALPHA), beta = p / (E + MALPHA);
      elastic(d, p, beta, 2, false, step, 2.5e-5, (mu) => {
        // two-body kinematics, mu taken as the CM scattering variable
        const cosC = 1 - 2 * mu, sinC = Math.sqrt(Math.max(0, 1 - cosC * cosC));
        const thL = Math.atan2(sinC, cosC + mr), phR = (Math.PI - Math.acos(cosC)) / 2;
        const Er = E * kin * mu, w = randPerp(d);
        const da = deflect(d, Math.cos(thL), w);
        const dr = deflect(d, Math.cos(phR), [-w[0], -w[1], -w[2]]);
        if (Er > 0.05) this.recoilTrack(x, y, z, dr, Er, t);
        E -= Er; d[0] = da[0]; d[1] = da[1]; d[2] = da[2];
      });
      if (B) rotZ(d, -2 * 3 * B / p * step);
    }
    if (this.tracer) this.tracer.end();
  }
  alphaLabeled(x, y, z, d, E, t, title, note) {
    this.beginLabel(TYPE.ALPHA, title, `${E.toFixed(2)} MeV · range ${alphaRange(E).toFixed(1)} cm in air · ${note}`, t);
    this.alphaTrack(x, y, z, d, E, t);
    this.endLabel();
  }
  // Recoiling nitrogen nucleus: short, very dense stub (range ~ 2 mm at 1 MeV, approximate)
  recoilTrack(x, y, z, d, E, t) {
    const R = 0.2 * Math.pow(E, 0.75), n = Math.max(1, Math.ceil(R / 0.01));
    if (this.tracer) this.tracer.begin(1000070140, E, x, y, z, d);
    for (let i = 0; i < n; i++) {
      const s = i * R / n;
      this.ionize(x + d[0] * s, y + d[1] * s, z + d[2] * s, d, R / n, E / R / W_ION, t, TYPE.ALPHA, 0.012);
    }
    if (this.tracer) this.tracer.end();
  }

  // ---- Event sources --------------------------------------------------------
  cosmicDir(power) {
    // flux through a horizontal plane ~ cos^power(theta) (muons: cos^2 intensity x cos projection)
    const u = Math.pow(rand(), 1 / (power + 1)), s = Math.sqrt(1 - u * u), ph = 2 * Math.PI * rand();
    return [s * Math.cos(ph), s * Math.sin(ph), -u];
  }
  cosmicMuon(t) {
    const dir = this.cosmicDir(3);
    const p = sampleMuonX() / -dir[2];
    const T = Math.sqrt(p * p + MMU * MMU) - MMU, q = rand() < 0.56 ? 1 : -1;
    const zen = Math.round(Math.acos(-dir[2]) * 180 / Math.PI);
    this.beginLabel(TYPE.MUON, `cosmic muon μ${q > 0 ? '⁺' : '⁻'}`, `p = ${fmtE(p)}/c · ${zen}° from vertical`, t);
    this.heavyTrack((2 * rand() - 1) * (HW + 4), (2 * rand() - 1) * (HH + 4), dir, MMU, q, T, TYPE.MUON, t);
    this.endLabel();
    this.counts[1]++;
  }
  cosmicProton(t) {
    const dir = this.cosmicDir(3);
    const Tk = 40 + 250 * -Math.log(1 - rand());
    this.beginLabel(TYPE.PROTON, 'cosmic proton', `T = ${fmtE(Tk)}`, t);
    this.heavyTrack((2 * rand() - 1) * HW, (2 * rand() - 1) * HH, dir, MP, 1, Tk, TYPE.PROTON, t);
    this.endLabel();
    this.counts[4]++;
  }
  shower(t) {
    const dir = this.cosmicDir(2);
    const cx = (2 * rand() - 1) * HW * 0.7, cy = (2 * rand() - 1) * HH * 0.7, n = 4 + Math.floor(rand() * 10);
    for (let i = 0; i < n; i++) {
      const p = 1000 * (0.2 - 1.5 * Math.log(1 - rand()));
      this.beginLabel(TYPE.MUON, 'air-shower muon', `one of ${n} parallel tracks · p = ${fmtE(p)}/c`, t);
      this.heavyTrack(cx + gauss() * 5, cy + gauss() * 5, dir, MMU, rand() < 0.5 ? 1 : -1, Math.sqrt(p * p + MMU * MMU) - MMU, TYPE.MUON, t);
      this.endLabel();
    }
    this.counts[1] += n;
  }
  backgroundElectron(t) {
    // Compton electrons from terrestrial gamma rays, born anywhere near the layer
    // Most gamma interactions happen in the solid floor plate, walls and lid (far more
    // mass than the gas): those electrons enter the layer from the floor, often at shallow
    // angles, and make the long straight-ish tracks that dominate real footage.
    const [Eg, src] = sampleGammaSrc(), T = comptonElectron(Eg), x = (2 * rand() - 1) * HW, y = (2 * rand() - 1) * HH;
    const floor = rand() < 0.6;
    this.beginLabel(TYPE.ELECTRON, 'Compton electron', `${fmtE(T)} · from ${src === 'scattered' ? 'scattered' : src} γ (${fmtE(Eg)})${floor ? ' · out of floor plate' : ''}`, t);
    if (floor) {
      const c = Math.sqrt(rand()), s = Math.sqrt(1 - c * c), ph = 2 * Math.PI * rand(); // cosine-law emission from the plate
      this.electronTrack(x, y, this.floorZ() + 0.01, [s * Math.cos(ph), s * Math.sin(ph), c], T, t, TYPE.ELECTRON);
    } else {
      this.electronTrack(x, y, (2 * rand() - 1) * this.p.layer * 0.9, isotropic(), T, t, TYPE.ELECTRON);
    }
    this.endLabel();
    this.counts[2]++;
  }
  radonAlpha(t) {
    const x = (2 * rand() - 1) * HW, y = (2 * rand() - 1) * HH, z = (2 * rand() - 1) * this.p.layer * 0.5;
    if (rand() < 0.2) {
      // Thoron (Rn-220, 6.29 MeV) -> Po-216 (6.78 MeV, T1/2 = 0.145 s): the classic "V" pair
      this.alphaLabeled(x, y, z, isotropic(), 6.29, t, 'α · thoron Rn-220', 'its daughter Po-216 decays ~0.2 s later (V pair)');
      const t2 = t - Math.log(1 - rand()) * 0.145 / Math.LN2;
      this.queue.push({ t: t2, fn: (te) => { this.alphaLabeled(x, y, z, isotropic(), 6.78, te, 'α · Po-216', `${((te - t) * 1000).toFixed(0)} ms after Rn-220, same origin`); this.counts[3]++; } });
    } else {
      const r = rand();
      const [E, nuc] = r < 0.5 ? [5.49, 'Rn-222'] : r < 0.75 ? [6.0, 'Po-218'] : [7.69, 'Po-214'];
      this.alphaLabeled(x, y, z, isotropic(), E, t, `α · ${nuc}`, 'radon decay chain in the air');
    }
    this.counts[3]++;
  }
  sourcePos(sx, sy) { return [sx, sy, this.floorZ() + this.p.layer * 0.35]; }
  alphaSource(t) {
    // Sealed Am-241 disc: 5.49 MeV degraded by the window foil
    const [x, y, z] = this.sourcePos(-9, 3);
    let d; do { d = isotropic(); } while (d[2] < -0.15);
    this.alphaLabeled(x, y, z, d, 4.8 + 0.15 * gauss(), t, 'α · Am-241 source', 'sealed disc, energy degraded by its foil');
    this.counts[3]++;
  }
  betaSource(t) {
    // Sr-90 (Q = 0.546 MeV, daughter Y Z=39) in equilibrium with Y-90 (Q = 2.28 MeV, daughter Zr Z=40)
    const [x, y, z] = this.sourcePos(9, -3);
    let d; do { d = isotropic(); } while (d[2] < -0.15);
    const y90 = rand() < 0.5, T = y90 ? betaSample(2.28, 40) : betaSample(0.546, 39);
    this.beginLabel(TYPE.ELECTRON, `β⁻ · ${y90 ? 'Y-90' : 'Sr-90'} source`, `${fmtE(T)} (endpoint ${y90 ? '2.28' : '0.55'} MeV)`, t);
    this.electronTrack(x, y, z, d, T, t, TYPE.ELECTRON);
    this.endLabel();
    this.counts[2]++;
  }

  // ---- historic experiments ------------------------------------------------------------
  // Tracks are generated in the plane of the sensitive layer (z ~ 0), as in the original
  // face-on photographs; the magnetic field is perpendicular to that plane.
  andersonEvent(t) {
    // 63 MeV positron through 6 mm of lead, emerging at ~23 MeV (Anderson, 2 Aug 1932)
    const a = 0.12 * gauss() + 0.4, d = normalize([Math.cos(a), Math.sin(a), 0.004 * gauss()]);
    this.exitWindow = [18, 28]; // events like the photographed one (23 MeV out); typical exit energy is ~9-14 MeV
    this.electronTrack(-7, 0.6 + 0.4 * gauss(), 0.3 * gauss(), d, 62.5 + 2 * gauss(), t, TYPE.POSITRON, 0, +1);
    this.exitWindow = null;
  }
  blackettEvent(t) {
    // a cosmic-ray electron/photon showers in the plate: e+ e- pairs fan out and bend both ways
    const y0 = 3 * gauss();
    const a0 = 0.15 * gauss(), dir0 = normalize([Math.cos(a0), Math.sin(a0), 0]);
    this.electronTrack(-11, y0 - Math.tan(a0) * 11, 0, dir0, 1500, t, TYPE.ELECTRON, 2, -1); // incoming cosmic-ray electron
    const n = 3 + poisson(5);
    for (let i = 0; i < n; i++) {
      const E = 3 * Math.pow(60, rand());           // ~1/E spectrum, 3-180 MeV
      const th = gauss() * (0.06 + 8 / E) + a0, q = i % 2 ? 1 : -1;
      const d = normalize([Math.cos(th), Math.sin(th), 0.01 * gauss()]);
      this.electronTrack(this.plate.x1 + 0.01, y0 + 0.2 * gauss(), 0.05 * gauss(), d, E, t, q > 0 ? TYPE.POSITRON : TYPE.ELECTRON, 2, q);
    }
  }
  rochesterEvent(t) {
    // penetrating shower in the lead; a neutral kaon flies a few cm unseen and decays: K0s -> pi+ pi-
    const y0 = 2 * gauss();
    for (let i = 0, n = 1 + poisson(1.5); i < n; i++) {
      const th = 0.18 * gauss(), d = normalize([Math.cos(th), Math.sin(th), 0.005 * gauss()]);
      this.heavyFrom(this.plate.x1 + 0.01, y0 + 0.5 * gauss(), 0.05 * gauss(), d, MPI, rand() < 0.5 ? 1 : -1, 300 + 1500 * rand(), TYPE.PION, t, 40, 211);
    }
    const pK = Math.max(250, 520 + 150 * gauss()), aK = 0.25 * gauss() + (rand() < 0.5 ? 0.3 : -0.3); // off the shower axis, as in the photo
    const EK = Math.hypot(pK, MK0), g = EK / MK0, b = pK / EK;
    const L = Math.min(15, 0.5 + (-Math.log(1 - rand())) * 2.684 * pK / MK0); // decay length: beta*gamma*c*tau, c*tau = 2.68 cm
    const dK = [Math.cos(aK), Math.sin(aK)], vx = this.plate.x1 + dK[0] * L, vy = y0 + dK[1] * L;
    const ps = Math.sqrt((MK0 / 2) ** 2 - MPI * MPI), Es = MK0 / 2, phi = 2 * Math.PI * rand();
    const cpar = Math.cos(phi), cperp = Math.sin(phi);           // decay in the layer plane
    for (const sgn of [1, -1]) {
      const ppar = g * (sgn * ps * cpar + b * Es), pperp = sgn * ps * cperp;
      const px = ppar * dK[0] - pperp * dK[1], py = ppar * dK[1] + pperp * dK[0], p = Math.hypot(px, py);
      this.heavyFrom(vx, vy, 0.04 * gauss(), [px / p, py / p, 0.002 * gauss()], MPI, sgn, Math.hypot(p, MPI) - MPI, TYPE.PION, t, 40, 211 * sgn);
    }
  }

  spawn(rate, t, dt, fn) {
    const n = poisson(rate * dt);
    for (let i = 0; i < n; i++) fn.call(this, t + rand() * dt);
  }

  step(t, dt) {
    const P = this.p, area = 4 * HW * HH;
    this.spawn(P.muonFlux * area / 60, t, dt, this.cosmicMuon); // ~1 muon / cm^2 / min at sea level
    this.spawn(P.protonRate, t, dt, this.cosmicProton);
    this.spawn(P.showerRate, t, dt, this.shower);
    this.spawn(P.electronRate, t, dt, this.backgroundElectron);
    this.spawn(P.radonRate, t, dt, this.radonAlpha);
    if (P.alphaSource) this.spawn(P.alphaSourceRate, t, dt, this.alphaSource);
    if (P.betaSource) this.spawn(P.betaSourceRate, t, dt, this.betaSource);

    if (this.scene) {
      const S = this.scene;
      if (this.sceneNext === undefined || this.sceneNext > t + 60) this.sceneNext = t + 0.3;
      while (this.sceneNext <= t + dt) { S.event.call(this, this.sceneNext); this.sceneNext += S.period * (0.9 + 0.2 * rand()); }
    }

    const end = t + dt;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      if (q.t <= end) { this.queue.splice(i, 1); q.fn(q.t); }
    }

    // Background "drizzle": droplets condensing above the layer and raining through it
    const nr = poisson(P.rain * dt), L = P.layer;
    for (let i = 0; i < nr; i++) {
      this.sink.push((2 * rand() - 1) * HW, (2 * rand() - 1) * HH, -0.3 * L + rand() * (0.8 * L + 3),
        t + rand() * dt, 0.8 + 0.5 * rand(), (rand() * 16777215) | 0, 0.4, TYPE.RAIN);
    }
  }
}

// exported for tests / diagnostics
// Historic experiments: geometry, field and the replayed event. Plate: x0..x1 (cm),
// lead X0 = 0.56 cm, minimum-ionising dE/dx = 12.7 MeV/cm. These were Wilson *expansion*
// chambers, sensitive through their whole depth at the moment of expansion: `layer` is set deep.
export const SCENES = {
  anderson: {
    title: 'Discovery of the positron', who: 'Carl D. Anderson · Caltech · 2 August 1932',
    text: 'A particle crosses a 6 mm lead plate in a magnetic field. It curves more tightly after the plate, so it lost energy there (63 → 23 MeV) and must be travelling from left to right. The direction it bends then says its charge is positive, yet the track is far too thin and light for a proton: the first antiparticle, the positron.',
    sim: 'simulated: B = 1.5 T, 6 mm Pb · events selected like the photo (23 ± 5 MeV after the plate; typical is ~9–14 MeV)', bField: 1.5, plate: { x0: 0, x1: 0.6, X0: 0.56, dedx: 12.7 }, radius: 8.5, period: 3.6, zoom: 1.9, event: ChamberPhysics.prototype.andersonEvent,
  },
  blackett: {
    title: 'Cosmic-ray showers and pair creation', who: 'P. M. S. Blackett & G. P. S. Occhialini · Cambridge · 1933',
    text: 'Geiger counters above and below the chamber triggered the photograph only when a cosmic ray passed. Bursts of tracks fan out from the lead and bend both ways in the magnetic field: electrons and positrons in about equal numbers, created together in pairs out of energy.',
    sim: 'simulated: B ≈ 0.3 T, 1 cm Pb', bField: 0.3, plate: { x0: -0.5, x1: 0.5, X0: 0.56, dedx: 12.7 }, radius: 14, period: 3.6, zoom: 1.2, event: ChamberPhysics.prototype.blackettEvent,
  },
  rochester: {
    title: 'The first “strange” particle', who: 'G. D. Rochester & C. C. Butler · Manchester · 1947',
    text: 'Below a lead plate, two tracks fork from a single point in the gas. Nothing visible arrives there: a neutral particle, made in a shower in the lead, flew a few centimetres unseen and decayed into two charged pions. It was the neutral kaon (K⁰ → π⁺π⁻), the first of the “strange” particles.',
    sim: 'simulated: B = 0.35 T, 3 cm Pb (illustrative values)', bField: 0.35, plate: { x0: -3, x1: 0, X0: 0.56, dedx: 12.7 }, radius: 14, period: 3.6, zoom: 1.3, event: ChamberPhysics.prototype.rochesterEvent,
  },
};

export const _internals = { eStop, eRange, alphaRange, alphaEnergy, CLUSTER_MEAN, sampleMuonX, comptonElectron, sampleGamma, betaSample, restrictedFrac };
