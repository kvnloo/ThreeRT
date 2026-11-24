// The path tracer's BSDF, sampling and phase function on the CPU, in doubles, for layer A's GPU-free analytic tests
// (docs/ROADMAP.md § 3; tools/analytic/test). Each function mirrors one of renderer/shaders/pathtrace.wgsl's (or of
// renderer/src/lib.rs's tables) line by line, under its name. `PINS` holds a hash of each source function's text:
// test/sync.test.ts fails when one changes, so the mirror is updated with it.
//
// Not mirrored: the coat, the textures and normal maps, the per-light specular scale, cutouts. The shading normal is
// +z and the geometric normal the same.

export type V3 = [number, number, number];

const PI = Math.PI;

export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const normalize = (a: V3): V3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** WGSL `reflect(e1, e2)`. */
export const reflect = (e: V3, n: V3): V3 => add(e, scale(n, -2 * dot(n, e)));

/** WGSL `refract(e1, e2, e3)`: the zero vector at total internal reflection. */
export function refract(e: V3, n: V3, eta: number): V3 {
  const d = dot(n, e);
  const k = 1 - eta * eta * (1 - d * d);
  if (k < 0) return [0, 0, 0];
  return add(scale(e, eta), scale(n, -(eta * d + Math.sqrt(k))));
}

/** A direction at (cosine `mu`, azimuth `phi`) about +z. */
export const dir = (mu: number, phi: number): V3 => {
  const s = Math.sqrt(Math.max(0, 1 - mu * mu));
  return [s * Math.cos(phi), s * Math.sin(phi), mu];
};

export function d_ggx(a2: number, noh: number) {
  const d = (noh * a2 - noh) * noh + 1;
  return a2 / (PI * d * d);
}

export function vis_smith_joint_approx(a2: number, nov: number, nol: number) {
  const a = Math.sqrt(a2);
  const v = nol * (nov * (1 - a) + a);
  const l = nov * (nol * (1 - a) + a);
  return 0.5 / Math.max(v + l, 1e-7);
}

/** Grey: one channel of the kernel's vec3. */
export function f_schlick(f0: number, f90: number, voh: number) {
  return f0 + (f90 - f0) * Math.pow(1 - voh, 5);
}

export function g1(a2: number, nov: number) {
  return (2 * nov) / (nov + Math.sqrt(a2 + (1 - a2) * nov * nov));
}

export function lambda_ggx(a2: number, c: number) {
  const c2 = c * c;
  return 0.5 * (Math.sqrt(1 + (a2 * (1 - c2)) / Math.max(c2, 1e-8)) - 1);
}

export function fresnel_dielectric(c: number, eta: number) {
  const g2 = eta * eta - 1 + c * c;
  if (g2 <= 0) return 1;
  const g = Math.sqrt(g2);
  const a = (g - c) / (g + c);
  const b = (c * (g + c) - 1) / (c * (g - c) + 1);
  return 0.5 * a * a * (1 + b * b);
}

export function hg_phase(g: number, c: number) {
  const d = 1 + g * g - 2 * g * c;
  return (1 - g * g) / (4 * PI * d * Math.sqrt(d));
}

/** Columns (t, b, n): `basis(n)`. */
export function basis(n: V3): [V3, V3, V3] {
  const sgn = n[2] >= 0 ? 1 : -1;
  const a = -1 / (sgn + n[2]);
  const b = n[0] * n[1] * a;
  return [[1 + sgn * n[0] * n[0] * a, sgn * b, -sgn * n[0]], [b, sgn + n[1] * n[1] * a, -n[1]], n];
}
const mul = (m: [V3, V3, V3], v: V3): V3 => add(add(scale(m[0], v[0]), scale(m[1], v[1])), scale(m[2], v[2]));
const mulT = (m: [V3, V3, V3], v: V3): V3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];

/** Heitz 2018 VNDF sampling (isotropic): the world-space half vector. */
export function sample_vndf(v: V3, tbn: [V3, V3, V3], alpha: number, u1: number, u2: number): V3 {
  const vl = mulT(tbn, v);
  const vh = normalize([alpha * vl[0], alpha * vl[1], vl[2]]);
  const lensq = vh[0] * vh[0] + vh[1] * vh[1];
  const t1: V3 = lensq > 0 ? scale([-vh[1], vh[0], 0], 1 / Math.sqrt(lensq)) : [1, 0, 0];
  const t2 = cross(vh, t1);
  const r = Math.sqrt(u1);
  const phi = 2 * PI * u2;
  const p1 = r * Math.cos(phi);
  let p2 = r * Math.sin(phi);
  const s = 0.5 * (1 + vh[2]);
  p2 = (1 - s) * Math.sqrt(1 - p1 * p1) + s * p2;
  const nh = add(add(scale(t1, p1), scale(t2, p2)), scale(vh, Math.sqrt(Math.max(0, 1 - p1 * p1 - p2 * p2))));
  const hl = normalize([alpha * nh[0], alpha * nh[1], Math.max(0, nh[2])]);
  return mul(tbn, hl);
}

/** A direction scattered from `d` by Henyey-Greenstein `g`: `sample_hg`, its random numbers given. */
export function sample_hg(d: V3, g: number, u: number, w: number): V3 {
  let ct = 1 - 2 * u;
  if (Math.abs(g) > 1e-3) {
    const q = (1 - g * g) / (1 - g + 2 * g * u);
    ct = (1 + g * g - q * q) / (2 * g);
  }
  const st = Math.sqrt(Math.max(0, 1 - ct * ct));
  const phi = 2 * PI * w;
  return mul(basis(d), [st * Math.cos(phi), st * Math.sin(phi), ct]);
}

// ---------------------------------------------------------------------------------------------------------------------
// The GGX energy table (lib.rs `energy_lut`, computed in doubles here) and its lookup.

let lutCache: Float64Array | undefined;

/** lib.rs `energy_lut`: 32 x 32 (E.x, E.y), row = roughness, column = cos(view). */
export function energy_lut(): Float64Array {
  if (lutCache) return lutCache;
  const n = 32;
  const vals = new Float64Array(n * n * 2);
  for (let ry = 0; ry < n; ry++) {
    const roughness = Math.max(ry / (n - 1), 0.02);
    const a = roughness * roughness;
    const a2 = a * a;
    for (let vx = 0; vx < n; vx++) {
      const nov = Math.max(vx / (n - 1), 1e-3);
      const v: V3 = [Math.sqrt(1 - nov * nov), 0, nov];
      let ex = 0, ey = 0;
      const samples = 1024;
      for (let i = 0; i < samples; i++) {
        const u1 = (i + 0.5) / samples;
        const u2 = reverseBits(i) / 4294967296;
        const phi = 2 * PI * u2;
        const cosT = Math.sqrt((1 - u1) / (1 + (a2 - 1) * u1));
        const sinT = Math.sqrt(1 - cosT * cosT);
        const hv: V3 = [sinT * Math.cos(phi), sinT * Math.sin(phi), cosT];
        const l = add(scale(hv, 2 * dot(v, hv)), scale(v, -1));
        const nol = l[2], noh = hv[2], voh = dot(v, hv);
        if (nol > 0 && voh > 0) {
          const visV = nol * (nov * (1 - a) + a);
          const visL = nov * (nol * (1 - a) + a);
          const vis = 0.5 / (visV + visL);
          const est = (vis * nol * 4 * voh) / noh;
          ex += est;
          ey += est * Math.pow(1 - voh, 5);
        }
      }
      vals[2 * (ry * n + vx)] = Math.min(ex / samples, 1);
      vals[2 * (ry * n + vx) + 1] = ey / samples;
    }
  }
  return (lutCache = vals);
}

function reverseBits(x: number) {
  let r = 0;
  for (let i = 0; i < 32; i++) r = r * 2 + ((x >>> i) & 1);
  return r;
}

function lut(x: number, y: number): [number, number] {
  const t = energy_lut(), i = y * 32 + x;
  return [t[2 * i], t[2 * i + 1]];
}

export function energy_lookup(roughness: number, nov: number): [number, number] {
  const x = clamp(nov * 31, 0, 31);
  const y = clamp(roughness * 31, 0, 31);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, 31), y1 = Math.min(y0 + 1, 31);
  const fx = x - x0, fy = y - y0;
  const [a0, a1] = [lut(x0, y0), lut(x1, y0)];
  const [b0, b1] = [lut(x0, y1), lut(x1, y1)];
  const ax = mix(a0[0], a1[0], fx), ay = mix(a0[1], a1[1], fx);
  const bx = mix(b0[0], b1[0], fx), by = mix(b0[1], b1[1], fx);
  return [mix(ax, bx, fy), mix(ay, by, fy)];
}

/** lib.rs `glass_energy`: R + T of a rough dielectric interface toward cos(view) `mu`, by n x n visible normals. */
export function glass_energy(mu: number, alpha: number, eta: number, n: number) {
  const a2 = alpha * alpha;
  const lambda = (c: number) => {
    c = Math.min(Math.abs(c), 1);
    return 0.5 * (-1 + Math.sqrt(1 + (a2 * (1 - c * c)) / (c * c)));
  };
  const v = [Math.sqrt(Math.max(1 - mu * mu, 0)), 0, mu];
  const k = Math.sqrt(alpha * alpha * v[0] * v[0] + v[2] * v[2]);
  const vh = [(alpha * v[0]) / k, 0, v[2] / k];
  const t2 = [-vh[2], 0, vh[0]];
  const lv = lambda(mu), s = 0.5 * (1 + vh[2]);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const r = Math.sqrt((i + 0.5) / n), phi = (2 * PI * (j + 0.5)) / n;
      const p1 = r * Math.cos(phi);
      const p2 = (1 - s) * Math.sqrt(Math.max(1 - p1 * p1, 0)) + s * r * Math.sin(phi);
      const pz = Math.sqrt(Math.max(1 - p1 * p1 - p2 * p2, 0));
      const nh = [p2 * t2[0] + pz * vh[0], p1, p2 * t2[2] + pz * vh[2]];
      let m = [alpha * nh[0], alpha * nh[1], Math.max(nh[2], 0)];
      const len = Math.hypot(m[0], m[1], m[2]);
      m = [m[0] / len, m[1] / len, m[2] / len];
      const vm = v[0] * m[0] + v[2] * m[2];
      const f = fresnel_dielectric(vm, eta);
      const nol = 2 * vm * m[2] - v[2];
      if (nol > 0) {
        const g2 = (2 * mu * nol) / Math.max(nol * (mu * (1 - alpha) + alpha) + mu * (nol * (1 - alpha) + alpha), 1e-7);
        sum += f * g2 * (1 + lv);
      }
      const c2 = 1 - (1 - vm * vm) / (eta * eta);
      if (f < 1 && c2 > 0) {
        const lz = (vm / eta - Math.sqrt(c2)) * m[2] - v[2] / eta;
        if (lz < 0) sum += ((1 - f) * (1 + lv)) / (1 + lv + lambda(lz));
      }
    }
  }
  return sum / (n * n);
}

// ---------------------------------------------------------------------------------------------------------------------
// The opaque base (`lobes`, `eval_bsdf_k`, `pdf_bsdf`, `sample_bsdf` without the coat and the glass).

export interface BaseMaterial { base: number; metallic: number; specular: number; roughness: number }
export interface BaseLobes { diffuse: number; f0: number; f90: number; w: number; e_spec: number; kd: number; a2: number; p_spec: number; roughness: number }

/** `lobes` (and `surface`'s clamps) for a grey opaque material; `comp` = P.misc.z, the energy compensation. */
export function base_lobes(m: BaseMaterial, nov: number, comp = 1): BaseLobes {
  const roughness = clamp(m.roughness, 0.02, 1), metallic = clamp(m.metallic, 0, 1);
  const diffuse = m.base * (1 - metallic);
  const f0 = mix(0.08 * m.specular, m.base, metallic);
  const f90 = clamp(50 * f0, 0, 1);
  const e = energy_lookup(roughness, nov);
  const w = 1 + comp * f0 * ((1 - e[0]) / e[0]);
  const e_spec = w * (e[0] * f0 + e[1] * (f90 - f0));
  const kd = 1 - e_spec;
  const ws = e_spec, wd = diffuse * kd;
  let p_spec = clamp(ws / Math.max(ws + wd, 1e-6), 0.05, 1);
  if (wd <= 0) p_spec = 1;
  return { diffuse, f0, f90, w, e_spec, kd, a2: roughness ** 4, p_spec, roughness };
}

/** `eval_bsdf`: BSDF x n.l. */
export function eval_base(lb: BaseLobes, v: V3, l: V3) {
  const nol = l[2];
  const nov = Math.max(v[2], 1e-4);
  if (nol <= 0) return 0;
  const h = normalize(add(v, l));
  const noh = Math.max(h[2], 0), voh = Math.max(dot(v, h), 0);
  const dv = d_ggx(lb.a2, noh) * vis_smith_joint_approx(lb.a2, nov, nol);
  const spec = dv * f_schlick(lb.f0, lb.f90, voh) * lb.w;
  const diff = lb.diffuse * (1 / PI) * lb.kd;
  return (diff + spec) * nol;
}

/** `pdf_spec`: the density of l under VNDF sampling of the specular lobe (any l; reflections under the horizon
 *  included). */
export function pdf_spec(a2: number, v: V3, l: V3) {
  const nov = Math.max(v[2], 1e-4);
  const noh = Math.max(normalize(add(v, l))[2], 0);
  return (g1(a2, nov) * d_ggx(a2, noh)) / (4 * nov);
}

/** `pdf_bsdf`. */
export function pdf_base(lb: BaseLobes, v: V3, l: V3) {
  const nol = l[2];
  if (nol <= 0) return 0;
  const nov = Math.max(v[2], 1e-4);
  const h = normalize(add(v, l));
  const noh = Math.max(h[2], 0), voh = Math.max(dot(v, h), 1e-6);
  const dv = (g1(lb.a2, nov) * voh * d_ggx(lb.a2, noh)) / nov;
  const ps = dv / (4 * voh), pd = nol / PI;
  return lb.p_spec * ps + (1 - lb.p_spec) * pd;
}

/** `sample_bsdf`, its random numbers (r.y, r.z, r.w) given. Reflections under the horizon are returned as they are
 *  (the kernel's eval and pdf give them 0). */
export function sample_base(lb: BaseLobes, v: V3, ry: number, rz: number, rw: number): V3 {
  const tbn = basis([0, 0, 1]);
  if (ry < lb.p_spec) return reflect(scale(v, -1), sample_vndf(v, tbn, lb.roughness * lb.roughness, rz, rw));
  const rr = Math.sqrt(rz), phi = 2 * PI * rw;
  return mul(tbn, [rr * Math.cos(phi), rr * Math.sin(phi), Math.sqrt(Math.max(0, 1 - rr * rr))]);
}

// ---------------------------------------------------------------------------------------------------------------------
// The dielectric alone (a rough glass of transmission 1, base white, no coat): p_trans = 1.

export interface Glass { a2: number; roughness: number; eta: number; t: number }

/** `lobes` for it: `eta` = n(far side) / n(view side); `comp` = P.misc.z. */
export function glass_lobes(roughness: number, ior: number, front: boolean, nov: number, comp = 1): Glass {
  const r = clamp(roughness, 0.02, 1);
  const eta = front ? ior : 1 / ior;
  // (The kernel reads the table, `glass_energy(nov, roughness, ior, leaving)`; here its estimator, between nodes.)
  const t = mix(1, 1 / glass_energy(Math.max(nov, 1e-3), r * r, eta, 48), comp);
  return { a2: r ** 4, roughness: r, eta, t };
}

/** `dielectric_t`: transmission x |n.l| (nov, nol: |cosines|). */
export function dielectric_t(g: Glass, v: V3, l: V3, nov: number, nol: number) {
  let h = normalize(add(v, scale(l, g.eta)));
  if (h[2] < 0) h = scale(h, -1);
  const voh = dot(v, h), loh = dot(l, h);
  if (voh <= 0 || loh >= 0) return 0;
  const den = voh + g.eta * loh;
  const g2 = 1 / (1 + lambda_ggx(g.a2, nov) + lambda_ggx(g.a2, nol));
  return g.t * (((1 - fresnel_dielectric(voh, g.eta)) * d_ggx(g.a2, Math.max(h[2], 0)) * g2 * voh * g.eta * g.eta * -loh) / (nov * Math.max(den * den, 1e-12)));
}

/** `eval_bsdf` for it: the reflection off the microfacets, or `dielectric_t` under the surface. */
export function eval_glass(g: Glass, v: V3, l: V3) {
  const nol = l[2];
  const nov = Math.max(v[2], 1e-4);
  if (nol < 0) return dielectric_t(g, v, l, nov, -nol);
  if (nol <= 0) return 0;
  const h = normalize(add(v, l));
  const noh = Math.max(h[2], 0), voh = Math.max(dot(v, h), 0);
  const dv = d_ggx(g.a2, noh) * vis_smith_joint_approx(g.a2, nov, nol);
  return g.t * fresnel_dielectric(voh, g.eta) * dv * nol;
}

/** `pdf_dielectric` (p_trans = 1). */
export function pdf_glass(g: Glass, v: V3, l: V3) {
  const nov = Math.max(v[2], 1e-4);
  if (l[2] > 0) {
    const h = normalize(add(v, l));
    const voh = Math.max(dot(v, h), 1e-6);
    const f = fresnel_dielectric(voh, g.eta);
    return (f * g1(g.a2, nov) * d_ggx(g.a2, Math.max(h[2], 0))) / (4 * nov);
  }
  let h = normalize(add(v, scale(l, g.eta)));
  if (h[2] < 0) h = scale(h, -1);
  const voh = dot(v, h), loh = dot(l, h);
  if (voh <= 0 || loh >= 0) return 0;
  const den = voh + g.eta * loh;
  return ((1 - fresnel_dielectric(voh, g.eta)) * g1(g.a2, nov) * voh * d_ggx(g.a2, Math.max(h[2], 0)) * g.eta * g.eta * -loh) / (nov * Math.max(den * den, 1e-12));
}

/** `sample_bsdf`'s dielectric branch, its random numbers (u - p_coat, r.z, r.w) given; null: no sample. */
export function sample_glass(g: Glass, v: V3, u: number, rz: number, rw: number): V3 | null {
  const n: V3 = [0, 0, 1];
  const h = sample_vndf(v, basis(n), g.roughness * g.roughness, rz, rw);
  const m = h;
  const t = refract(scale(v, -1), m, 1 / g.eta);
  const spec = u < fresnel_dielectric(Math.max(dot(v, m), 1e-4), g.eta) || (t[0] === 0 && t[1] === 0 && t[2] === 0);
  if (spec) {
    const rl = reflect(scale(v, -1), h);
    return rl[2] <= 0 ? null : rl;
  }
  return t[2] >= 0 ? null : t;
}

// ---------------------------------------------------------------------------------------------------------------------

/** Hashes (test/sync.test.ts `fingerprint`) of the source functions mirrored here, by file and name. */
export const PINS: Record<string, Record<string, string>> = {
  "renderer/shaders/pathtrace.wgsl": {},
  "renderer/src/lib.rs": {},
};
