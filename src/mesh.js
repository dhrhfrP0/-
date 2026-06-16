// Mesh: indexed triangle geometry with per-vertex position, normal and color.
import { mat4, transformPoint, transformDir, vec3 } from "./glmath.js";

export class Mesh {
  constructor() {
    this.positions = []; // flat [x,y,z, ...]
    this.normals = [];   // flat [x,y,z, ...]
    this.colors = [];    // flat [r,g,b, ...] in 0..1
    this.indices = [];   // flat [i0,i1,i2, ...]
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  get triangleCount() {
    return this.indices.length / 3;
  }

  // Add one vertex, returns its index.
  addVertex(p, n = [0, 1, 0], c = [1, 1, 1]) {
    const idx = this.positions.length / 3;
    this.positions.push(p[0], p[1], p[2]);
    this.normals.push(n[0], n[1], n[2]);
    this.colors.push(c[0], c[1], c[2]);
    return idx;
  }

  addTriangle(a, b, c) {
    this.indices.push(a, b, c);
  }

  // Add a quad (CCW): a-b-c-d -> two triangles.
  addQuad(a, b, c, d) {
    this.indices.push(a, b, c, a, c, d);
  }

  // Paint every vertex a single color.
  paint(color) {
    for (let i = 0; i < this.colors.length; i += 3) {
      this.colors[i] = color[0];
      this.colors[i + 1] = color[1];
      this.colors[i + 2] = color[2];
    }
    return this;
  }

  // Merge another mesh (already in its own local space) into this one,
  // optionally transformed by a 4x4 matrix.
  merge(other, matrix = null) {
    const base = this.vertexCount;
    const nmat = matrix ? mat4.normalFromMat4(matrix) : null;
    for (let i = 0; i < other.positions.length; i += 3) {
      let p = [other.positions[i], other.positions[i + 1], other.positions[i + 2]];
      let n = [other.normals[i], other.normals[i + 1], other.normals[i + 2]];
      if (matrix) {
        p = transformPoint(matrix, p);
        n = vec3.normalize([
          nmat[0] * n[0] + nmat[3] * n[1] + nmat[6] * n[2],
          nmat[1] * n[0] + nmat[4] * n[1] + nmat[7] * n[2],
          nmat[2] * n[0] + nmat[5] * n[1] + nmat[8] * n[2],
        ]);
      }
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(n[0], n[1], n[2]);
    }
    for (let i = 0; i < other.colors.length; i++) this.colors.push(other.colors[i]);
    for (let i = 0; i < other.indices.length; i++) this.indices.push(other.indices[i] + base);
    return this;
  }

  // Recompute smooth vertex normals from face geometry.
  computeNormals() {
    const n = new Array(this.positions.length).fill(0);
    for (let i = 0; i < this.indices.length; i += 3) {
      const ia = this.indices[i] * 3;
      const ib = this.indices[i + 1] * 3;
      const ic = this.indices[i + 2] * 3;
      const a = [this.positions[ia], this.positions[ia + 1], this.positions[ia + 2]];
      const b = [this.positions[ib], this.positions[ib + 1], this.positions[ib + 2]];
      const c = [this.positions[ic], this.positions[ic + 1], this.positions[ic + 2]];
      const cross = vec3.cross(vec3.sub(b, a), vec3.sub(c, a));
      for (const base of [ia, ib, ic]) {
        n[base] += cross[0];
        n[base + 1] += cross[1];
        n[base + 2] += cross[2];
      }
    }
    for (let i = 0; i < n.length; i += 3) {
      const v = vec3.normalize([n[i], n[i + 1], n[i + 2]]);
      this.normals[i] = v[0];
      this.normals[i + 1] = v[1];
      this.normals[i + 2] = v[2];
    }
    return this;
  }

  // Axis-aligned bounding box {min,max,center,size}.
  bounds() {
    if (this.positions.length === 0) {
      return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], size: [0, 0, 0], radius: 0 };
    }
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = this.positions[i + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
    const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const radius = vec3.length(size) / 2;
    return { min, max, center, size, radius };
  }

  // Drop the model so its lowest point sits on y=0, centered on x/z.
  groundAndCenter() {
    const b = this.bounds();
    const dx = -b.center[0];
    const dz = -b.center[2];
    const dy = -b.min[1];
    for (let i = 0; i < this.positions.length; i += 3) {
      this.positions[i] += dx;
      this.positions[i + 1] += dy;
      this.positions[i + 2] += dz;
    }
    return this;
  }
}

// Convenience: build a transform from translation, uniform/non-uniform scale, euler rotation.
export function makeTransform({ pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0] } = {}) {
  if (typeof scale === "number") scale = [scale, scale, scale];
  let m = mat4.translation(pos[0], pos[1], pos[2]);
  if (rot[1]) m = mat4.multiply(m, mat4.rotationY(rot[1]));
  if (rot[0]) m = mat4.multiply(m, mat4.rotationX(rot[0]));
  if (rot[2]) m = mat4.multiply(m, mat4.rotationZ(rot[2]));
  m = mat4.multiply(m, mat4.scaling(scale[0], scale[1], scale[2]));
  return m;
}
