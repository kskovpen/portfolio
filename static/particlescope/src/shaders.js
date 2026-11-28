// GLSL ES 3.00 shaders. Each droplet is stateless: its whole life (growth,
// diffusion, convective drift, Stokes fall, landing, evaporation) is evaluated
// analytically from (birth position, birth time, seed) every frame.

export const VS_DROP = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec4 aPos;   // x, y, z (cm), birth time (s)
layout(location=1) in vec4 aProp;  // size factor, seed, weight, type
uniform mat4 uViewProj;
uniform float uTime, uLife, uGrowTau, uDiff, uFall, uConv, uFloorZ;
uniform float uPxScale, uBasePx, uFocusDist, uAperture, uGain, uHalfW;
uniform float uLightZ, uLightH, uMaxPx;
uniform int uColorize;
uniform vec3 uTint;
out vec3 vColor;

uint hash(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float rnd(inout uint s) { s = hash(s); return float(s >> 8) * (1.0 / 16777216.0); }
float gauss(inout uint s) { float u1 = max(rnd(s), 1e-6); float u2 = rnd(s); return sqrt(-2.0 * log(u1)) * cos(6.2831853 * u2); }

// Slow, divergence-free convection: velocity from a sum-of-sines stream function.
#define TERM(kx, ky, w, ph, a) { vec2 k = vec2(kx, ky); v += a * cos(dot(k, p) + w * t + ph) * vec2(k.y, -k.x) / length(k); }
vec2 flow(vec2 p, float t) {
  vec2 v = vec2(0.0);
  TERM(0.17, 0.11, 0.07, 0.0, 0.45)
  TERM(-0.09, 0.23, 0.05, 1.7, 0.35)
  TERM(0.31, -0.27, 0.11, 4.1, 0.25)
  TERM(0.55, 0.47, 0.17, 2.3, 0.12)
  return v;
}

const vec3 TYPE_COL[9] = vec3[9](
  vec3(0.45, 0.45, 0.5),   // rain / background
  vec3(0.25, 0.75, 1.0),   // muon
  vec3(0.35, 1.0, 0.35),   // electron
  vec3(1.0, 0.5, 0.15),    // alpha
  vec3(1.0, 0.25, 0.8),    // proton
  vec3(1.0, 0.95, 0.25),   // delta ray
  vec3(1.0, 0.32, 0.32),   // positron
  vec3(0.72, 0.55, 1.0),   // pion
  vec3(0.3, 1.0, 0.85));   // kaon

void cull() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vColor = vec3(0.0); }

void main() {
  uint s = uint(aProp.y) * 747796405u + 2891336453u;
  float life = uLife * (0.55 + 0.9 * rnd(s));
  float tau = uGrowTau * (0.5 + rnd(s));
  float age = uTime - aPos.w;
  if (age < 0.0 || age > life) { cull(); return; }

  float grow = 1.0 - exp(-age / tau);                         // r^2 grows ~ (1 - e^-t/tau)
  float fade = 1.0 - smoothstep(0.6 * life, life, age);       // evaporation
  float sz2 = aProp.x * aProp.x;

  vec3 p = aPos.xyz;
  // small-scale turbulent mixing (molecular diffusion of formed droplets is negligible)
  p += vec3(gauss(s), gauss(s), 0.5 * gauss(s)) * sqrt(2.0 * uDiff * age);
  p.xy += flow(aPos.xy, uTime) * uConv * age;
  // Stokes fall: v ~ r^2, integrate the growth curve
  float fallen = uFall * sz2 * (age - tau * grow);
  p.z -= fallen;
  if (p.z < uFloorZ) {                                        // landed on the cold plate
    float tl = (uFloorZ - p.z) / max(uFall * sz2, 1e-3);
    p.z = uFloorZ;
    fade *= exp(-3.0 * tl);
  }

  // LED strip along the -x wall, a horizontal light sheet just above the floor
  float illum = (0.3 + 0.7 * exp(-(p.x + uHalfW) / 22.0)) * exp(-pow((p.z - uLightZ) / uLightH, 2.0));
  float I = uGain * sz2 * grow * fade * aProp.z * illum;
  if (I < 1e-4) { cull(); return; }

  vec4 clip = uViewProj * vec4(p, 1.0);
  float w = clip.w;
  float coc = uAperture * abs(w - uFocusDist) / w * uPxScale / uFocusDist;   // thin-lens blur circle (px)
  float size = min(sqrt(uBasePx * uBasePx + coc * coc), uMaxPx);
  I *= (uBasePx * uBasePx) / (size * size);

  gl_Position = clip;
  gl_PointSize = size * 1.6;
  int ty = int(aProp.w + 0.5);
  vec3 col = uColorize == 1 ? TYPE_COL[ty] : uTint;
  vColor = col * I;
}`;

export const FS_DROP = /* glsl */ `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  o = vec4(vColor * exp(-4.0 * r2), 1.0);
}`;

export const VS_QUAD = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

export const FS_BLUR = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uDir;
uniform float uClamp;
out vec4 o;
vec3 tap(vec2 uv) { return min(texture(uSrc, uv).rgb, vec3(uClamp)); }
void main() {
  const float w0 = 0.227027, w1 = 0.1945946, w2 = 0.1216216, w3 = 0.054054, w4 = 0.016216;
  vec3 c = tap(vUv) * w0;
  c += (tap(vUv + uDir) + tap(vUv - uDir)) * w1;
  c += (tap(vUv + 2.0 * uDir) + tap(vUv - 2.0 * uDir)) * w2;
  c += (tap(vUv + 3.0 * uDir) + tap(vUv - 3.0 * uDir)) * w3;
  c += (tap(vUv + 4.0 * uDir) + tap(vUv - 4.0 * uDir)) * w4;
  o = vec4(c, 1.0);
}`;

export const FS_COMPOSITE = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uHdr, uB1, uB2;
uniform float uTime, uExposure, uBloom, uFelt;
uniform vec2 uRes;
out vec4 o;
float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 q = uv * vec2(aspect, 1.0);
  vec3 c = texture(uHdr, uv).rgb + uBloom * (0.35 * texture(uB1, uv).rgb + 0.25 * texture(uB2, uv).rgb);
  // black felt floor grazed by the LED light (visible texture, strong falloff away from
  // the light) + vapour haze: matched to real footage
  float light = exp(-uv.x * 2.2);
  float felt = (0.003 + 0.016 * light) * (0.45 + 1.1 * fbm(q * 90.0));
  float haze = 0.012 * light * (0.4 + fbm(q * 2.2 + vec2(uTime * 0.012, -uTime * 0.02)));
  c = c * uExposure + uFelt * (felt + haze) * vec3(0.82, 0.9, 1.0);
  c = 1.0 - exp(-c);                                                    // filmic-ish tone curve
  c *= mix(0.5, 1.0, smoothstep(1.25, 0.35, length((uv - 0.5) * vec2(aspect, 1.0))));
  c = pow(c, vec3(1.0 / 2.2));
  c += (h12(gl_FragCoord.xy + fract(uTime * 7.31) * 913.0) - 0.5) * 0.008; // sensor grain
  o = vec4(c, 1.0);
}`;

// Absorber plate (lead): flat-shaded box faces, lit by the LED strip on the -x wall.
export const VS_PLATE = /* glsl */ `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
uniform mat4 uViewProj;
out vec3 vN; out vec3 vP;
void main() { vN = aNrm; vP = aPos; gl_Position = uViewProj * vec4(aPos, 1.0); }`;

export const FS_PLATE = /* glsl */ `#version 300 es
precision highp float;
in vec3 vN; in vec3 vP;
uniform float uHalfW;
uniform vec2 uPlateX;
out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float lit = max(0.0, dot(vN, normalize(vec3(-1.0, 0.0, 0.35))));
  float fall = 0.35 + 0.65 * exp(-(vP.x + uHalfW) / 22.0);
  float grain = 0.85 + 0.3 * h(floor(vP.yz * 40.0));
  vec3 lead = vec3(0.55, 0.57, 0.6);
  // milled edges catch the LED light: makes the slab read as solid metal, not a haze band
  float e = min(abs(vP.x - uPlateX.x), abs(vP.x - uPlateX.y));
  float edge = exp(-e / 0.06) * step(0.5, vN.z);
  o = vec4(lead * (0.012 + 0.11 * lit * fall + 0.35 * edge * fall) * grain, 1.0);
}`;
