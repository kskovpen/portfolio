// Liquid-hydrogen bubble chamber, replayed from a Geant4 event library (bubble/g4/g4bubble.cc).
//
// Each beam pulse the chamber is expanded, ~10 beam particles cross it and the flash fires a
// few ms later: every bubble in a photograph has the same age, so all tracks appear at once.
// Bubble density along a track follows the ionisation, ~1/beta^2 (Glaser; Fabian et al.),
// with ~9 bubbles/cm for a minimum-ionising track in hydrogen, as in the BNL/CERN chambers.
//
// World units: the 200 x 70 cm chamber is drawn at 1/SCALE so it fits the same camera as the
// 40 x 30 cm cloud chamber; the scale bar divides this back out, so displayed sizes are true.
import { TYPE } from './physics.js';

export const SCALE = 5;
const MIP_PER_CM = 9;          // bubbles per cm at minimum ionisation
const MAX_DENSITY = 8;         // saturation: very slow protons are solid black lines in real photos
const BEAM_PER_PULSE = 10;
const MASS = { 11: 0.511, 13: 105.66, 211: 139.57, 321: 493.68, 2212: 938.27, 3112: 1197.4, 3222: 1189.4, 3312: 1321.7, 3334: 1672.5, 1000010020: 1875.6 };

function rand() { return Math.random(); }

function typeOf(pdg, proc, parent) {
  const a = Math.abs(pdg);
  if (a === 11) return pdg < 0 ? TYPE.POSITRON : (parent >= 0 && proc === 3 ? TYPE.DELTA : TYPE.ELECTRON);
  if (a === 13) return TYPE.MUON;
  if (a === 211) return TYPE.PION;
  if (a === 321) return TYPE.KAON;
  return TYPE.PROTON; // protons, charged hyperons, deuterons
}

export class BubbleChamber {
  constructor(renderer) {
    this.r = renderer;
    this.events = null; this.interacting = [];
    this.next = 0; this.period = 3.6;
    this.counts = { beam: 0, interactions: 0 };
  }
  async load(url = 'assets/bubble-k5.json') {
    if (this.events) return;
    const lib = await (await fetch(url)).json();
    this.events = lib.events;
    this.meta = lib;
    // an event "interacts" if the beam particle (track 0) has hadronic daughters
    this.interacting = this.events.map((ev, i) => ev.some((t) => t[1] === 0 && t[2] === 3 && Math.abs(t[0]) !== 11) ? i : -1).filter((i) => i >= 0);
  }
  reset(t) { this.next = t + 0.3; }

  // one photograph: ~10 beam tracks, at least one of which interacts
  pulse(t) {
    if (!this.events) return;
    const ids = [this.interacting[(rand() * this.interacting.length) | 0]];
    for (let i = 1; i < BEAM_PER_PULSE; i++) ids.push((rand() * this.events.length) | 0);
    this.counts.beam += ids.length;
    for (const id of ids) {
      if (this.interacting.includes(id)) this.counts.interactions++;
      for (const trk of this.events[id]) this.track(trk, t);
    }
    this.fiducials(t);
  }

  track([pdg, parent, proc, pts], t) {
    const m = MASS[Math.abs(pdg)] || 938.27, type = typeOf(pdg, proc, parent);
    for (let i = 0; i + 7 < pts.length; i += 4) {
      const x0 = pts[i], y0 = pts[i + 1], z0 = pts[i + 2], e0 = pts[i + 3];
      const dx = pts[i + 4] - x0, dy = pts[i + 5] - y0, dz = pts[i + 6] - z0, L = Math.hypot(dx, dy, dz);
      if (L <= 0) continue;
      const ek = Math.max(0.5 * (e0 + pts[i + 7]), 1e-3), g = 1 + ek / m, b2 = 1 - 1 / (g * g);
      const dens = MIP_PER_CM * Math.min(MAX_DENSITY, 1 / Math.max(b2, 1e-3));
      for (let n = poisson(dens * L); n > 0; n--) {
        const f = rand();
        this.r.push((x0 + f * dx) / SCALE, (y0 + f * dy) / SCALE, (z0 + f * dz) / SCALE, t + 0.004 * rand(),
          0.9 + 0.2 * rand(), (rand() * 16777215) | 0, 0.22, type);
      }
    }
  }

  // engraved crosses on the chamber window, lit by the same flash
  fiducials(t) {
    for (let gx = -80; gx <= 80; gx += 40) for (let gy = -24; gy <= 24; gy += 24) {
      for (let k = -1.2; k <= 1.2; k += 0.08) {
        this.r.push((gx + k) / SCALE, gy / SCALE, 25.5 / SCALE, t, 1, (rand() * 16777215) | 0, 0.35, TYPE.RAIN);
        this.r.push(gx / SCALE, (gy + k) / SCALE, 25.5 / SCALE, t, 1, (rand() * 16777215) | 0, 0.35, TYPE.RAIN);
      }
    }
  }

  step(t, dt) {
    while (this.next <= t + dt) { this.pulse(this.next); this.next += this.period; }
  }
}

function poisson(mu) {
  if (mu > 30) return Math.max(0, Math.round(mu + Math.sqrt(mu) * Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())));
  let L = Math.exp(-mu), k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}
