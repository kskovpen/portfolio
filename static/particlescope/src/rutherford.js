// Rutherford / Geiger-Marsden gold-foil experiment (1909-1913).
//
// What the observers actually saw: through a microscope, faint green flashes on a zinc-sulphide
// screen, each one a single alpha particle. They counted them by eye, in the dark, at different
// angles from the beam. The user does the same: drag the microscope arm, count, and watch the
// counting rate against angle build up next to Rutherford's 1/sin^4(theta/2) law.
//
// Physics: dN/dOmega per alpha from Geant4 (single Coulomb scattering in 0.4 um Au, 7.69 MeV alphas;
// rutherford/g4/g4foil.cc). Beyond ~30 degrees single scattering dominates and Geant4 agrees with the
// Rutherford formula, which is then used where Geant4 statistics run out.

const DEG = Math.PI / 180;
const RATE_15 = 20;                        // flashes per second at 15 degrees, real time (a strong source; only the angle dependence is physics)
const GM1913 = [                           // Geiger & Marsden 1913 (Phil. Mag. 25, 604), gold: angle, scintillations
  [150, 33.1], [135, 43.0], [120, 51.9], [105, 69.5], [75, 211], [60, 477], [45, 1435], [37.5, 3300], [30, 7800], [22.5, 27300], [15, 132000]];

export class RutherfordScene {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.theta = 15; this.speed = 1; this.flashes = []; this.rays = []; this.last = 0;
    this.drag = false;
    canvas.addEventListener('pointerdown', (e) => this.pointer(e, true));
    canvas.addEventListener('pointermove', (e) => this.drag && this.pointer(e, false));
    window.addEventListener('pointerup', () => { this.drag = false; });
  }
  async load(url = 'assets/rutherford-au.json') {
    if (this.tab) return;
    const d = await (await fetch(url)).json();
    this.tab = d.dNdOmega;                 // [theta deg, dN/dOmega per alpha per sr]
    this.ruth = d.ruthK;                   // Rutherford constant: dN/dOmega = K / sin^4(theta/2)
    this.thomsonRms = d.thomsonRms;        // degrees: plum-pudding (multiple small deflections) width
    this.norm = RATE_15 / this.dNdO(15);
  }
  reset() { this.flashes = []; this.rays = []; }

  dNdO(th) {
    const t = this.tab;
    if (th >= t[t.length - 1][0]) return this.ruth / Math.pow(Math.sin(th * DEG / 2), 4);
    for (let i = 1; i < t.length; i++) if (th <= t[i][0]) {
      const a = t[i - 1], b = t[i], f = (th - a[0]) / (b[0] - a[0]);
      return Math.exp(Math.log(a[1]) + f * (Math.log(b[1]) - Math.log(a[1])));
    }
    return t[0][1];
  }
  // plum-pudding prediction, normalised to the same forward intensity: Gaussian in theta
  thomson(th) { const s = this.thomsonRms; return this.dNdO(1) * Math.exp(-(th * th - 1) / (2 * s * s)); }
  rate(th) { return this.norm * this.dNdO(th); }   // flashes per (real) second at angle th

  // ---- input: drag the microscope arm in the apparatus view ----
  pointer(e, down) {
    const r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, A = this.app;
    if (!A) return;
    const dx = x - A.cx, dy = y - A.cy, d = Math.hypot(dx, dy);
    if (down && (d > A.R * 1.35 || d < A.R * 0.3)) return;
    this.drag = true;
    const th = Math.abs(Math.atan2(dy, dx)) / DEG;  // beam goes +x; angle measured from it
    this.theta = Math.min(150, Math.max(5, Math.round(th)));
  }

  step(dt) {
    if (!this.tab) return;
    const sdt = dt * this.speed, lam = this.rate(this.theta) * sdt;
    let n = poisson(lam);
    // draw at most ~60 new flashes per frame: beyond that the eye only sees a glow anyway
    for (let i = 0; i < Math.min(n, 60); i++) {
      const r = 0.92 * Math.sqrt(Math.random()), a = 2 * Math.PI * Math.random();
      this.flashes.push({ x: r * Math.cos(a), y: r * Math.sin(a), b: 0.6 + 0.8 * Math.random(), age: -Math.random() * dt });
      if (this.rays.length < 40) this.rays.push({ th: this.theta + 1.5 * (Math.random() - 0.5), age: -Math.random() * dt });
    }
    for (const f of this.flashes) f.age += dt;
    for (const r of this.rays) r.age += dt;
    this.flashes = this.flashes.filter((f) => f.age < 0.5);
    this.rays = this.rays.filter((r) => r.age < 0.35);
  }

  draw(now) {
    const dt = this.last ? Math.min(0.05, now - this.last) : 0; this.last = now;
    this.step(dt);
    const cv = this.cv, ctx = this.ctx, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#020305'; ctx.fillRect(0, 0, W, H);
    if (!this.tab) return;

    const wide = W > H * 1.15;
    // --- eyepiece ---
    const eR = wide ? Math.min(H * 0.31, W * 0.24) : Math.min(W * 0.36, H * 0.2), eX = wide ? 24 + eR : W / 2, eY = wide ? 40 + eR : 60 + eR;
    const g = ctx.createRadialGradient(eX, eY, 0, eX, eY, eR);
    g.addColorStop(0, '#07100a'); g.addColorStop(1, '#020403');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(eX, eY, eR, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = '#2c3530'; ctx.lineWidth = 6; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(eX, eY, eR - 3, 0, 2 * Math.PI); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flashes) {
      if (f.age < 0) continue;
      // a ZnS scintillation lasts microseconds; the dark-adapted eye holds it for ~0.1-0.2 s
      const k = Math.exp(-f.age / 0.16) * f.b, x = eX + f.x * eR, y = eY + f.y * eR, rr = 6 + 16 * k;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, rr);
      gg.addColorStop(0, `rgba(240,255,240,${Math.min(1, 1.5 * k)})`); gg.addColorStop(0.3, `rgba(130,255,160,${Math.min(1, 1.1 * k)})`); gg.addColorStop(1, 'rgba(40,200,80,0)');
      ctx.fillStyle = gg; ctx.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.restore();
    ctx.fillStyle = '#8a949e'; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('microscope view of the zinc-sulphide screen', eX, eY + eR + 22);
    ctx.fillStyle = '#e8eef5'; ctx.font = '600 14px system-ui, sans-serif';
    const rNow = this.rate(this.theta) * 60;
    ctx.fillText(`θ = ${this.theta}°  ·  ${rNow >= 10 ? rNow.toFixed(0) : rNow >= 0.1 ? rNow.toFixed(1) : rNow.toFixed(3)} flashes per minute`, eX, eY + eR + 42);
    ctx.textAlign = 'start';

    // --- apparatus (top view): source, beam, foil, microscope arm ---
    const px0 = wide ? eX + eR + 40 : 16, pw = wide ? W - px0 - 20 : W - 32;
    const aR = Math.min(pw * 0.32, wide ? H * 0.17 : H * 0.12), acx = px0 + pw * 0.5, acy = wide ? 40 + aR * 1.2 : eY + eR + 60 + aR;
    this.app = { cx: acx, cy: acy, R: aR };
    ctx.strokeStyle = '#2a323b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(acx, acy, aR, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = '#3a3f46'; ctx.fillRect(acx - aR * 1.25, acy - 9, 26, 18);                 // lead block + source
    ctx.fillStyle = '#ffb066'; ctx.fillRect(acx - aR * 1.25 + 4, acy - 3, 6, 6);
    ctx.strokeStyle = 'rgba(255,176,102,0.5)'; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(acx - aR * 1.25 + 26, acy); ctx.lineTo(acx, acy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(acx - 1.5, acy - aR * 0.35, 3, aR * 0.7);       // gold foil
    // the alphas that make the flashes: foil -> screen (the beam itself mostly goes straight through)
    ctx.strokeStyle = 'rgba(255,176,102,0.25)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(acx, acy); ctx.lineTo(acx + aR * 1.15, acy); ctx.stroke(); ctx.lineWidth = 1.5;
    for (const r of this.rays) {
      if (r.age < 0) continue;
      const a = r.th * DEG, f = Math.min(1, r.age / 0.08);
      ctx.strokeStyle = `rgba(255,190,120,${0.9 * (1 - r.age / 0.35)})`;
      ctx.beginPath(); ctx.moveTo(acx, acy); ctx.lineTo(acx + aR * f * Math.cos(a), acy - aR * f * Math.sin(a)); ctx.stroke();
    }
    ctx.lineWidth = 1;
    const ta = this.theta * DEG, mx = acx + aR * Math.cos(ta), my = acy - aR * Math.sin(ta);
    ctx.strokeStyle = 'rgba(143,200,255,0.35)'; ctx.beginPath(); ctx.moveTo(acx, acy); ctx.lineTo(mx, my); ctx.stroke();
    ctx.save(); ctx.translate(mx, my); ctx.rotate(-ta);
    ctx.fillStyle = '#8fc8ff'; ctx.fillRect(-2, -8, 4, 16);                                    // ZnS screen
    ctx.fillStyle = '#59626e'; ctx.fillRect(2, -5, 24, 10);                                    // microscope tube
    ctx.restore();
    ctx.fillStyle = '#7d8894'; ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('α source', acx - aR * 1.25, acy + 24); ctx.fillText('gold foil 0.4 µm', acx + 6, acy + aR * 0.35 + 12);
    ctx.fillText('drag the microscope ↻', acx + aR * 0.55, acy + aR + 16);

    // --- plot: counting rate vs angle ---
    const gx = px0 + 34, gy = acy + aR + 40, gw = pw - 50, gh = Math.max(120, H - gy - 110);
    const yMin = -4, yMax = 3;                                     // log10 flashes/min
    const X = (th) => gx + gw * th / 160, Y = (v) => gy + gh * (1 - (Math.log10(Math.max(v, 1e-9)) - yMin) / (yMax - yMin));
    ctx.fillStyle = 'rgba(12,14,18,0.85)'; ctx.fillRect(gx - 34, gy - 22, gw + 48, gh + 52);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    for (let e = yMin; e <= yMax; e++) { ctx.beginPath(); ctx.moveTo(gx, Y(10 ** e)); ctx.lineTo(gx + gw, Y(10 ** e)); ctx.stroke(); }
    for (let t = 0; t <= 160; t += 30) { ctx.beginPath(); ctx.moveTo(X(t), gy); ctx.lineTo(X(t), gy + gh); ctx.stroke(); }
    ctx.fillStyle = '#5f6973'; ctx.font = '10px system-ui, sans-serif';
    for (let e = yMin; e <= yMax; e += 1) ctx.fillText(e === 0 ? '1' : `10${sup(e)}`, gx - 30, Y(10 ** e) + 3);
    for (let t = 0; t <= 150; t += 30) ctx.fillText(`${t}°`, X(t) - 6, gy + gh + 14);
    ctx.fillStyle = '#7d8894'; ctx.fillText('flashes per minute vs angle', gx, gy - 8);
    // Thomson ("plum pudding") prediction
    ctx.strokeStyle = 'rgba(255,122,122,0.8)'; ctx.setLineDash([4, 4]); ctx.beginPath();
    for (let t = 1; t <= 12; t += 0.25) { const v = this.norm * 60 * this.thomson(t); if (v < 10 ** yMin) break; t === 1 ? ctx.moveTo(X(t), Y(v)) : ctx.lineTo(X(t), Y(v)); }
    ctx.stroke(); ctx.setLineDash([]);
    // Rutherford / Geant4
    ctx.strokeStyle = '#8fc8ff'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let t = 3; t <= 160; t += 1) { const v = this.rate(t) * 60; t === 3 ? ctx.moveTo(X(t), Y(v)) : ctx.lineTo(X(t), Y(v)); }
    ctx.stroke();
    // Geiger & Marsden 1913, scaled to the curve at 45 degrees
    const s45 = this.rate(45) * 60 / 1435;
    ctx.strokeStyle = '#cfd6de'; ctx.lineWidth = 1;
    for (const [t, c] of GM1913) ctx.strokeRect(X(t) - 3, Y(c * s45) - 3, 6, 6);
    // where the microscope is now
    const mv = this.rate(this.theta) * 60;
    ctx.strokeStyle = 'rgba(255,211,77,0.35)'; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(X(this.theta), gy); ctx.lineTo(X(this.theta), gy + gh); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(X(this.theta), Y(mv), 5, 0, 2 * Math.PI); ctx.fill();
    // legend
    const lx = gx + gw - 150, ly = gy + 6;
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#ffd34d'; ctx.fillText('● your microscope', lx, ly + 8);
    ctx.fillStyle = '#8fc8ff'; ctx.fillText('— nucleus (Rutherford, Geant4)', lx, ly + 22);
    ctx.fillStyle = '#ff9a9a'; ctx.fillText('- - plum pudding (Thomson)', lx, ly + 36);
    ctx.fillStyle = '#cfd6de'; ctx.fillText('□ Geiger & Marsden 1913', lx, ly + 50);

    ctx.fillStyle = '#7d8894'; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center';
    const hint = this.theta < 30 ? 'Now drag the microscope to larger angles: the flashes almost stop.'
      : this.theta < 90 ? (this.speed < 100 ? 'Few flashes here. Speed up time (×100) to see them.' : 'Keep going: try angles beyond 90°, behind the foil.')
      : (this.speed < 1000 ? 'Behind the foil: about one flash every few minutes. Use ×1000.' : 'These alphas bounced back off a nucleus.');
    ctx.fillStyle = '#ffd34d'; ctx.fillText(hint, eX, eY + eR + 62);
    ctx.textAlign = 'start';
  }
}

function sup(e) { return String(e).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] ?? (c === '-' ? '⁻' : c)).join(''); }
function poisson(mu) {
  if (mu > 50) return Math.max(0, Math.round(mu + Math.sqrt(mu) * Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())));
  let L = Math.exp(-mu), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}
