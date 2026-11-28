// About & credits: short. Full physics references live in the README.
import { STORIES } from './stories.js';

const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
// short attribution per image (CC BY-SA ones name author + licence, as required)
const IMG = {
  '': 'C. T. R. Wilson, 1912 (public domain)',
  rutherford: 'Geiger & Marsden apparatus, 1913 (public domain)',
  anderson: 'C. D. Anderson, 1932 (public domain)',
  blackett: 'Occhialini & Blackett, 1933 (public domain)',
  emulsion: 'Bristol emulsion plate, 1949 (public domain)',
  rochester: 'G. Rochester (public domain)',
  bubble: 'Bubble-chamber photo, U.S. DOE (public domain)',
  spark: 'Two-neutrino spark chamber, U.S. DOE (public domain)',
  superk: 'Photomultiplier: Motokoka, CC BY-SA 4.0',
  drift: 'ATLAS drift tubes: alpinethread, CC BY-SA 2.0',
};

export function creditsHTML() {
  const imgs = Object.entries(IMG).filter(([k]) => STORIES[k]?.src).map(([k, t]) => a(STORIES[k].src, t)).join(' · ');
  return `
    <div class="y">About</div><h2>ParticleScope</h2>
    <p><em>Created by Kirill Skovpen.</em></p>
    <p>Every experiment is simulated with real physics (${a('https://geant4.web.cern.ch', 'Geant4')}, ${a('https://garfieldpp.web.cern.ch', 'Garfield++')} with Magboltz and Heed, or the app’s own cloud-chamber engine) and checked against the original measurements.</p>
    <p class="small">Historic images via Wikimedia Commons (cropped, resized, some converted to greyscale): ${imgs}. Diagrams and logo are original.</p>
    <p class="small">An independent educational project, not affiliated with CERN or any experiment shown.</p>
    <div class="go"><button class="back">Back</button></div>`;
}
