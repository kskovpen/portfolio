// Detector sounds (only where the real detector makes one): spark-chamber cracks, Geiger clicks.
// On by default; the speaker button in the bottom bar mutes them.
let ctx = null;
export const sound = { on: true };

function burst(dur, tau, type, freq, q, gain, delay = 0) {
  if (!sound.on) return;
  try {
    const A = ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());
    const len = Math.floor(A.sampleRate * dur), buf = A.createBuffer(1, len, A.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (A.sampleRate * tau));
    const src = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain();
    src.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
    src.connect(f).connect(g).connect(A.destination); src.start(A.currentTime + delay);
  } catch { /* audio unavailable */ }
}
// spark chamber: a sharp crack, louder with more sparks
export function crack(nSparks) { if (nSparks) burst(0.09, 0.012, 'highpass', 900, 0.7, Math.min(0.5, 0.06 + 0.02 * nSparks)); }
// Geiger-Mueller tube: a short tick
export function click(delay) { burst(0.004, 0.0007, 'bandpass', 3200, 0.8, 0.35, delay); }
