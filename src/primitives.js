// Parametric primitive mesh builders. Each returns a fresh Mesh.
import { Mesh } from "./mesh.js";
import { vec3 } from "./glmath.js";

const WHITE = [1, 1, 1];

// Box centered at origin with width(x) height(y) depth(z).
export function box(w = 1, h = 1, d = 1, color = WHITE) {
  const m = new Mesh();
  const x = w / 2, y = h / 2, z = d / 2;
  const faces = [
    { n: [0, 0, 1], v: [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]] },
    { n: [0, 0, -1], v: [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]] },
    { n: [1, 0, 0], v: [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]] },
    { n: [-1, 0, 0], v: [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]] },
    { n: [0, 1, 0], v: [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]] },
    { n: [0, -1, 0], v: [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]] },
  ];
  for (const f of faces) {
    const a = m.addVertex(f.v[0], f.n, color);
    const b = m.addVertex(f.v[1], f.n, color);
    const c = m.addVertex(f.v[2], f.n, color);
    const dd = m.addVertex(f.v[3], f.n, color);
    m.addQuad(a, b, c, dd);
  }
  return m;
}

// UV sphere of given radius, centered at origin.
export function sphere(radius = 0.5, segments = 18, rings = 14, color = WHITE) {
  const m = new Mesh();
  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = v * Math.PI;
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const theta = u * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      m.addVertex([nx * radius, ny * radius, nz * radius], [nx, ny, nz], color);
    }
  }
  const stride = segments + 1;
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * stride + x;
      const b = a + stride;
      m.addQuad(a, a + 1, b + 1, b);
    }
  }
  return m;
}

// Cylinder along Y. Set radiusTop=0 for a cone, or different radii for a frustum.
export function cylinder(radiusBottom = 0.5, radiusTop = 0.5, height = 1, segments = 20, color = WHITE, caps = true) {
  const m = new Mesh();
  const half = height / 2;
  const slope = radiusBottom - radiusTop;
  const nlen = Math.hypot(slope, height) || 1;
  for (let x = 0; x <= segments; x++) {
    const u = x / segments;
    const theta = u * Math.PI * 2;
    const cos = Math.cos(theta), sin = Math.sin(theta);
    // side normal accounts for the cone slope
    const n = vec3.normalize([cos * height / nlen, slope / nlen, sin * height / nlen]);
    m.addVertex([cos * radiusBottom, -half, sin * radiusBottom], n, color);
    m.addVertex([cos * radiusTop, half, sin * radiusTop], n, color);
  }
  for (let x = 0; x < segments; x++) {
    const a = x * 2;
    m.addQuad(a, a + 2, a + 3, a + 1);
  }
  if (caps) {
    if (radiusBottom > 1e-6) addCap(m, radiusBottom, -half, [0, -1, 0], segments, color, false);
    if (radiusTop > 1e-6) addCap(m, radiusTop, half, [0, 1, 0], segments, color, true);
  }
  return m;
}

function addCap(m, radius, y, normal, segments, color, ccw) {
  const center = m.addVertex([0, y, 0], normal, color);
  const ring = [];
  for (let x = 0; x <= segments; x++) {
    const theta = (x / segments) * Math.PI * 2;
    ring.push(m.addVertex([Math.cos(theta) * radius, y, Math.sin(theta) * radius], normal, color));
  }
  for (let x = 0; x < segments; x++) {
    if (ccw) m.addTriangle(center, ring[x], ring[x + 1]);
    else m.addTriangle(center, ring[x + 1], ring[x]);
  }
}

export function cone(radius = 0.5, height = 1, segments = 20, color = WHITE) {
  return cylinder(radius, 0, height, segments, color, true);
}

// Torus in the XZ plane.
export function torus(radius = 0.5, tube = 0.2, radialSeg = 20, tubularSeg = 14, color = WHITE) {
  const m = new Mesh();
  for (let j = 0; j <= radialSeg; j++) {
    const u = (j / radialSeg) * Math.PI * 2;
    for (let i = 0; i <= tubularSeg; i++) {
      const v = (i / tubularSeg) * Math.PI * 2;
      const cx = Math.cos(u), cz = Math.sin(u);
      const px = (radius + tube * Math.cos(v)) * cx;
      const py = tube * Math.sin(v);
      const pz = (radius + tube * Math.cos(v)) * cz;
      const n = vec3.normalize([Math.cos(v) * cx, Math.sin(v), Math.cos(v) * cz]);
      m.addVertex([px, py, pz], n, color);
    }
  }
  const stride = tubularSeg + 1;
  for (let j = 0; j < radialSeg; j++) {
    for (let i = 0; i < tubularSeg; i++) {
      const a = j * stride + i;
      const b = a + stride;
      m.addQuad(a, b, b + 1, a + 1);
    }
  }
  return m;
}

// Flat plane on the XZ plane (faces up).
export function plane(w = 1, d = 1, color = WHITE) {
  const m = new Mesh();
  const x = w / 2, z = d / 2;
  const n = [0, 1, 0];
  const a = m.addVertex([-x, 0, z], n, color);
  const b = m.addVertex([x, 0, z], n, color);
  const c = m.addVertex([x, 0, -z], n, color);
  const dd = m.addVertex([-x, 0, -z], n, color);
  m.addQuad(a, b, c, dd);
  return m;
}

// Low-poly icosphere-ish gem: a sphere with few segments reads as faceted.
export function gem(radius = 0.5, color = WHITE) {
  const m = sphere(radius, 7, 5, color);
  return m;
}

// Capsule along Y (cylinder + two hemispheres) approximated with a stretched sphere region.
export function capsule(radius = 0.4, height = 1, segments = 16, color = WHITE) {
  const m = new Mesh();
  const cylHalf = Math.max(0, height / 2 - radius);
  const rings = 12;
  const verts = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = v * Math.PI;
    // shift top half up and bottom half down to insert the cylinder body
    const yOffset = Math.cos(phi) >= 0 ? cylHalf : -cylHalf;
    const row = [];
    for (let x = 0; x <= segments; x++) {
      const theta = (x / segments) * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      row.push(m.addVertex([nx * radius, ny * radius + yOffset, nz * radius], [nx, ny, nz], color));
    }
    verts.push(row);
  }
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      m.addQuad(verts[y][x], verts[y][x + 1], verts[y + 1][x + 1], verts[y + 1][x]);
    }
  }
  return m;
}
