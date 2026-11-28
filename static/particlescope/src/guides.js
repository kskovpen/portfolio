// Classroom guides: one screen per experiment for teachers. look / activity / questions / level.
export const GUIDES = {
  rutherford: {
    level: 'Ages 14–18 · atomic structure',
    look: ['Many flashes at small angles, almost none behind the foil.', 'The plot: the measured rate follows the “nucleus” curve, not the plum-pudding one.'],
    activity: 'Note the flash rate at 15°, 30°, 60° and 120° (use ×100 or ×1000 at large angles). By how much does it fall from 15° to 150°? Compare with the two predictions on the plot.',
    questions: ['Why could a plum-pudding atom never send an alpha straight back?', 'What does the rarity of back-scattering say about the size of the nucleus?', 'Why did the foil have to be so thin?'],
  },
  anderson: {
    level: 'Ages 16–18 · charged particles in magnetic fields',
    look: ['The track bends more tightly on one side of the lead plate.', 'The track is thin, like a light particle’s.'],
    activity: 'Decide which side the particle came from (it loses energy in the lead, so it curves more tightly afterwards). Then use the bending direction to find the sign of its charge.',
    questions: ['Why can it not be a proton? (A proton bending this much would stop within millimetres.)', 'What is antimatter?', 'What happens when a positron meets an electron?'],
  },
  blackett: {
    level: 'Ages 16–18 · E = mc², pair production',
    look: ['A burst of tracks leaving the lead plate.', 'Tracks bending both ways in the magnetic field.'],
    activity: 'Over several events, count tracks bending left and right. What does the roughly equal split tell you?',
    questions: ['Where does the new matter come from? (Each pair needs at least 2 × 0.511 MeV.)', 'Why does the shower start in the lead and not in the gas?', 'Why let Geiger counters trigger the camera?'],
  },
  '': {
    level: 'Ages 14–18 · radioactivity, cosmic rays',
    look: ['Thin straight dashes: muons from cosmic rays.', 'Short thick tracks: alphas from radon in the air.', 'Thin wiggly tracks: electrons.'],
    activity: 'Count muon tracks for one minute. The view is about 30 × 20 cm. Estimate how many muons pass through your hand each minute (about 1 per cm² per minute at sea level). Then switch on the magnetic field: which tracks bend, and which way?',
    questions: ['Why are alpha tracks short and thick?', 'Muons should decay long before reaching the ground. Why do we see them? (Time dilation.)', 'Why does the Sr-90 source make so many more tracks?'],
  },
  emulsion: {
    level: 'Ages 16–18 · particle decays, conservation laws',
    look: ['A thick black pion track that stops.', 'A muon track of always the same length.', 'A faint, dotted electron trail.'],
    activity: 'Use the 100 µm scale bar to measure several muon tracks. Why is the length always about 0.6 mm?',
    questions: ['Why does a fixed muon range mean the pion decayed into just two particles?', 'Why is the pion track blackest near its end?', 'Why is the positron trail so faint?'],
  },
  rochester: {
    level: 'Ages 16–18 · neutral particles, lifetimes',
    look: ['A “V”: two tracks starting from one point in empty gas.', 'No track leads to that point.'],
    activity: 'Find the apex of the V and estimate its distance from the lead plate with the scale bar.',
    questions: ['How do we know a neutral particle was there?', 'What does the gap tell us about how long it lived?', 'Why was this particle called “strange”?'],
  },
  scint: {
    level: 'Ages 16–18 / first-year university · gamma spectroscopy',
    look: ['The photopeak: the whole gamma absorbed.', 'The Compton edge, the backscatter bump and the X-ray peak.', 'The light photons bouncing to the photomultiplier.'],
    activity: 'Read off the photopeak energies for Cs-137 and Co-60. Check the Compton edge with E·2E/(mc² + 2E), with mc² = 511 keV (expect 477 keV for 662 keV). Estimate the resolution as peak width ÷ peak energy.',
    questions: ['Why do many gammas leave only part of their energy?', 'Where does the backscatter bump come from?', 'Why does Co-60 show a peak at 2505 keV?'],
  },
  bubble: {
    level: 'Ages 16–18 · interactions, momentum, decays',
    look: ['Parallel beam tracks.', 'Stars where a beam particle hits a proton.', 'V’s from neutral particles, and small electron spirals.'],
    activity: 'In several pictures, find the stars and the V’s. Find a spiral: why does its radius shrink?',
    questions: ['Why do the electrons spiral inwards?', 'Why use liquid hydrogen?', 'How can curvature give a particle’s momentum?'],
  },
  spark: {
    level: 'Ages 14–18 · cosmic rays, detectors',
    look: ['One spark per gap along a straight line.', 'Now and then a gap without a spark.'],
    activity: 'Estimate the angle from vertical of several tracks. Are most of them nearly vertical? Why?',
    questions: ['Why are the sparks perpendicular to the plates?', 'About 40 muons per second cross the chamber, but it fires about twice a second. Why?', 'Why use two scintillators, above and below?'],
  },
  drift: {
    level: 'Ages 16–18 / university · electric fields, timing',
    look: ['Electrons drifting to the wire.', 'Drift circles appearing.', 'The fitted line tangent to all the circles.'],
    activity: 'Compare a drift-circle radius with the track’s distance from that wire. With the maximum drift time of about 700 ns for 1.46 cm, estimate a radius from a pulse time.',
    questions: ['Why does the first electron to arrive give the closest distance?', 'Why is the avalanche only near the wire?', 'How can the track be located to about 0.1 mm?'],
  },
  superk: {
    level: 'Ages 16–18 · light, relativity, neutrinos',
    look: ['Sharp rings (muons) and fuzzy rings (electrons).', 'Two rings from a π⁰.', 'A filled disc from a muon crossing the tank.'],
    activity: 'Classify the events as muon-like or electron-like from the ring edges. Compute the Cherenkov angle from cos θ = 1/n with n = 1.33 (about 41°).',
    questions: ['How can a particle go faster than light?', 'Why are electron rings fuzzy?', 'Why build the detector 1 km underground?'],
  },
  timepix: {
    level: 'Ages 14–18 · types of radiation',
    look: ['Round blobs (alphas), curly worms (electrons), straight lines (muons, protons), dots (gammas).'],
    activity: 'Switch between sources and identify each one from its cluster shapes alone. Then compare Background with the Space Station.',
    questions: ['Why are alpha clusters big and round?', 'Why do longer lines mean more grazing tracks?', 'Why are heavy nuclei seen only in space?'],
  },
};

export function guideHTML(key, title) {
  const g = GUIDES[key];
  if (!g) return '';
  return `<div class="y">For teachers</div><h2>${title}</h2><div class="who">${g.level}</div>
    <h3>What to look for</h3><ul>${g.look.map((t) => `<li>${t}</li>`).join('')}</ul>
    <h3>Activity</h3><p>${g.activity}</p>
    <h3>Discussion</h3><ol>${g.questions.map((t) => `<li>${t}</li>`).join('')}</ol>
    <div class="go"><button class="start">Start simulation ▸</button><button class="back">Back</button></div>`;
}
