// Our own apparatus schematics for the history pages (inline SVG, 320 x 200).
const T = (x, y, s, a = 'start', c = '#9aa6b2') => `<text x="${x}" y="${y}" fill="${c}" font-size="9" text-anchor="${a}" font-family="system-ui,sans-serif">${s}</text>`;
const trk = (d, c = '#eaf4ff', w = 1.6) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-dasharray="0.1 3.2" stroke-linecap="round"/>`;
const line = (d, c = '#59626e', w = 1.2, dash = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
const arrow = `<defs><marker id="ar" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" fill="#8fc8ff"/></marker></defs>`;
const svg = (body) => `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg">${arrow}${body}</svg>`;
const lead = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#3a3f46" stroke="#6b7480"/>`;

export const SCHEMATICS = {
  '': svg(
    `<rect x="60" y="30" width="200" height="130" rx="4" fill="#07090c" stroke="#59626e"/>` +
    `<rect x="62" y="32" width="196" height="12" fill="#2a2116"/>${T(160, 24, 'warm felt soaked in isopropyl alcohol (+20 °C)', 'middle')}` +
    `<rect x="62" y="132" width="196" height="26" fill="#0f1a26"/>${T(160, 176, 'cold plate on dry ice (−78 °C)', 'middle')}` +
    `<rect x="62" y="112" width="196" height="20" fill="rgba(143,200,255,0.10)"/>${T(266, 125, 'sensitive layer ~1 cm')}` +
    `<path d="M95 60 v40 M115 60 v40 M135 60 v40 M185 60 v40 M205 60 v40 M225 60 v40" stroke="#4d5a68" stroke-dasharray="2 4"/>${T(266, 80, 'vapour sinks,')}${T(266, 91, 'supersaturates')}` +
    trk('M80 128 L150 116') + trk('M200 130 L214 118', '#ffb066', 3) + trk('M230 126 q-8 -6 -2 -10 q6 -4 0 -8', '#eaf4ff', 1.2) +
    `<rect x="18" y="108" width="40" height="26" fill="none" stroke="#8fc8ff"/>${T(38, 145, 'LED light', 'middle')}` +
    T(110, 108, 'muon', 'middle', '#cfd6de') + T(206, 110, 'α', 'middle', '#ffb066')),
  anderson: svg(
    `<circle cx="160" cy="100" r="80" fill="#07090c" stroke="#59626e"/>` +
    `<circle cx="160" cy="100" r="92" fill="none" stroke="#7a4d2a" stroke-width="8" opacity="0.6"/>${T(160, 8, 'electromagnet coil, B ≈ 1.5 T (into the page)', 'middle')}` +
    lead(84, 97, 152, 6) + T(240, 104, '6 mm lead') +
    trk('M150 178 Q156 140 162 103', '#ff7a7a') + trk('M162 97 Q170 60 205 38', '#ff7a7a') +
    T(132, 150, '63 MeV', 'end', '#ff9a9a') + T(196, 64, '23 MeV', 'start', '#ff9a9a') +
    T(212, 30, 'tighter above:', 'start', '#cfd6de') + T(212, 41, 'came from below', 'start', '#cfd6de') +
    `<path d="M118 160 l0 -18" stroke="#8fc8ff" marker-end="url(#ar)"/>${T(112, 172, 'direction', 'end')}`),
  blackett: svg(
    `<rect x="100" y="8" width="120" height="14" rx="7" fill="#1a2430" stroke="#8fc8ff"/>${T(226, 18, 'Geiger counter')}` +
    `<circle cx="160" cy="100" r="62" fill="#07090c" stroke="#59626e"/>` + lead(100, 92, 120, 8) + T(226, 99, 'lead') +
    `<rect x="100" y="178" width="120" height="14" rx="7" fill="#1a2430" stroke="#8fc8ff"/>${T(226, 188, 'Geiger counter')}` +
    trk('M158 4 L159 92', '#cfd6de', 1.8) +
    [-26, -14, -5, 6, 15, 27].map((k, i) => trk(`M159 100 Q${159 + k * 0.6} 130 ${159 + k * 1.6 + (i % 2 ? 10 : -10)} 158`, i % 2 ? '#ff7a7a' : '#7dff9a', 1.3)).join('') +
    `<path d="M60 22 L60 186" stroke="#8fc8ff" stroke-dasharray="3 3"/>${T(20, 100, 'both fire')}${T(20, 111, '→ expand,')}${T(20, 122, 'flash, photo')}` +
    T(250, 150, 'e⁺', 'start', '#ff9a9a') + T(250, 162, 'e⁻', 'start', '#9affb0')),
  rochester: svg(
    `<rect x="40" y="20" width="240" height="160" rx="6" fill="#07090c" stroke="#59626e"/>` + lead(40, 56, 240, 20) + T(286, 70, '3 cm lead') +
    trk('M150 22 L156 56', '#cfd6de', 1.8) + T(146, 38, 'cosmic ray', 'end', '#cfd6de') +
    trk('M157 76 L120 178', '#b88cff') + trk('M157 76 L196 178', '#b88cff') +
    line('M157 76 L178 118', '#8fc8ff', 1.2, '3 3') + T(186, 104, 'K⁰ (neutral: no track)', 'start', '#8fc8ff') +
    trk('M178 118 Q160 150 136 176', '#ff7a7a') + trk('M178 118 Q206 146 240 160', '#7dff9a') +
    T(132, 170, 'π⁺', 'end', '#ff9a9a') + T(244, 158, 'π⁻', 'start', '#9affb0') + T(178, 132, 'the “V”', 'middle', '#ffd34d')),
  bubble: svg(
    `<rect x="40" y="40" width="200" height="110" rx="14" fill="#07090c" stroke="#59626e"/>${T(140, 166, 'liquid hydrogen at −247 °C, just past boiling', 'middle')}` +
    `<rect x="246" y="70" width="40" height="50" fill="#1a2430" stroke="#8fc8ff"/><path d="M246 95 h-6" stroke="#8fc8ff"/>${T(266, 132, 'piston:', 'middle')}${T(266, 143, 'drops pressure', 'middle')}` +
    `<circle cx="80" cy="22" r="8" fill="none" stroke="#cfd6de"/><circle cx="200" cy="22" r="8" fill="none" stroke="#cfd6de"/>${T(140, 26, 'stereo cameras + flash', 'middle')}` +
    trk('M4 80 L120 84', '#4dffd9') + trk('M4 96 L238 100', '#4dffd9') + trk('M4 112 L238 116', '#4dffd9') +
    trk('M120 84 Q170 60 236 52', '#b88cff', 1.3) + trk('M120 84 Q180 98 236 124', '#ff7a7a', 1.3) + trk('M150 108 q10 -6 6 -12 q-6 -4 -8 2 q0 6 6 4', '#ffd34d', 1.1) +
    T(8, 74, 'K⁻ beam →', 'start', '#4dffd9') + T(114, 74, 'interaction', 'end', '#cfd6de') + T(300, 190, 'magnet field ⊙ 1.5 T', 'end')),
  rutherford: svg(
    `<circle cx="170" cy="100" r="78" fill="none" stroke="#2a323b" stroke-dasharray="3 4"/>${T(170, 194, 'vacuum box', 'middle')}` +
    `<rect x="20" y="88" width="34" height="24" fill="#3a3f46" stroke="#6b7480"/><rect x="26" y="96" width="8" height="8" fill="#ffb066"/>${T(37, 126, 'radium source', 'middle')}${T(37, 137, 'in lead', 'middle')}` +
    line('M54 100 H168', '#ffb066', 1.2, '3 3') + `<rect x="168" y="70" width="4" height="60" fill="#ffd34d"/>${T(176, 66, 'gold foil 0.4 µm')}` +
    line('M172 100 H246', '#ffb066', 1, '3 3') + line('M172 100 L222 44', '#ffb066', 1, '3 3') + line('M170 100 L118 52', '#ffb066', 1, '3 3') +
    `<g transform="translate(222 44) rotate(-48)"><rect x="-2" y="-9" width="4" height="18" fill="#8fc8ff"/><rect x="2" y="-6" width="34" height="12" fill="#59626e"/></g>` +
    T(268, 140, 'zinc-sulphide screen', 'middle', '#8fc8ff') + T(268, 151, '+ microscope (rotates)', 'middle', '#8fc8ff') +
    T(96, 44, 'rare: bounced back!', 'middle', '#ff9a9a')),
  spark: svg(
    `<rect x="70" y="14" width="180" height="10" rx="3" fill="#1a2430" stroke="#8fc8ff"/>${T(256, 22, 'scintillator')}` +
    Array.from({ length: 11 }, (_, i) => `<rect x="70" y="${34 + i * 12.6}" width="180" height="3" fill="#59626e"/>`).join('') +
    `<rect x="70" y="176" width="180" height="10" rx="3" fill="#1a2430" stroke="#8fc8ff"/>${T(256, 184, 'scintillator')}` +
    line('M128 6 L188 194', '#40bfff', 1, '3 4') + T(124, 10, 'muon', 'end', '#40bfff') +
    Array.from({ length: 10 }, (_, i) => { const y = 37 + i * 12.6, x = 128 + (y + 4.8 - 6) * 60 / 188; return `<path d="M${x} ${y} l1.2 3 l-1.6 3 l1 3.6" stroke="#ff7a3d" stroke-width="2" fill="none"/>`; }).join('') +
    `<path d="M40 19 V181" stroke="#8fc8ff" stroke-dasharray="3 3"/>${T(8, 92, 'both fire →')}${T(8, 103, '10 kV pulse')}${T(8, 114, 'on the plates')}` +
    T(256, 100, 'neon gas') + T(256, 111, 'between plates')),
  emulsion: svg(
    `<path d="M40 150 L120 120 L290 120 L210 150 Z" fill="#e2dbc6" stroke="#8a8270"/><path d="M40 150 L40 158 L210 158 L210 150 M210 158 L290 128 L290 120" fill="none" stroke="#8a8270"/>` +
    T(160, 176, 'glass plate with a 0.6 mm emulsion layer (silver bromide in gelatine)', 'middle') +
    `<path d="M150 30 L150 90" stroke="#59626e" stroke-width="16"/><path d="M142 90 h16 l-4 14 h-8 z" fill="#59626e"/>${T(166, 44, 'microscope', 'start')}${T(166, 55, '(×100 – ×1000)', 'start')}` +
    `<path d="M90 140 L150 134" stroke="#1c160e" stroke-width="2.2"/><path d="M150 134 L196 128" stroke="#1c160e" stroke-width="1.6"/>` +
    T(70, 112, 'π stops', 'middle', '#cfd6de') + T(186, 112, 'μ: always 0.6 mm', 'middle', '#cfd6de') +
    T(40, 24, 'exposed for weeks on', 'start') + T(40, 35, 'mountain tops (Pic du Midi)', 'start')),
  scint: svg(
    `<circle cx="40" cy="100" r="5" fill="#ffb066"/>${T(40, 122, 'γ source', 'middle')}` + line('M46 100 L116 96', '#ffb066', 1.2, '4 4') +
    `<rect x="110" y="60" width="80" height="80" fill="rgba(90,110,220,0.35)" stroke="#9aa6b2"/>${T(150, 54, 'NaI(Tl) crystal', 'middle')}` +
    `<circle cx="130" cy="95" r="7" fill="rgba(210,200,255,0.9)"/><path d="M130 95 L168 118" stroke="#ffb066" stroke-dasharray="3 3"/><circle cx="168" cy="118" r="10" fill="rgba(210,200,255,0.9)"/>` +
    T(150, 160, 'flashes of light where', 'middle', '#cfd6de') + T(150, 171, 'the gamma interacts', 'middle', '#cfd6de') +
    `<rect x="190" y="70" width="50" height="60" fill="#3a4250"/>${T(215, 146, 'photomultiplier', 'middle')}` +
    `<path d="M240 100 H258 l3 -30 l6 30 H300" stroke="#7fd4ff" fill="none"/>${T(274, 116, 'pulse ∝ energy', 'middle', '#7fd4ff')}`),
  superk: svg(
    `<rect x="70" y="16" width="150" height="168" rx="4" fill="#06121f" stroke="#59626e"/>${T(145, 196, '50,000 t of pure water · 11,146 photomultipliers', 'middle')}` +
    Array.from({ length: 14 }, (_, i) => `<circle cx="70" cy="${24 + i * 12}" r="3" fill="#2a323b"/><circle cx="220" cy="${24 + i * 12}" r="3" fill="#2a323b"/>`).join('') +
    line('M120 150 L170 70', '#40bfff', 1.6) + T(116, 160, 'muon', 'end', '#40bfff') +
    `<path d="M170 70 L208 24 M170 70 L220 54" stroke="#4da6ff" stroke-width="1" opacity="0.8"/><path d="M150 102 L196 16 M150 102 L220 74" stroke="#4da6ff" stroke-width="1" opacity="0.5"/>` +
    `<path d="M220 24 V76" stroke="#7fd4ff" stroke-width="4"/>${T(226, 44, 'ring of light', 'start', '#7fd4ff')}${T(226, 55, 'on the wall', 'start', '#7fd4ff')}` +
    T(186, 104, 'Cherenkov cone 42°', 'start', '#4da6ff') + T(20, 40, '1 km of rock', 'start') + T(20, 51, 'above', 'start')),
  timepix: svg(
    `<rect x="60" y="70" width="200" height="22" fill="#4a5664" stroke="#8a96a4"/>${T(266, 84, 'silicon sensor 300 µm')}` +
    Array.from({ length: 12 }, (_, i) => `<circle cx="${68 + i * 16.4}" cy="97" r="3" fill="#c0a060"/>`).join('') + T(266, 100, 'bump bonds') +
    `<rect x="60" y="102" width="200" height="16" fill="#1f5f3a" stroke="#3f8f5a"/>${T(266, 113, 'readout chip: 256 × 256')}${T(266, 124, 'pixels of 55 µm')}` +
    line('M120 20 L140 92', '#40bfff', 1.4) + T(116, 18, 'particle', 'end', '#40bfff') +
    `<path d="M136 80 L130 96 M136 80 L142 96" stroke="#ffd34d" stroke-dasharray="2 2"/>${T(150, 60, 'charge drifts to the pixels', 'start', '#ffd34d')}` +
    `<rect x="126" y="102" width="16" height="16" fill="#e63c28" opacity="0.8"/>${T(134, 140, 'each pixel measures its energy', 'middle', '#cfd6de')}`),
  drift: svg(
    `<circle cx="110" cy="100" r="80" fill="#0a0d12" stroke="#9aa6b2" stroke-width="3"/>${T(110, 196, 'aluminium tube, 3 cm, Ar/CO₂ at 3 bar', 'middle')}` +
    `<circle cx="110" cy="100" r="2.5" fill="#ffd34d"/>${T(116, 96, 'wire +3080 V', 'start', '#ffd34d')}` +
    line('M60 10 L150 190', '#40bfff', 1.2, '3 4') + T(56, 18, 'muon', 'end', '#40bfff') +
    [[70, 30], [80, 50], [90, 70], [100, 90], [118, 126], [128, 146], [138, 166]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#7dff9a"/><path d="M${x} ${y} L${110 + (x - 110) * 0.25} ${100 + (y - 100) * 0.25}" stroke="#7dff9a" stroke-opacity="0.5" marker-end="url(#ar)"/>`).join('') +
    `<circle cx="110" cy="100" r="12" fill="none" stroke="#8fc8ff" stroke-dasharray="2 2"/>` +
    `<path d="M112 100 H230" stroke="#59626e"/><path d="M230 88 l18 12 l-18 12 z" fill="none" stroke="#8fc8ff"/>${T(239, 124, 'amplifier', 'middle')}` +
    `<path d="M250 100 H268 l4 -18 l4 26 l4 -8 H300" fill="none" stroke="#7dff9a"/>${T(286, 124, 'pulse → time', 'middle')}` +
    T(200, 60, 'first electron to arrive', 'start', '#cfd6de') + T(200, 71, 'gives the closest distance', 'start', '#cfd6de')),
};
