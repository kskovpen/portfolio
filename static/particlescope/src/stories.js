// History shown before each simulation. Images live in assets/history/ (public-domain or
// CC-licensed; the credit line is shown under the picture). A missing image simply hides the figure.
export const STORIES = {
  rutherford: {
    year: '1909 – 1911', title: 'Gold foil: discovering the nucleus',
    who: 'Hans Geiger & Ernest Marsden · Ernest Rutherford · Manchester',
    body: [
      'Atoms were thought to be soft “plum puddings” of charge. Geiger and Marsden fired alpha particles at thin gold foil and counted the flashes by eye: a few <em>bounced back</em>.',
      'Rutherford compared it to a shell bouncing off tissue paper. In 1911 he explained it: an atom’s mass sits in a tiny, charged <em>nucleus</em>.',
    ],
    img: 'rutherford.png', fit: 'contain', src: 'https://commons.wikimedia.org/wiki/File:Geiger-Marsden_diagram.gif', credit: 'The apparatus, from Geiger & Marsden’s 1913 paper: radium source R, gold foil F, zinc-sulphide screen S and microscope M, which turn together on platform A. Public domain, via Wikimedia Commons.',
  },
  '': {
    year: '1911 · 1936', title: 'The cloud chamber',
    who: 'C. T. R. Wilson · Cavendish Laboratory, Cambridge',
    body: [
      'Charles Wilson was trying to recreate mountain clouds when he saw droplets forming along the paths of single charged particles. It won him the 1927 Nobel Prize.',
      'In 1936 Alexander Langsdorf made it continuously sensitive: the <em>diffusion</em> chamber shown here. Every track in it is natural: cosmic-ray muons, electrons knocked loose by gamma rays, and alphas from radon in the air.',
    ],
    img: 'cloud.jpg', src: 'https://commons.wikimedia.org/wiki/File:Cloud_chamber_1912_X-ray.jpg', credit: 'C. T. R. Wilson, 1912: tracks of electrons freed by X-rays. Public domain, via Wikimedia Commons.',
  },
  anderson: {
    year: '1932', title: 'The positron: the first antimatter',
    who: 'Carl D. Anderson · Caltech, Pasadena',
    body: [
      'Dirac’s theory predicted an anti-electron, and hardly anyone believed it. In 1932 Anderson photographed a track bending the <em>wrong way</em> through a lead plate in a magnetic field: a positive electron.',
      'It was the first antimatter, and it won the 1936 Nobel Prize.',
    ],
    img: 'anderson.jpg', src: 'https://commons.wikimedia.org/wiki/File:PositronDiscovery.jpg', credit: 'C. D. Anderson, 1932: the first positron (Phys. Rev. 43, 491). Public domain, via Wikimedia Commons.',
  },
  blackett: {
    year: '1933', title: 'Showers and the birth of pairs',
    who: 'Patrick Blackett & Giuseppe Occhialini · Cavendish Laboratory',
    body: [
      'Blackett and Occhialini let Geiger counters <em>trigger the camera</em>, the first triggered detector. Their photographs caught bursts of electrons and positrons born together from energy: E = mc² at work.',
      'Blackett won the 1948 Nobel Prize.',
    ],
    img: 'blackett.jpg', src: 'https://commons.wikimedia.org/wiki/File:Giuseppe_(%27Beppo%27)_P.S._Occhialini_(1907%E2%80%931993)_and_Patrick_M.S._Blackett_(1897%E2%80%931974)_in_1932_or_1933.png', credit: 'Occhialini (left) and Blackett, 1932–33. Public domain, via Wikimedia Commons.',
  },
  emulsion: {
    year: '1947', title: 'Nuclear emulsion: the pion',
    who: 'Cecil Powell, César Lattes & Giuseppe Occhialini · Bristol',
    body: [
      'Photographic plates carried up to mountain tops recorded cosmic rays as rows of silver grains, read for hours under microscopes by teams of scanners. In 1947 they showed a new particle stopping and giving birth to a muon that <em>always</em> travelled the same distance.',
      'It was the pion, the particle Yukawa had predicted to hold nuclei together. Powell won the 1950 Nobel Prize.',
    ],
    img: 'emulsion.jpg', fit: 'contain', src: 'https://commons.wikimedia.org/wiki/File:The_%22k_track_plate%22_showing_three-pion_decay_mode_of_a_kaon,_15_Jan_1949.png', credit: 'A Bristol emulsion plate, 15 January 1949: a kaon (k) stops and decays into three pions. Public domain, via Wikimedia Commons.',
  },
  rochester: {
    year: '1947', title: 'The strange “V”',
    who: 'George Rochester & Clifford Butler · University of Manchester',
    body: [
      'Two tracks spring from one point in empty gas. Something neutral and invisible made them.',
      'These “V particles”, now called kaons, lived so oddly long that physicists named a new property after them: <em>strangeness</em>. That puzzle led to the quark model.',
    ],
    img: 'rochester.jpg', src: 'https://commons.wikimedia.org/wiki/File:George_dixon_rochester.jpg', credit: 'George Rochester. Public domain, via Wikimedia Commons.',
  },
  scint: {
    year: '1948', title: 'Scintillation crystals',
    who: 'Robert Hofstadter · Princeton',
    body: [
      'Some crystals turn the energy of a particle into a flash of light. In 1948 Hofstadter found that sodium iodide with a trace of thallium is bright and clear enough to <em>measure</em> a gamma ray’s energy, once photomultipliers made each faint flash countable.',
      'Crystals like this are in every nuclear lab, medical PET scanners and airport radiation portals.',
    ],
    img: null, credit: '',
  },
  bubble: {
    year: '1952', title: 'The bubble chamber',
    who: 'Donald Glaser · Luis Alvarez · Brookhaven and CERN',
    body: [
      'A superheated liquid boils first along a particle’s path. Glaser’s idea (Nobel Prize 1960), scaled up by Alvarez into huge liquid-hydrogen chambers, revealed the <em>particle zoo</em>.',
      'In 1964 one photograph showed the Ω⁻, exactly as the quark model predicted.',
    ],
    img: 'bubble.jpg', src: 'https://commons.wikimedia.org/wiki/File:Liquid_hydrogen_bubble_chamber_photograph_of_an_anti-proton_colliding_with_a_proton.jpg', credit: 'Antiproton hitting a proton in a liquid-hydrogen bubble chamber. U.S. Dept. of Energy, public domain, via Wikimedia Commons.',
  },
  spark: {
    year: '1959', title: 'The spark chamber',
    who: 'S. Fukui & S. Miyamoto · Lederman, Schwartz & Steinberger',
    body: [
      'A particle leaves a trail of ions in neon gas between metal plates. A sudden high-voltage pulse makes every gap <em>spark along the trail</em>, so the track lights up.',
      'In 1962 a 10-ton spark chamber at Brookhaven showed that there are two kinds of neutrino (Nobel Prize 1988). Today spark chambers show cosmic rays in science museums.',
    ],
    img: 'spark.jpg', src: 'https://commons.wikimedia.org/wiki/File:Two-neutrino_experiment_spark_chamber.jpg', credit: 'The 1962 two-neutrino spark chamber at Brookhaven. U.S. Dept. of Energy, public domain, via Wikimedia Commons.',
  },
  superk: {
    year: '1983 · 1996', title: 'Super-Kamiokande',
    who: 'Kamioka Observatory, Japan · Takaaki Kajita, Masatoshi Koshiba',
    body: [
      'A charged particle faster than light <em>in water</em> sends out a cone of blue Cherenkov light, which lands as a ring on the light sensors lining the tank.',
      'Its predecessor <em>Kamiokande</em> (1983) caught 11 neutrinos from supernova 1987A (Nobel Prize 2002). Super-K (1996) showed in 1998 that neutrinos change type, so they have mass; the heavy-water sphere of SNO confirmed it (Nobel Prize 2015).',
    ],
    img: 'superk.jpg', src: 'https://commons.wikimedia.org/wiki/File:Photomultiplier_Tube_(PMT).jpg', credit: 'One of Super-K’s 11,146 photomultipliers, 50 cm across (museum exhibit, Japan). Photo: Motokoka, CC BY-SA 4.0, via Wikimedia Commons.',
  },
  timepix: {
    year: '2006', title: 'Timepix: a camera for particles',
    who: 'Medipix collaboration · CERN',
    body: [
      'Silicon strip detectors arrived around 1980, and pixel detectors with their own electronics in every pixel in the 1990s. Timepix (2006) measures the <em>energy</em> landing on each of its 65,536 pixels, so every particle draws its own signature: blobs, worms, lines and dots.',
      'Chips like it now monitor radiation on the International Space Station and image X-rays in medicine.',
    ],
    img: null, credit: '',
  },
  drift: {
    year: '1968', title: 'Drift tubes: listening to the gas',
    who: 'Georges Charpak · CERN · the ATLAS muon spectrometer',
    body: [
      'Charpak replaced the camera with wires: electrons from a passing particle drift to a wire and avalanche into an electric pulse (Nobel Prize 1992).',
      'ATLAS at CERN uses about 350,000 such tubes. In 2012 they caught the muons from Higgs-boson decays.',
    ],
    img: 'drift.jpg', src: 'https://commons.wikimedia.org/wiki/File:ATLAS_MDT_big_wheel.jpg', credit: 'ATLAS muon drift-tube chambers on the “Big Wheel”, CERN. Photo: alpinethread, CC BY-SA 2.0, via Wikimedia Commons.',
  },
};
