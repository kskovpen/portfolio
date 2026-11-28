import { VS_DROP, FS_DROP, VS_QUAD, FS_BLUR, FS_COMPOSITE, VS_PLATE, FS_PLATE } from './shaders.js';
import { CHAMBER } from './physics.js';

const FLOATS = 8; // per droplet: x y z t0 | size seed weight type

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}
function mul4(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

export class Renderer {
  constructor(canvas, capacity = 1 << 20) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl; this.canvas = canvas; this.cap = capacity;
    this.data = new Float32Array(capacity * FLOATS);
    this.head = 0; this.count = 0; this.dirtyStart = 0; this.dirtyCount = 0;
    this.total = 0; this.marks = []; this.floor = 0;
    this.floatRT = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    this.maxPx = Math.min(64, gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1]);

    this.drop = program(gl, VS_DROP, FS_DROP);
    this.blur = program(gl, VS_QUAD, FS_BLUR);
    this.comp = program(gl, VS_QUAD, FS_COMPOSITE);
    this.plateProg = program(gl, VS_PLATE, FS_PLATE);
    this.plateVao = null; this.plateCount = 0;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, FLOATS * 4, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, FLOATS * 4, 16);
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(null);
    this.w = 0; this.h = 0;
    this.spark = false;  // spark chamber: self-luminous neon discharges
    this.bubble = false; // liquid-hydrogen bubble chamber: frozen bubbles, even flash light, black glass
  }

  push(x, y, z, t, size, seed, weight, type) {
    const i = this.head, o = i * FLOATS, d = this.data;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = t;
    d[o + 4] = size; d[o + 5] = seed; d[o + 6] = weight; d[o + 7] = type;
    if (this.dirtyCount === 0) this.dirtyStart = i;
    this.dirtyCount = Math.min(this.cap, this.dirtyCount + 1);
    this.head = (i + 1) % this.cap;
    if (this.count < this.cap) this.count++;
    this.total++;
  }

  // Droplets are written in (frame-level) time order. Marking the write position at
  // the start of every simulation step lets render() draw only the live window of
  // the ring instead of all `cap` slots.
  // forget every droplet made so far (switching experiments): they stay in the ring but are never drawn
  clear() { this.floor = this.total; }
  mark(t) {
    this.marks.push({ t, total: this.total });
    if (this.marks.length > 4096) this.marks.splice(0, 2048);
  }
  liveStart(time, maxLife) {
    let start = 0;
    for (const m of this.marks) { if (m.t <= time - maxLife) start = m.total; else break; }
    while (this.marks.length > 2 && this.marks[1].t <= time - maxLife) this.marks.shift();
    return Math.max(start, this.total - this.cap);
  }

  upload() {
    const gl = this.gl, n = this.dirtyCount;
    if (!n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    if (n >= this.cap) gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data);
    else {
      const s = this.dirtyStart, n1 = Math.min(n, this.cap - s);
      gl.bufferSubData(gl.ARRAY_BUFFER, s * FLOATS * 4, this.data, s * FLOATS, n1 * FLOATS);
      if (n > n1) gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, (n - n1) * FLOATS);
    }
    this.dirtyCount = 0;
  }

  target(w, h) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (this.floatRT) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * (this.quality ?? 1);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    this.canvas.width = w; this.canvas.height = h; this.w = w; this.h = h; this.dpr = dpr;
    for (const t of Object.values(this.rt || {})) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
    const w2 = Math.max(1, w >> 1), h2 = Math.max(1, h >> 1), w8 = Math.max(1, w >> 3), h8 = Math.max(1, h >> 3);
    this.rt = { hdr: this.target(w, h), a1: this.target(w2, h2), b1: this.target(w2, h2), a2: this.target(w8, h8), b2: this.target(w8, h8) };
  }

  camera(cam) {
    const aspect = this.w / this.h, fov = (cam.fov || 35) * Math.PI / 180, f = 1 / Math.tan(fov / 2);
    const dist = Math.max(14.5 * f / aspect, 10.5 * f) / cam.zoom;
    const sp = Math.sin(cam.pitch), cp = Math.cos(cam.pitch), sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    const eye = [dist * sp * sy, -dist * sp * cy, dist * cp];
    const fw = [-eye[0] / dist, -eye[1] / dist, -eye[2] / dist];
    const r = [cy, sy, 0];
    const up = [r[1] * fw[2] - r[2] * fw[1], r[2] * fw[0] - r[0] * fw[2], r[0] * fw[1] - r[1] * fw[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const view = new Float32Array([
      r[0], up[0], -fw[0], 0, r[1], up[1], -fw[1], 0, r[2], up[2], -fw[2], 0,
      -dot(r, eye), -dot(up, eye), dot(fw, eye), 1]);
    const n = Math.max(1, dist - 200), fa = dist + 500; // telephoto views put the camera far away
    const proj = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]);
    return { viewProj: mul4(proj, view), dist, pxScale: this.h / 2 * f };
  }

  // Lead plate standing on the floor across the chamber (x0..x1), or null to remove it
  setPlate(plate, floorZ) {
    const gl = this.gl;
    if (!plate) { this.plateCount = 0; return; }
    const { x0, x1 } = plate, y0 = -CHAMBER.halfH, y1 = CHAMBER.halfH, z0 = floorZ, z1 = -floorZ; // spans the sensitive depth
    const quad = (a, b, c, d, n) => [a, b, c, a, c, d].flatMap((v) => [...v, ...n]);
    const v = [
      ...quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]),  // face towards the LEDs
      ...quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]),   // far face
      ...quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]),   // top: drawn last (no depth buffer), it is nearest the camera
    ];
    if (!this.plateVao) {
      this.plateVao = gl.createVertexArray(); gl.bindVertexArray(this.plateVao);
      this.plateVbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.plateVbo);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      gl.bindVertexArray(null);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.plateVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    this.plateCount = v.length / 6;
    this.plateX = [x0, x1];
  }

  // arbitrary axis-aligned boxes [x0,x1,y0,y1,z0,z1] (spark-chamber plates): faces seen by the camera
  setBoxes(boxes) {
    const quad = (a, b, c, d, n) => [a, b, c, a, c, d].flatMap((v) => [...v, ...n]);
    const v = [];
    // only the edges facing the viewer: without a depth buffer the large plate faces would be
    // drawn over each other; seen through the front window they are thin bright edges anyway
    for (const [x0, x1, y0, y1, , z1] of boxes) v.push(...quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]));
    this.setPlate({ x0: 0, x1: 0 }, 0); // allocate buffers
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.plateVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    this.plateCount = v.length / 6;
    this.plateX = [-1e4, 1e4]; // no edge highlight
  }

  blurPass(src, dst, dx, dy, clampV) {
    const gl = this.gl, b = this.blur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
    gl.viewport(0, 0, dst.w, dst.h);
    gl.useProgram(b.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(b.u.uSrc, 0);
    gl.uniform2f(b.u.uDir, dx / dst.w, dy / dst.h);
    gl.uniform1f(b.u.uClamp, clampV);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  render(time, P, cam) {
    const gl = this.gl;
    this.resize();
    this.upload();
    const c = this.camera(cam), rt = this.rt;
    this.viewProj = c.viewProj;
    this.pxPerCm = c.pxScale / c.dist / this.dpr; // CSS px per cm at the layer centre (for the scale bar)

    // 1. droplets -> HDR (additive light scattering)
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.hdr.fbo);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.plateCount) {
      gl.useProgram(this.plateProg.p);
      gl.uniformMatrix4fv(this.plateProg.u.uViewProj, false, c.viewProj);
      gl.uniform1f(this.plateProg.u.uHalfW, CHAMBER.halfW);
      gl.uniform2f(this.plateProg.u.uPlateX, this.plateX[0], this.plateX[1]);
      gl.bindVertexArray(this.plateVao);
      gl.drawArrays(gl.TRIANGLES, 0, this.plateCount);
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const d = this.drop, u = d.u;
    gl.useProgram(d.p);
    gl.uniformMatrix4fv(u.uViewProj, false, c.viewProj);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uLife, P.life);
    const B = this.bubble || this.spark;
    gl.uniform1f(u.uGrowTau, this.spark ? 0.004 : B ? 0.06 : 0.12);
    gl.uniform1f(u.uDiff, B ? 0 : P.diffusion);
    gl.uniform1f(u.uFall, B ? 0 : P.fall);
    gl.uniform1f(u.uConv, B ? 0 : P.convection);
    gl.uniform1f(u.uFloorZ, B ? -1e4 : -P.layer * 0.75);
    gl.uniform1f(u.uPxScale, c.pxScale);
    gl.uniform1f(u.uBasePx, 1.25 * this.dpr);
    gl.uniform1f(u.uMaxPx, this.maxPx);
    gl.uniform1f(u.uFocusDist, c.dist);
    gl.uniform1f(u.uAperture, P.aperture);
    gl.uniform1f(u.uGain, 0.85 * (this.floatRT ? 1 : 0.5));
    gl.uniform1f(u.uHalfW, B ? 1e4 : CHAMBER.halfW);
    gl.uniform1f(u.uLightZ, 0.0);
    gl.uniform1f(u.uLightH, B ? 1e4 : 2.5);
    gl.uniform1i(u.uColorize, P.colorize ? 1 : 0);
    if (this.spark) gl.uniform3f(u.uTint, 1.0, 0.42, 0.16); else gl.uniform3f(u.uTint, 0.93, 0.97, 1.0); // neon discharge / white scattered light
    gl.bindVertexArray(this.vao);
    // draw only the live window (shader max life = 1.45 * uLife)
    const start = Math.max(this.floor, this.liveStart(time, P.life * 1.45 + 0.05)), n = Math.min(this.total - start, this.cap);
    const s = start % this.cap, n1 = Math.min(n, this.cap - s);
    if (n1 > 0) gl.drawArrays(gl.POINTS, s, n1);
    if (n > n1) gl.drawArrays(gl.POINTS, 0, n - n1);
    this.drawn = n;
    gl.bindVertexArray(this.quadVao);
    gl.disable(gl.BLEND);

    // 2. bloom (scatter halo / lens glow)
    this.blurPass(rt.hdr, rt.a1, 1.5, 0, 1.5);
    this.blurPass(rt.a1, rt.b1, 0, 1.5, 1e4);
    this.blurPass(rt.b1, rt.a2, 1.5, 0, 1e4);
    this.blurPass(rt.a2, rt.b2, 0, 1.5, 1e4);

    // 3. composite to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    const m = this.comp;
    gl.useProgram(m.p);
    [[rt.hdr, 'uHdr'], [rt.b1, 'uB1'], [rt.b2, 'uB2']].forEach(([t, name], i) => {
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.uniform1i(m.u[name], i);
    });
    gl.uniform1f(m.u.uTime, time);
    gl.uniform1f(m.u.uExposure, P.exposure);
    gl.uniform1f(m.u.uBloom, P.bloom);
    gl.uniform1f(m.u.uFelt, this.bubble || this.spark ? 0 : 1);
    gl.uniform2f(m.u.uRes, this.w, this.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
