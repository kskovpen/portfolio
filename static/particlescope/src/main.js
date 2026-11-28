import { Renderer } from './renderer.js';
import { ChamberPhysics, SCENES } from './physics.js';
import { BubbleChamber, SCALE as BUBBLE_SCALE } from './bubble.js';
import { STORIES } from './stories.js';
import { SCHEMATICS } from './schematics.js';
import { DriftScene } from './drift.js';
import { SparkChamber } from './spark.js';
import { RutherfordScene } from './rutherford.js';
import { sound, click } from './sound.js';
import { SuperKScene } from './superk.js';
import { EmulsionScene } from './emulsion.js';
import { TimepixScene } from './timepix.js';
import { ScintScene } from './scint.js';
import { creditsHTML } from './credits.js';
import { guideHTML } from './guides.js';

const params = {
  muonFlux: 1.0, protonRate: 0.05, showerRate: 0.01, electronRate: 8, radonRate: 0.4,
  alphaSource: false, alphaSourceRate: 12, betaSource: false, betaSourceRate: 15,
  bField: 0, layer: 1.2, efficiency: 1.0, life: 2.2, diffusion: 0.0005, convection: 0.3, fall: 0.6, rain: 5000,
  tilt: 28, aperture: 1.0, exposure: 1.2, bloom: 0.2, speed: 1.0, colorize: false, geiger: false,
};

// Only the controls that change the picture most; the chamber and camera physics stay at their
// tuned (measured / realistic) defaults in `params`.
const SPEC = [
  ['muonFlux', 'Cosmic muons', 0, 5, 0.05, '× sea level'],
  ['electronRate', 'Background radiation (γ)', 0, 30, 0.5, '/s'],
  ['radonRate', 'Radon in the air (α)', 0, 5, 0.05, '/s'],
  ['alphaSource', 'Am-241 α source'],
  ['betaSource', 'Sr-90 β source'],
  ['bField', 'Magnetic field', 0, 1.5, 0.01, 'T'],
  ['speed', 'Slow motion', 0.05, 2, 0.05, '×'],
  ['geiger', 'Geiger counter'],
];

const canvas = document.getElementById('c');
let renderer;
try { renderer = new Renderer(canvas); }
catch (e) { document.getElementById('err').textContent = 'Could not start GPU renderer: ' + e.message; throw e; }
const physics = new ChamberPhysics(renderer, params);
const bubble = new BubbleChamber(renderer), spark = new SparkChamber(renderer);
const canvas2 = document.getElementById('c2'), drift = new DriftScene(canvas2), ruth = new RutherfordScene(canvas2);
let driftOn = false, ruthOn = false, skOn = false, emOn = false, tpOn = false, scOn = false;
const flatOn = () => driftOn || ruthOn || skOn || emOn || tpOn || scOn;
const superk = new SuperKScene(canvas2), emulsion = new EmulsionScene(canvas2), timepix = new TimepixScene(canvas2);
const pxbar = document.getElementById('pxbar');
pxbar.querySelectorAll('button').forEach((b) => b.onclick = () => {
  timepix.setSource(b.dataset.s, performance.now() / 1000);
  pxbar.querySelectorAll('button').forEach((o) => o.classList.toggle('on', o === b));
});
pxbar.querySelector('[data-s="am241"]').classList.add('on');
const scint = new ScintScene(canvas2), scbar = document.getElementById('scbar');
scbar.querySelectorAll('button').forEach((b) => b.onclick = () => {
  const group = b.dataset.s ? '[data-s]' : '[data-v]';
  scbar.querySelectorAll(group).forEach((o) => o.classList.toggle('on', o === b));
  if (b.dataset.s) scint.setSource(b.dataset.s, performance.now() / 1000);
  else scint.setSpeed(b.dataset.v === 'real' ? 'real' : +b.dataset.v);
});
const rfbar = document.getElementById('rfbar');
rfbar.querySelectorAll('button').forEach((b) => b.onclick = () => {
  const v = +b.dataset.s;
  ruth.speed = v; rfbar.querySelectorAll('button').forEach((o) => o.classList.toggle('on', o === b));
});
rfbar.querySelector('[data-s="1"]').classList.add('on');
if (new URLSearchParams(location.search).has('debug')) window.__chamber = { physics, renderer, params, bubble }; // debugging handle (?debug)
const cam = { yaw: 0, pitch: params.tilt * Math.PI / 180, zoom: 1 };

// ---- UI ---------------------------------------------------------------------
const mainPanel = document.getElementById('controls');
const inputs = {};
for (const s of SPEC) {
  const panel = mainPanel;
  const [key, label, min, max, step, unit] = s;
  const row = document.createElement('label');
  row.className = 'row';
  if (typeof params[key] === 'boolean') {
    row.innerHTML = `<input type="checkbox"><span>${label}</span>`;
    const inp = row.querySelector('input');
    inp.checked = params[key];
    inp.addEventListener('change', () => { params[key] = inp.checked; updateLegend(); document.getElementById('expose')?.classList.toggle('on', !!params.colorize); });
    inputs[key] = inp;
  } else {
    row.innerHTML = `<span class="lbl">${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><span class="val"></span>`;
    const inp = row.querySelector('input'), val = row.querySelector('.val');
    const show = () => { val.textContent = `${+(+params[key]).toFixed(3)} ${unit}`; };
    inp.value = params[key]; show();
    inp.addEventListener('input', () => {
      params[key] = parseFloat(inp.value); show();
      if (key === 'tilt') cam.pitch = params.tilt * Math.PI / 180;
    });
    inputs[key] = { inp, show };
  }
  panel.appendChild(row);
}
const legend = document.getElementById('legend');
function updateLegend() { legend.style.display = params.colorize && !(typeof tpOn !== 'undefined' && tpOn) ? 'block' : 'none'; }
updateLegend();

let paused = false;
const ui = document.getElementById('ui');
document.getElementById('toggle').onclick = () => ui.classList.toggle('hidden');
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
  if (e.key === ' ') { paused = !paused; e.preventDefault(); }
  else if (e.key === 'h' || e.key === 'H') ui.classList.toggle('hidden');
  else if (e.key === 'Escape') showHome();
  else if (e.key === 'c' || e.key === 'C' || e.key === 'e' || e.key === 'E') setColorize(!params.colorize);
  else if (e.key === 'f' || e.key === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); }
});

// orbit / zoom (mouse + touch through pointer events): one finger orbits, two fingers pinch-zoom
const pts = new Map();
let drag = null, pinch = null, zoomMin = 0.3;
const clampZoom = (z) => Math.min(4, Math.max(zoomMin, z));
canvas.addEventListener('pointerdown', (e) => {
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId);
  if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.zoom }; drag = null; }
  else drag = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId)) return;
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()]; cam.zoom = clampZoom(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(pinch.d, 1)); return; }
  if (!drag) return;
  cam.yaw -= (e.clientX - drag.x) * 0.004;
  cam.pitch = Math.min(1.1, Math.max(0, cam.pitch + (e.clientY - drag.y) * 0.004));
  drag = { x: e.clientX, y: e.clientY };
  params.tilt = Math.round(cam.pitch * 180 / Math.PI);
});
const release = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null; };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('wheel', (e) => { cam.zoom = clampZoom(cam.zoom * Math.exp(-e.deltaY * 0.001)); e.preventDefault(); }, { passive: false });
canvas.addEventListener('dblclick', () => { cam.yaw = 0; cam.zoom = homeZoom; });
let homeZoom = 1;

// ---- scale bar: real dimensions of what is simulated -----------------------------
const scaleBar = document.getElementById('scalebar'), scaleLbl = document.getElementById('scalelbl'), dims = document.getElementById('dims');
function updateScale() {
  const ppc = driftOn ? drift.pxPerCm || 0 : (renderer.pxPerCm || 0) / (renderer.bubble ? BUBBLE_SCALE : 1);
  if (!ppc) return;
  const cm = [0.5, 1, 2, 5, 10].find((v) => v * ppc >= 60) || 10;
  scaleBar.style.width = `${(cm * ppc).toFixed(1)}px`;
  scaleLbl.textContent = cm < 1 ? `${cm * 10} mm` : `${cm} cm`;
  const vw = canvas.clientWidth / ppc, vh = canvas.clientHeight / ppc / Math.cos(cam.pitch);
  dims.textContent = renderer.spark ? 'plates 60 × 40 cm · 20 gaps of 1.3 cm · neon/helium · ~10 kV pulse on coincidence · 0.45 s recharge'
    : driftOn ? 'ATLAS MDT-like: 2 × 3 layers of 3 cm tubes · Ar/CO₂ 93/7 at 3 bar · wire 50 µm at 3080 V'
    : renderer.bubble
    ? `view ≈ ${vw.toFixed(0)} × ${vh.toFixed(0)} cm · liquid hydrogen 200 × 70 × 50 cm · B = 1.5 T · bubbles ~0.3 mm`
    : `view ≈ ${vw.toFixed(0)} × ${vh.toFixed(0)} cm · chamber 40 × 30 cm · sensitive layer ${params.layer} cm · droplets ~10 µm`;
}

// ---- "Expose" button: colour every track by particle type (legend top-left) ---------
const exposeBtn = document.getElementById('expose');
function setColorize(on) {
  params.colorize = on;
  exposeBtn.classList.toggle('on', on);
  updateLegend();
}
exposeBtn.onclick = () => setColorize(!params.colorize);

// ---- historic experiments ----------------------------------------------------------
const caption = document.getElementById('caption');
const AMBIENT_KEYS = ['muonFlux', 'electronRate', 'radonRate', 'protonRate', 'showerRate', 'bField', 'alphaSource', 'betaSource', 'layer', 'life', 'aperture', 'exposure', 'bloom'];
let freeParams = null, captionTimer = 0;
function setParam(key, v) {
  params[key] = v;
  const i = inputs[key];
  if (!i) return;
  if (i.inp) { i.inp.value = v; i.show(); } else i.checked = v;
}
// The bubble chamber is a different detector: its events come from the Geant4 library, not ChamberPhysics.
const BUBBLE = {
  title: 'The bubble chamber', who: 'Liquid hydrogen · BNL 80-inch / CERN 2 m class · 1960s',
  text: 'A pulse of 5 GeV/c K⁻ mesons enters from the left. The superheated hydrogen boils along every charged track and a flash photographs the bubbles. Most kaons cross untouched; some hit a proton and make a star of new particles. Look for V’s from invisible neutral particles (Λ → pπ⁻, K⁰ → π⁺π⁻), slow protons as dense dark-white lines, and small spirals: electrons knocked out of atoms, curling in the 1.5 T field.',
  sim: 'simulated: Geant4 11.3 (FTFP_BERT) events in liquid hydrogen, 1.5 T, 10 beam tracks per picture (at least one interacting)',
  zoom: 0.72,
};
const SPARKC = {
  title: 'The spark chamber', who: 'Fukui & Miyamoto 1959 · science museums today',
  text: 'Each time a cosmic muon crosses both scintillator paddles, a high-voltage pulse hits the plates. Within half a microsecond every gap breaks down along the muon’s ionisation trail: a line of neon sparks, . This is exactly what you see in a museum chamber.',
  sim: 'simulated: sea-level muons (cos² law, ~1 per cm² per minute), paddle coincidence, 97% spark efficiency per gap, 0.45 s pulser recharge', zoom: 0.4,
};
const DRIFT = {
  title: 'Drift tubes', who: 'ATLAS muon spectrometer · CERN',
  text: 'A cosmic muon crosses two multilayers of drift tubes. Nothing here is visible in a real tube: this is what Garfield++ computes inside it. Green dots are ionisation electrons drifting to the wire (up to ~700 ns). Each one starts an avalanche within 0.1 mm of the wire (the tiny flash), and the ions it leaves induce the pulse on the right. The time the pulse crosses threshold gives the drift radius (blue circles); the track is the line tangent to them all (yellow).',
  sim: 'simulated: Garfield++ (Heed ionisation, Magboltz transport, analytic field, ATLAS front-end response)', zoom: 1,
};
const RUTH = {
  title: 'Gold foil: the nucleus', who: 'Geiger & Marsden · Rutherford · Manchester 1909–1913',
  text: 'Look into the microscope: each faint green flash is one alpha particle hitting the zinc-sulphide screen. Drag the microscope arm to other angles and watch the rate change: almost everything goes straight on, yet some alphas bounce back. Only a tiny, heavy, charged nucleus can do that.',
  sim: 'simulated: Geant4 single Coulomb scattering, 7.69 MeV α (RaC′) on 0.4 µm gold; source strength gives ~20 flashes per second at 15°', zoom: 1,
};
const SUPERK = {
  title: 'Super-Kamiokande', who: 'Kamioka mine, Japan · 1996 – today',
  text: 'An unrolled view of the 40 m water tank: top, wall, bottom. Each dot is a photomultiplier that saw Cherenkov light (colour: when; size: how much). A muon makes a sharp ring, an electron a fuzzy one (its shower scatters), a π⁰ two rings. This is how neutrinos were caught changing flavour.',
  sim: 'simulated: Geant4 charged tracks in water + Frank–Tamm light, 40% PMT coverage, attenuation 90 m (gives SK’s ~6 hits per MeV)', zoom: 1,
};
const EMUL = {
  title: 'Nuclear emulsion', who: 'Powell, Lattes & Occhialini · Bristol 1947',
  text: 'A photographic plate seen through a microscope: every charged particle left a row of black silver grains. A pion stops and decays into a muon, which always travels the same ~0.6 mm (it got a fixed energy from a two-body decay), and then into a faint electron. A π⁻ is instead swallowed by a nucleus, which explodes into a star.',
  sim: 'simulated: Geant4 in G4_PHOTO_EMULSION (3.8 g/cm³), grain density ∝ ionisation with saturation (27 grains/100 µm at minimum ionisation)', zoom: 1,
};
const TPX = {
  title: 'Timepix', who: 'Medipix collaboration · CERN · 2006',
  text: 'A camera chip for particles: 65,536 pixels, each measuring the energy that lands on it. Alphas make round blobs, electrons curly worms, muons and protons straight lines, gamma rays single dots. On the Space Station, heavy cosmic-ray nuclei leave thick bright tracks. Pick a source below.',
  sim: 'simulated: Geant4 deposits in 300 µm silicon; charge diffusion √(2kT/q·d·Δz/V) at 100 V, plasma spreading for dense tracks, 4 keV pixel threshold', zoom: 1,
};
const SCINT = {
  title: 'Scintillation crystal', who: 'Hofstadter 1948 · every nuclear-physics lab today',
  text: 'A gamma ray (invisible, dashed) enters a sodium-iodide crystal. Wherever it scatters or is absorbed, the crystal flashes with light, and the photomultiplier turns the flash into a pulse proportional to the energy. Thousands of pulses make the spectrum: the photopeak (all energy absorbed), the Compton edge (part escaped), and a backscatter bump from gammas bouncing off the lead.',
  sim: 'simulated: Geant4, 3″×3″ NaI(Tl) 10 cm from the source inside a lead shield; NaI resolution 7% FWHM at 662 keV, 230 ns light decay', zoom: 1,
};
function setScene(name) {
  driftOn = name === 'drift'; ruthOn = name === 'rutherford'; skOn = name === 'superk'; emOn = name === 'emulsion'; tpOn = name === 'timepix'; scOn = name === 'scint';
  scbar.style.display = scOn ? 'inline-flex' : 'none';
  if (scOn) scint.load().then(() => scint.start(performance.now() / 1000));
  const flat = flatOn();
  pxbar.style.display = tpOn ? 'inline-flex' : 'none'; updateLegend();
  if (tpOn) timepix.load().then(() => timepix.start(performance.now() / 1000));
  if (emOn) emulsion.load().then(() => emulsion.start(performance.now() / 1000));
  if (skOn) superk.load().then(() => superk.start(performance.now() / 1000));
  canvas.style.display = flat ? 'none' : 'block'; canvas2.style.display = flat ? 'block' : 'none';
  canvas2.style.touchAction = 'none';
  rfbar.style.display = ruthOn ? 'inline-flex' : 'none'; exposeBtn.style.display = flat && !tpOn ? 'none' : '';
  document.getElementById('scale').style.display = ruthOn || skOn || emOn || tpOn || scOn ? 'none' : '';
  if (ruthOn) ruth.load().then(() => ruth.reset());
  if (driftOn) drift.load().then(() => drift.start(performance.now() / 1000));
  const isBubble = name === 'bubble', isSpark = name === 'spark';
  const S = isBubble || isSpark || flat ? null : SCENES[name], C = S || (isBubble ? BUBBLE : isSpark ? SPARKC : driftOn ? DRIFT : ruthOn ? RUTH : skOn ? SUPERK : emOn ? EMUL : tpOn ? TPX : scOn ? SCINT : null);
  if (C && !freeParams) freeParams = Object.fromEntries(AMBIENT_KEYS.map((k) => [k, params[k]]));
  if (!C && freeParams) { for (const k of AMBIENT_KEYS) setParam(k, freeParams[k]); freeParams = null; }
  if (S) {
    // Counter-triggered Wilson expansion chamber: it is sensitive only for ~0.1 s after each expansion,
    // so a photograph holds the triggering event and very little background (unlike a diffusion chamber).
    setParam('muonFlux', 0.1); setParam('electronRate', 0.6); setParam('radonRate', 0.03);
    setParam('protonRate', 0); setParam('showerRate', 0); setParam('alphaSource', false); setParam('betaSource', false);
    setParam('bField', S.bField);
    setParam('layer', 8); // expansion chamber: the whole depth is sensitive at the moment of expansion
    setParam('life', 3.6);      // each "expansion" stays on screen until the next one
    setParam('aperture', 0.25); // stopped-down stereo cameras: the whole depth in focus
    setParam('exposure', 2.0);  // bright flash lamps
    ui.classList.add('hidden');  // the scene sets everything; the panel would only cover it
  }
  if (isBubble) {
    setParam('life', 3.6); setParam('aperture', 0.15); setParam('exposure', 1.6); setParam('bField', 1.5);
    ui.classList.add('hidden');
    bubble.load().then(() => bubble.reset(simTime));
  }
  if (isSpark) {
    setParam('life', 0.55); setParam('aperture', 0.3); setParam('exposure', 1.5); setParam('bloom', 0.9); setParam('bField', 0);
    ui.classList.add('hidden'); spark.reset(simTime);
  }
  renderer.bubble = isBubble; renderer.spark = isSpark;
  physics.scene = S || null; physics.plate = S ? S.plate : null; physics.sceneNext = undefined;
  renderer.clear(); physics.queue = []; // a clean chamber: nothing carries over from the previous experiment
  if (!C) { renderer.mark(simTime - 3); physics.step(simTime - 3, 3); } // the free chamber is already "alive"
  if (isSpark) renderer.setBoxes(spark.boxes()); else renderer.setPlate(physics.plate, physics.floorZ());
  // spark chamber: photographed from afar with a long lens, so sparks at every depth line up with their gaps
  cam.fov = isSpark ? 2 : 35;
  cam.yaw = 0; cam.zoom = homeZoom = C ? C.zoom : 1; cam.pitch = C ? 0 : 28 * Math.PI / 180;
  setParam('tilt', Math.round(cam.pitch * 180 / Math.PI));
  if (C) {
    caption.innerHTML = `<button class="x" title="Hide">×</button><div class="who">${C.who}</div><b>${C.title}</b><p>${C.text}</p><div class="sim">${C.sim}</div>`;
    caption.querySelector('.x').onclick = (e) => { e.stopPropagation(); caption.classList.remove('show'); };
    caption.onclick = () => caption.classList.toggle('mini');
    caption.classList.add('show'); caption.classList.remove('mini');
    clearTimeout(captionTimer); captionTimer = setTimeout(() => caption.classList.add('mini'), 9000); // shrink to its title
  } else caption.classList.remove('show');
}
// ---- main menu: one card per experiment ----------------------------------------------
// Line sketches of what each experiment shows (not renders): dotted = droplet track, grey bar = lead plate.
const trk = (d, w = 1.4, o = 0.9) => `<path d="${d}" fill="none" stroke="#e8eef5" stroke-width="${w}" stroke-dasharray="0.6 1.6" stroke-linecap="round" opacity="${o}"/>`;
const pb = (x, w) => `<rect x="${x}" y="0" width="${w}" height="90" fill="#3a3f46"/>`;
const SKETCH = {
  '': trk('M20 20 L34 30') + trk('M110 12 L118 26') + trk('M60 60 L76 66') + trk('M128 58 q6 -4 4 -9 q-3 -4 2 -8 q5 -3 3 -8', 1.2) +
      trk('M40 75 L58 70', 3.2, 1) + trk('M95 40 L100 56', 3.2, 1) + trk('M70 15 q10 8 22 10', 1) + trk('M140 80 L152 84'),
  anderson: pb(78, 4) + trk('M8 70 Q45 46 78 41') + trk('M82 40 Q104 34 118 18'),
  blackett: pb(72, 6) + trk('M6 48 L72 46', 1.6) + [-16, -9, -4, 3, 8, 14, 21].map((k, i) => trk(`M78 46 Q110 ${46 + k * 1.2} 150 ${46 + k * 2.4 + (i % 2 ? 8 : -8)}`)).join(''),
  rochester: pb(30, 14) + trk('M44 40 L150 34') + trk('M44 52 L150 60') + trk('M44 46 L150 46', 1.2, 0.6) + trk('M96 64 Q120 50 150 42') + trk('M96 64 Q122 78 150 84'),
  rutherford: '<rect x="10" y="38" width="16" height="14" fill="#3a3f46"/><path d="M26 45 H78" stroke="#ffb066" stroke-dasharray="2 3"/><rect x="78" y="25" width="3" height="40" fill="#ffd34d"/>' +
    '<path d="M80 45 L150 40 M80 45 L150 56 M80 45 L140 18 M80 45 L28 12" stroke="#ffb066" stroke-width="0.8" stroke-dasharray="2 3" opacity="0.8"/><circle cx="30" cy="12" r="4" fill="#bfffc8" opacity="0.9"/>',
  spark: Array.from({ length: 9 }, (_, i) => `<rect x="14" y="${8 + i * 9.4}" width="132" height="1.6" fill="#59626e"/>`).join('') +
    Array.from({ length: 8 }, (_, i) => `<path d="M${52 + i * 7.2} ${10 + i * 9.4} l1 3 l-1.5 3 l1 2" stroke="#ff7a3d" stroke-width="2.2" fill="none" stroke-linecap="round"/>`).join(''),
  emulsion: '<rect x="0" y="0" width="160" height="90" fill="#e2dbc6"/>' + '<path d="M10 70 C 40 66, 60 60, 78 52" stroke="#1c160e" stroke-width="2.4" fill="none"/><path d="M78 52 C 92 38, 104 30, 122 22" stroke="#1c160e" stroke-width="1.8" fill="none"/>' +
    Array.from({ length: 12 }, (_, i) => `<circle cx="${122 + i * 3}" cy="${22 - i * 1.3 + (i % 2)}" r="0.9" fill="#1c160e"/>`).join(''),
  timepix: '<rect x="35" y="2" width="90" height="86" fill="#06080c" stroke="#2a323b"/>' +
    '<rect x="50" y="20" width="8" height="8" fill="#e63c28"/><rect x="47" y="23" width="14" height="3" fill="#ffd228"/><path d="M70 70 l40 -14" stroke="#28a0e6" stroke-width="2.4"/>' +
    '<path d="M80 30 q6 4 3 9 q-3 5 3 8 q5 3 2 8" stroke="#3c8ce6" stroke-width="2.2" fill="none"/><rect x="104" y="20" width="3" height="3" fill="#2878e6"/><rect x="58" y="60" width="3" height="3" fill="#2878e6"/>',
  scint: '<rect x="20" y="25" width="40" height="40" fill="rgba(90,110,220,0.4)" stroke="#9aa6b2"/><rect x="60" y="30" width="22" height="30" fill="#3a4250"/>' +
    '<circle cx="34" cy="40" r="5" fill="rgba(210,200,255,0.9)"/>' + '<path d="M96 80 L100 80 L104 74 L108 70 L112 66 L116 62 L120 64 L124 60 L127 50 L129 80 L136 80 L138 18 L141 80 L150 80" stroke="#7fb8ff" fill="none" stroke-width="1.6"/>',
  superk: '<rect x="20" y="22" width="120" height="46" fill="none" stroke="#2a323b"/>' +
    Array.from({ length: 40 }, (_, i) => { const a = i / 40 * 2 * Math.PI; return `<circle cx="${62 + 15 * Math.cos(a)}" cy="${45 + 15 * Math.sin(a)}" r="1.7" fill="hsl(${200 - 40 * Math.sin(a)},95%,60%)"/>`; }).join('') +
    Array.from({ length: 34 }, (_, i) => { const a = i / 34 * 2 * Math.PI, r = 11 + 3 * Math.sin(i * 7.3); return `<circle cx="${108 + r * Math.cos(a)}" cy="${48 + r * Math.sin(a)}" r="1.5" fill="hsl(${60 + 30 * Math.cos(i)},95%,60%)" opacity="0.8"/>`; }).join(''),
  drift: [0, 1].map((r) => [0, 1, 2, 3, 4].map((c) => `<circle cx="${22 + c * 29 + r * 14.5}" cy="${30 + r * 25}" r="12" fill="none" stroke="#59626e" stroke-width="1.2"/><circle cx="${22 + c * 29 + r * 14.5}" cy="${30 + r * 25}" r="1" fill="#9aa6b2"/>`).join('')).join('') +
    '<circle cx="80" cy="30" r="5" fill="none" stroke="#8fc8ff" stroke-width="1"/><circle cx="94.5" cy="55" r="7" fill="none" stroke="#8fc8ff" stroke-width="1"/><circle cx="51" cy="30" r="9" fill="none" stroke="#8fc8ff" stroke-width="1"/>' +
    '<path d="M62 4 L104 86" stroke="#ffd34d" stroke-width="1.2"/>',
  bubble: trk('M20 46 L80 46') + trk('M80 46 q18 -4 26 6 q8 12 -4 18 q-12 4 -14 -8 q0 -8 8 -8', 1.2) + trk('M80 46 L150 30') + trk('M80 46 L150 60'),
};
const CARDS = [
  { key: 'rutherford', y: '1909 · Geiger, Marsden & Rutherford', t: 'Gold foil: the nucleus', d: 'Watch alpha flashes through a microscope and discover the atomic nucleus yourself.' },
  { key: '', y: '1936 · diffusion cloud chamber · Langsdorf', t: 'Cloud chamber', d: 'Cosmic muons, radioactivity and background radiation, live. Tune the sources and the field.' },
  { key: 'anderson', y: '1932 · Anderson', t: 'The positron', d: 'A track bends the “wrong” way through a lead plate: the first antimatter.' },
  { key: 'blackett', y: '1933 · Blackett & Occhialini', t: 'Showers & pair creation', d: 'Electrons and positrons burst from lead and curl both ways.' },
  { key: 'emulsion', y: '1947 · Powell, Lattes & Occhialini', t: 'Nuclear emulsion', d: 'A pion stops, a muon runs 0.6 mm, an electron flies off: the pion discovered.' },
  { key: 'rochester', y: '1947 · Rochester & Butler', t: 'The strange “V”', d: 'An invisible particle decays into two tracks: the first kaon.' },
  { key: 'spark', y: '1959 · spark chamber · Fukui & Miyamoto', t: 'Spark chamber', d: 'Cosmic muons light up a line of crackling neon sparks: the museum classic.' },
  { key: 'superk', y: '1983 · water Cherenkov · Kamiokande', t: 'Super-Kamiokande', d: 'Rings of light on 11,000 photomultipliers: how neutrinos were caught changing.' },
  { key: 'timepix', y: '2006 · hybrid pixel chip · Medipix collaboration', t: 'Timepix', d: 'A camera for particles: blobs, worms and lines, from your lab to the Space Station.' },
  { key: 'drift', y: '1968 · wire chambers · Charpak', t: 'Drift tubes', d: 'Inside the ATLAS muon chambers: electrons drift, avalanche and become a signal.' },
  { key: 'scint', y: '1948 · NaI(Tl) crystal · Hofstadter', t: 'Scintillation crystal', d: 'Gamma rays flash in a crystal: build the energy spectrum, peak by peak.' },
  { key: 'bubble', y: '1952 · bubble chamber · Glaser', t: 'Bubble chamber', d: 'A kaon beam in liquid hydrogen: stars, V’s and spirals of the particle zoo.' },
];
const home = document.getElementById('home'), cards = document.getElementById('cards');
CARDS.sort((a, b) => parseInt(a.y) - parseInt(b.y)); // a timeline of particle detection
for (const c of CARDS) {
  const el = document.createElement('button');
  el.className = 'card' + (c.soon ? ' soon' : '');
  el.innerHTML = `<svg viewBox="0 0 160 90">${SKETCH[c.key]}</svg><div class="t"><div class="y">${c.y}</div><b>${c.t}</b><span class="d">${c.d}</span></div>`;
  if (!c.soon) el.onclick = () => showStory(c.key);
  cards.appendChild(el);
}
// ---- history page shown before each simulation ------------------------------------------
const story = document.getElementById('story'), storyIn = story.querySelector('.in');
function startExperiment(key) {
  story.classList.add('hidden'); home.classList.add('hidden');
  setScene(key);
  if (!key) ui.classList.remove('hidden');
}
function showStory(key) {
  const S = STORIES[key];
  if (!S) return startExperiment(key);
  storyIn.innerHTML = `<div class="y">${S.year}</div><h2>${S.title}</h2><div class="who">${S.who}</div>
    <div class="figs">${S.img ? `<figure><img src="assets/history/${S.img}" alt="" class="${key === 'drift' || key === 'superk' ? 'color' : ''} ${S.fit === 'contain' ? 'drawing' : ''}"><figcaption>${S.credit}${S.src ? ` <a href="${S.src}" target="_blank" rel="noopener">Source</a>` : ''}</figcaption></figure>` : ''}
      <figure class="sch">${SCHEMATICS[key]}<figcaption>How it works (schematic)</figcaption></figure></div>
    ${S.body.map((p) => `<p>${p}</p>`).join('')}
    <div class="go"><button class="start">Start simulation ▸</button><button class="teach">For teachers</button><button class="back">Back</button></div>`;
  storyIn.querySelector('.start').onclick = () => startExperiment(key);
  storyIn.querySelector('.back').onclick = () => story.classList.add('hidden');
  storyIn.querySelector('.teach').onclick = () => {
    storyIn.innerHTML = guideHTML(key, S.title);
    storyIn.querySelector('.start').onclick = () => startExperiment(key);
    storyIn.querySelector('.back').onclick = () => showStory(key);
    story.scrollTop = 0;
  };
  story.scrollTop = 0;
  story.classList.remove('hidden');
}
// ---- about & credits ----------------------------------------------------------------
document.getElementById('credits-btn').onclick = () => {
  storyIn.innerHTML = creditsHTML();
  storyIn.querySelector('.back').onclick = () => story.classList.add('hidden');
  story.scrollTop = 0; story.classList.remove('hidden');
};
// ---- splash ----------------------------------------------------------------------------
const splash = document.getElementById('splash');
const hideSplash = () => splash.classList.add('gone');
splash.onclick = hideSplash;
setTimeout(hideSplash, 2400);

function showHome() { setScene(''); /* the menu's backdrop is the quiet free chamber: no sparks, no sound */ story.classList.add('hidden'); home.classList.remove('hidden'); ui.classList.add('hidden'); caption.classList.remove('show'); }
document.getElementById('home-btn').onclick = showHome;
ui.classList.add('hidden'); // the menu comes first

// ---- sound: on by default, the speaker button mutes -----------------------------------------------------------
const sndBtn = document.getElementById('snd');
sndBtn.onclick = () => { sound.on = !sound.on; sndBtn.textContent = sound.on ? '🔊' : '🔇'; sndBtn.title = sound.on ? 'Mute detector sounds' : 'Unmute detector sounds'; };

// ---- Geiger-Mueller counter next to the chamber -----------------------------------------
// A thin-walled GM tube: cosmic muons and Compton electrons from the room's gamma rays give the
// usual ~25 counts/min; betas from the Sr-90 source get through the wall; alphas do not
// (Am-241 adds only its weak 59.5 keV gamma line).
const geiger = { hist: [] };
function geigerRate() {
  if (!params.geiger || driftOn || ruthOn || renderer.bubble || renderer.spark || physics.scene) return 0;
  return (12 + 1.2 * params.electronRate + 4 * params.muonFlux + (params.betaSource ? 90 * params.betaSourceRate : 0) + (params.alphaSource ? 6 : 0)) / 60;
}
function geigerStep(dt) {
  const lam = geigerRate() * dt;
  if (!lam) return;
  let k = 0; for (let L = Math.exp(-lam), p = Math.random(); p > L; p *= Math.random()) k++;
  for (let i = 0; i < Math.min(k, 6); i++) click(i * 0.004 + Math.random() * dt);
  geiger.hist.push([performance.now(), k]);
}
function geigerCpm() {
  const now = performance.now();
  geiger.hist = geiger.hist.filter(([t]) => now - t < 20000);
  return geiger.hist.reduce((a, [, k]) => a + k, 0) * 3;
}

// ---- adaptive quality: if the frame rate stays low, render at a lower resolution ----------
let slow = 0, fast = 0;
function adapt(fps) {
  if (fps < 40) { fast = 0; if (++slow >= 4 && renderer.quality > 0.5) { renderer.quality = Math.max(0.5, renderer.quality - 0.25); slow = 0; } }
  else if (fps > 57) { slow = 0; if (++fast >= 20 && renderer.quality < 1) { renderer.quality = Math.min(1, renderer.quality + 0.25); fast = 0; } }
  else { slow = 0; fast = 0; }
}

// ---- main loop ----------------------------------------------------------------
const stats = document.getElementById('stats');
let simTime = 3, last = performance.now(), fpsAcc = 0, fpsN = 0, statT = 0;
renderer.mark(0);
physics.step(0, 3); // pre-fill so the chamber is already "alive"

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!paused) {
    const sdt = dt * params.speed;
    renderer.mark(simTime);
    if (flatOn()) { /* drawn on the flat canvas */ } else if (renderer.spark) spark.step(simTime, sdt); else if (renderer.bubble) bubble.step(simTime, sdt); else physics.step(simTime, sdt);
    simTime += sdt;
  }
  if (!paused) geigerStep(dt);
  if (scOn) scint.draw(now / 1000); else if (tpOn) timepix.draw(now / 1000, params.colorize); else if (emOn) emulsion.draw(now / 1000); else if (skOn) superk.draw(now / 1000); else if (ruthOn) ruth.draw(now / 1000); else if (driftOn) { if (!paused) drift.draw(now / 1000); } else renderer.render(simTime, params, cam);
  fpsAcc += dt; fpsN++; statT += dt;
  if (statT > 0.5) {
    updateScale();
    // rates, not ever-growing tallies: the Geiger counter shows counts per minute
    stats.textContent = `${Math.round(fpsN / fpsAcc)} fps${params.geiger && geigerRate() ? ` · Geiger ${geigerCpm()} counts/min` : ''}${paused ? ' · PAUSED' : ''}`;
    adapt(fpsN / fpsAcc);
    fpsAcc = 0; fpsN = 0; statT = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
