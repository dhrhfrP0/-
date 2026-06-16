// Recipe library: each entry builds a composite Mesh from primitives.
// Recipes take (rng, ctx) where ctx = { color, styles, palette() }.
import { Mesh, makeTransform } from "./mesh.js";
import * as P from "./primitives.js";
import { vec3 } from "./glmath.js";

// ---- color helpers ----
const C = {
  brown: [0.45, 0.30, 0.18],
  darkBrown: [0.32, 0.21, 0.12],
  green: [0.28, 0.62, 0.32],
  darkGreen: [0.18, 0.45, 0.24],
  white: [0.93, 0.94, 0.97],
  black: [0.13, 0.13, 0.16],
  gray: [0.55, 0.56, 0.60],
  red: [0.84, 0.24, 0.22],
  yellow: [0.96, 0.82, 0.28],
  orange: [0.95, 0.55, 0.18],
  blue: [0.27, 0.50, 0.86],
  skin: [0.92, 0.74, 0.60],
  glass: [0.55, 0.80, 0.92],
  metal: [0.70, 0.73, 0.78],
};

// jitter a base color slightly for organic variation
function shade(rng, base, amt = 0.06) {
  return [
    clamp01(base[0] + rng.jitter(amt)),
    clamp01(base[1] + rng.jitter(amt)),
    clamp01(base[2] + rng.jitter(amt)),
  ];
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Extrude a 2D polygon (array of [x,y], CCW) along Z into a solid prism.
function extrudePolygon(points, depth, color) {
  const m = new Mesh();
  const hz = depth / 2;
  const front = [];
  const back = [];
  for (const [x, y] of points) {
    front.push(m.addVertex([x, y, hz], [0, 0, 1], color));
  }
  for (const [x, y] of points) {
    back.push(m.addVertex([x, y, -hz], [0, 0, -1], color));
  }
  // fan triangulation (works for convex; for star/heart we accept minor concavity artifacts handled by being mostly convex)
  for (let i = 1; i < points.length - 1; i++) {
    m.addTriangle(front[0], front[i], front[i + 1]);
    m.addTriangle(back[0], back[i + 1], back[i]);
  }
  // side walls
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    m.addQuad(front[i], back[i], back[j], front[j]);
  }
  m.computeNormals();
  return m;
}

// ===================== RECIPES =====================

function tree(rng, ctx) {
  const m = new Mesh();
  const trunkH = rng.range(0.7, 1.1);
  const trunkR = rng.range(0.12, 0.18);
  m.merge(P.cylinder(trunkR, trunkR * 0.85, trunkH, 10, shade(rng, C.brown)),
    makeTransform({ pos: [0, trunkH / 2, 0] }));
  const leaf = ctx.color || shade(rng, rng.chance(0.5) ? C.green : C.darkGreen, 0.05);
  if (ctx.styles.includes("round")) {
    // blobby foliage from spheres
    const n = rng.int(3, 5);
    for (let i = 0; i < n; i++) {
      const r = rng.range(0.4, 0.6);
      m.merge(P.sphere(r, 14, 10, shade(rng, leaf)),
        makeTransform({ pos: [rng.jitter(0.3), trunkH + rng.range(0.2, 0.7), rng.jitter(0.3)] }));
    }
  } else {
    // stacked cones (pine)
    const tiers = rng.int(2, 4);
    let y = trunkH;
    for (let i = 0; i < tiers; i++) {
      const r = rng.range(0.55, 0.75) * (1 - i * 0.18);
      const h = rng.range(0.6, 0.8);
      m.merge(P.cone(r, h, 9, shade(rng, leaf)), makeTransform({ pos: [0, y + h / 2 - 0.1, 0] }));
      y += h * 0.55;
    }
  }
  return m;
}

function house(rng, ctx) {
  const m = new Mesh();
  const w = rng.range(1.2, 1.6), h = rng.range(0.9, 1.2), d = rng.range(1.1, 1.5);
  const wall = ctx.color || shade(rng, [0.85, 0.78, 0.66]);
  m.merge(P.box(w, h, d, wall), makeTransform({ pos: [0, h / 2, 0] }));
  // pyramid/hip roof
  m.merge(P.cone(Math.hypot(w, d) / 2 * 0.95, rng.range(0.6, 0.9), 4, shade(rng, C.red)),
    makeTransform({ pos: [0, h + 0.3, 0], rot: [0, Math.PI / 4, 0] }));
  // door
  m.merge(P.box(0.3, 0.5, 0.05, shade(rng, C.darkBrown)), makeTransform({ pos: [0, 0.25, d / 2 + 0.01] }));
  // windows
  for (const sx of [-1, 1]) {
    m.merge(P.box(0.25, 0.25, 0.05, C.glass), makeTransform({ pos: [sx * w * 0.28, h * 0.6, d / 2 + 0.01] }));
  }
  return m;
}

function car(rng, ctx) {
  const m = new Mesh();
  const body = ctx.color || shade(rng, [C.red, C.blue, C.yellow, [0.2, 0.2, 0.24]][rng.int(0, 3)]);
  m.merge(P.box(1.8, 0.4, 0.9, body), makeTransform({ pos: [0, 0.45, 0] }));
  m.merge(P.box(1.0, 0.4, 0.8, shade(rng, body, 0.1)), makeTransform({ pos: [-0.1, 0.8, 0] }));
  // windows hint
  m.merge(P.box(1.02, 0.3, 0.7, C.glass), makeTransform({ pos: [-0.1, 0.82, 0] }));
  // wheels (axis along X -> rotate cylinder around Z by 90deg)
  const wr = 0.26;
  for (const sx of [-0.55, 0.55]) {
    for (const sz of [-0.5, 0.5]) {
      m.merge(P.cylinder(wr, wr, 0.18, 16, C.black),
        makeTransform({ pos: [sx, wr, sz], rot: [Math.PI / 2, 0, 0] }));
    }
  }
  return m;
}

function robot(rng, ctx) {
  const m = new Mesh();
  const body = ctx.color || shade(rng, C.metal);
  m.merge(P.box(0.7, 0.9, 0.45, body), makeTransform({ pos: [0, 1.0, 0] }));
  m.merge(P.box(0.55, 0.5, 0.45, shade(rng, body, 0.08)), makeTransform({ pos: [0, 1.75, 0] }));
  // eyes
  for (const sx of [-0.12, 0.12]) {
    m.merge(P.sphere(0.06, 10, 8, shade(rng, C.blue)), makeTransform({ pos: [sx, 1.8, 0.24] }));
  }
  // antenna
  m.merge(P.cylinder(0.02, 0.02, 0.3, 6, C.gray), makeTransform({ pos: [0, 2.15, 0] }));
  m.merge(P.sphere(0.05, 8, 6, shade(rng, C.red)), makeTransform({ pos: [0, 2.32, 0] }));
  // arms & legs
  for (const sx of [-1, 1]) {
    m.merge(P.cylinder(0.08, 0.08, 0.6, 10, shade(rng, body, 0.1)),
      makeTransform({ pos: [sx * 0.5, 1.0, 0] }));
    m.merge(P.cylinder(0.1, 0.1, 0.6, 10, shade(rng, body, 0.1)),
      makeTransform({ pos: [sx * 0.2, 0.3, 0] }));
  }
  return m;
}

function snowman(rng, ctx) {
  const m = new Mesh();
  const snow = ctx.color || C.white;
  m.merge(P.sphere(0.5, 18, 14, shade(rng, snow, 0.02)), makeTransform({ pos: [0, 0.5, 0] }));
  m.merge(P.sphere(0.37, 18, 14, shade(rng, snow, 0.02)), makeTransform({ pos: [0, 1.2, 0] }));
  m.merge(P.sphere(0.28, 18, 14, shade(rng, snow, 0.02)), makeTransform({ pos: [0, 1.75, 0] }));
  // eyes & buttons
  for (const sx of [-0.1, 0.1]) m.merge(P.sphere(0.035, 8, 6, C.black), makeTransform({ pos: [sx, 1.82, 0.25] }));
  for (let i = 0; i < 3; i++) m.merge(P.sphere(0.04, 8, 6, C.black), makeTransform({ pos: [0, 1.05 + i * 0.16, 0.36] }));
  // carrot nose
  m.merge(P.cone(0.05, 0.25, 10, C.orange), makeTransform({ pos: [0, 1.74, 0.3], rot: [Math.PI / 2, 0, 0] }));
  // hat
  m.merge(P.cylinder(0.32, 0.32, 0.04, 16, C.black), makeTransform({ pos: [0, 1.98, 0] }));
  m.merge(P.cylinder(0.2, 0.2, 0.3, 16, C.black), makeTransform({ pos: [0, 2.15, 0] }));
  return m;
}

function mushroom(rng, ctx) {
  const m = new Mesh();
  const stemH = rng.range(0.5, 0.8);
  m.merge(P.cylinder(0.16, 0.2, stemH, 14, shade(rng, [0.93, 0.90, 0.82])),
    makeTransform({ pos: [0, stemH / 2, 0] }));
  const capColor = ctx.color || shade(rng, C.red);
  const cap = P.sphere(rng.range(0.45, 0.6), 18, 8, capColor);
  // squash lower half to make a dome
  for (let i = 1; i < cap.positions.length; i += 3) {
    if (cap.positions[i] < 0) cap.positions[i] *= 0.25;
  }
  cap.computeNormals();
  m.merge(cap, makeTransform({ pos: [0, stemH, 0] }));
  // spots
  for (let i = 0; i < rng.int(4, 7); i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0.15, 0.4);
    m.merge(P.sphere(0.05, 8, 6, C.white),
      makeTransform({ pos: [Math.cos(a) * r, stemH + 0.25, Math.sin(a) * r] }));
  }
  return m;
}

function rocket(rng, ctx) {
  const m = new Mesh();
  const body = ctx.color || C.white;
  const bh = rng.range(1.4, 1.9);
  m.merge(P.cylinder(0.32, 0.3, bh, 18, shade(rng, body, 0.02)), makeTransform({ pos: [0, bh / 2 + 0.2, 0] }));
  m.merge(P.cone(0.3, 0.5, 18, shade(rng, C.red)), makeTransform({ pos: [0, bh + 0.45, 0] }));
  m.merge(P.sphere(0.12, 12, 10, C.glass), makeTransform({ pos: [0, bh * 0.7, 0.3] }));
  // fins
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    m.merge(P.box(0.05, 0.45, 0.35, shade(rng, C.red)),
      makeTransform({ pos: [Math.cos(a) * 0.32, 0.42, Math.sin(a) * 0.32], rot: [0, -a, 0] }));
  }
  // exhaust flame
  m.merge(P.cone(0.22, 0.4, 12, C.orange), makeTransform({ pos: [0, 0.0, 0], rot: [Math.PI, 0, 0] }));
  return m;
}

function chair(rng, ctx) {
  const m = new Mesh();
  const wood = ctx.color || shade(rng, C.brown);
  const seatY = 0.5;
  m.merge(P.box(0.6, 0.08, 0.6, wood), makeTransform({ pos: [0, seatY, 0] }));
  m.merge(P.box(0.6, 0.6, 0.08, shade(rng, wood)), makeTransform({ pos: [0, seatY + 0.34, -0.26] }));
  for (const sx of [-0.25, 0.25]) for (const sz of [-0.25, 0.25]) {
    m.merge(P.box(0.07, seatY, 0.07, shade(rng, wood)), makeTransform({ pos: [sx, seatY / 2, sz] }));
  }
  return m;
}

function table(rng, ctx) {
  const m = new Mesh();
  const wood = ctx.color || shade(rng, C.brown);
  const topY = 0.7;
  m.merge(P.box(1.3, 0.1, 0.9, wood), makeTransform({ pos: [0, topY, 0] }));
  for (const sx of [-0.55, 0.55]) for (const sz of [-0.35, 0.35]) {
    m.merge(P.box(0.09, topY, 0.09, shade(rng, wood)), makeTransform({ pos: [sx, topY / 2, sz] }));
  }
  return m;
}

function sword(rng, ctx) {
  const m = new Mesh();
  const blade = ctx.color || C.metal;
  m.merge(P.cylinder(0.06, 0.0, 1.3, 4, shade(rng, blade)),
    makeTransform({ pos: [0, 1.1, 0], rot: [0, Math.PI / 4, 0] }));
  m.merge(P.box(0.45, 0.08, 0.08, shade(rng, C.yellow)), makeTransform({ pos: [0, 0.42, 0] }));
  m.merge(P.cylinder(0.05, 0.05, 0.32, 12, shade(rng, C.darkBrown)), makeTransform({ pos: [0, 0.24, 0] }));
  m.merge(P.sphere(0.07, 10, 8, shade(rng, C.yellow)), makeTransform({ pos: [0, 0.06, 0] }));
  return m;
}

function gem(rng, ctx) {
  const m = new Mesh();
  const color = ctx.color || shade(rng, [0.4, 0.8, 0.85]);
  const seg = rng.int(5, 8);
  m.merge(P.cone(0.5, 0.55, seg, color), makeTransform({ pos: [0, 0.85, 0] }));
  m.merge(P.cone(0.5, 0.7, seg, shade(rng, color, 0.08)), makeTransform({ pos: [0, 0.5, 0], rot: [Math.PI, 0, 0] }));
  return m;
}

function flower(rng, ctx) {
  const m = new Mesh();
  const stemH = rng.range(0.8, 1.2);
  m.merge(P.cylinder(0.04, 0.04, stemH, 8, shade(rng, C.green)), makeTransform({ pos: [0, stemH / 2, 0] }));
  // leaf
  m.merge(P.sphere(0.12, 8, 6, shade(rng, C.darkGreen)),
    makeTransform({ pos: [0.12, stemH * 0.5, 0], scale: [1.6, 0.25, 0.6] }));
  const petalColor = ctx.color || shade(rng, [C.red, C.yellow, [0.9, 0.5, 0.7], C.orange][rng.int(0, 3)]);
  const n = rng.int(5, 7);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    m.merge(P.sphere(0.16, 10, 8, petalColor),
      makeTransform({ pos: [Math.cos(a) * 0.22, stemH, Math.sin(a) * 0.22], scale: [0.7, 0.3, 0.7] }));
  }
  m.merge(P.sphere(0.14, 12, 10, shade(rng, C.yellow)), makeTransform({ pos: [0, stemH, 0] }));
  return m;
}

function castle(rng, ctx) {
  const m = new Mesh();
  const stone = ctx.color || shade(rng, [0.62, 0.62, 0.66]);
  function tower(x, z, r, h) {
    m.merge(P.cylinder(r, r, h, 16, shade(rng, stone)), makeTransform({ pos: [x, h / 2, z] }));
    m.merge(P.cone(r * 1.15, r * 1.6, 16, shade(rng, C.red)), makeTransform({ pos: [x, h + r * 0.8, z] }));
    // battlement ring
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      m.merge(P.box(0.1, 0.15, 0.1, shade(rng, stone)),
        makeTransform({ pos: [x + Math.cos(a) * r, h + 0.05, z + Math.sin(a) * r] }));
    }
  }
  // central keep
  m.merge(P.box(1.0, 1.2, 1.0, shade(rng, stone)), makeTransform({ pos: [0, 0.6, 0] }));
  tower(-0.6, -0.6, 0.28, 1.6);
  tower(0.6, -0.6, 0.28, 1.6);
  tower(-0.6, 0.6, 0.28, 1.6);
  tower(0.6, 0.6, 0.28, 1.6);
  // gate
  m.merge(P.box(0.3, 0.45, 0.06, shade(rng, C.darkBrown)), makeTransform({ pos: [0, 0.22, 0.51] }));
  return m;
}

function person(rng, ctx) {
  const m = new Mesh();
  const shirt = ctx.color || shade(rng, C.blue);
  const skin = shade(rng, C.skin, 0.03);
  m.merge(P.sphere(0.22, 16, 12, skin), makeTransform({ pos: [0, 1.55, 0] }));
  m.merge(P.capsule(0.22, 0.7, 16, shirt), makeTransform({ pos: [0, 1.05, 0] }));
  for (const sx of [-1, 1]) {
    m.merge(P.capsule(0.07, 0.6, 10, shirt), makeTransform({ pos: [sx * 0.3, 1.05, 0], rot: [0, 0, sx * 0.3] }));
    m.merge(P.capsule(0.09, 0.7, 10, shade(rng, [0.2, 0.25, 0.4])), makeTransform({ pos: [sx * 0.12, 0.4, 0] }));
  }
  return m;
}

function cat(rng, ctx) {
  const m = new Mesh();
  const fur = ctx.color || shade(rng, [[0.8, 0.6, 0.35], C.gray, [0.2, 0.2, 0.22], C.white][rng.int(0, 3)]);
  // body horizontal capsule
  m.merge(P.capsule(0.3, 1.0, 14, fur), makeTransform({ pos: [0, 0.4, 0], rot: [0, 0, Math.PI / 2] }));
  m.merge(P.sphere(0.27, 16, 12, fur), makeTransform({ pos: [0.55, 0.55, 0] }));
  // ears
  for (const sz of [-1, 1]) m.merge(P.cone(0.1, 0.18, 8, fur), makeTransform({ pos: [0.6, 0.8, sz * 0.13] }));
  // tail
  m.merge(P.capsule(0.05, 0.6, 8, shade(rng, fur)), makeTransform({ pos: [-0.55, 0.6, 0], rot: [0, 0, -0.6] }));
  // legs
  for (const sx of [-0.35, 0.35]) for (const sz of [-0.18, 0.18]) {
    m.merge(P.cylinder(0.07, 0.07, 0.4, 8, fur), makeTransform({ pos: [sx, 0.2, sz] }));
  }
  // eyes
  for (const sz of [-0.1, 0.1]) m.merge(P.sphere(0.04, 8, 6, shade(rng, C.green)), makeTransform({ pos: [0.78, 0.6, sz] }));
  return m;
}

function star(rng, ctx) {
  const color = ctx.color || shade(rng, C.yellow);
  const points = [];
  const spikes = 5;
  const outer = 0.7, inner = 0.30;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    points.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const m = extrudePolygon(points, 0.2, color);
  // lift so it sits above ground
  return shiftUp(m, 0.75);
}

function heart(rng, ctx) {
  const color = ctx.color || shade(rng, C.red);
  const points = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    points.push([x * 0.045, y * 0.045]);
  }
  const m = extrudePolygon(points, 0.3, color);
  return shiftUp(m, 0.75);
}

function donut(rng, ctx) {
  const m = new Mesh();
  const dough = ctx.color || shade(rng, [0.85, 0.6, 0.35]);
  m.merge(P.torus(0.5, 0.24, 24, 16, dough), makeTransform({ pos: [0, 0.4, 0], rot: [Math.PI / 2, 0, 0] }));
  // icing: a slightly larger flattened torus on top
  const icing = P.torus(0.5, 0.25, 24, 16, shade(rng, [0.9, 0.4, 0.6]));
  for (let i = 1; i < icing.positions.length; i += 3) if (icing.positions[i] < 0) icing.positions[i] *= 0.2;
  icing.computeNormals();
  m.merge(icing, makeTransform({ pos: [0, 0.5, 0], rot: [Math.PI / 2, 0, 0] }));
  // sprinkles
  for (let i = 0; i < 14; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rr = rng.range(0.32, 0.62);
    m.merge(P.box(0.03, 0.03, 0.1, shade(rng, [C.yellow, C.blue, C.green, C.white][rng.int(0, 3)])),
      makeTransform({ pos: [Math.cos(a) * rr, 0.6, Math.sin(a) * rr], rot: [0, rng.range(0, Math.PI), 0] }));
  }
  return m;
}

function mountain(rng, ctx) {
  const m = new Mesh();
  const rock = ctx.color || shade(rng, [0.45, 0.42, 0.40]);
  const h = rng.range(1.6, 2.2);
  m.merge(P.cone(1.1, h, rng.int(5, 7), rock), makeTransform({ pos: [0, h / 2, 0] }));
  // snow cap
  const cap = P.cone(0.45, h * 0.32, 7, C.white);
  m.merge(cap, makeTransform({ pos: [0, h * 0.84, 0] }));
  // smaller side peak
  m.merge(P.cone(0.7, h * 0.6, 6, shade(rng, rock)), makeTransform({ pos: [0.9, h * 0.3, 0.3] }));
  return m;
}

function lamp(rng, ctx) {
  const m = new Mesh();
  const pole = ctx.color || shade(rng, [0.25, 0.27, 0.30]);
  m.merge(P.cylinder(0.06, 0.08, 1.8, 12, pole), makeTransform({ pos: [0, 0.9, 0] }));
  m.merge(P.cylinder(0.18, 0.18, 0.04, 16, pole), makeTransform({ pos: [0, 0.02, 0] }));
  m.merge(P.cone(0.25, 0.3, 12, shade(rng, pole)), makeTransform({ pos: [0, 1.9, 0], rot: [Math.PI, 0, 0] }));
  m.merge(P.sphere(0.16, 14, 10, shade(rng, C.yellow)), makeTransform({ pos: [0, 1.78, 0] }));
  return m;
}

function cactus(rng, ctx) {
  const m = new Mesh();
  const green = ctx.color || shade(rng, [0.30, 0.55, 0.32]);
  const bh = rng.range(1.0, 1.5);
  m.merge(P.capsule(0.22, bh, 14, green), makeTransform({ pos: [0, bh / 2, 0] }));
  for (const sx of [-1, 1]) {
    if (rng.chance(0.8)) {
      const ay = rng.range(0.4, 0.7) * bh;
      m.merge(P.capsule(0.1, 0.4, 10, green), makeTransform({ pos: [sx * 0.22, ay, 0], rot: [0, 0, sx * Math.PI / 2] }));
      m.merge(P.capsule(0.1, 0.4, 10, green), makeTransform({ pos: [sx * 0.36, ay + 0.25, 0] }));
    }
  }
  // pot
  m.merge(P.cylinder(0.28, 0.34, 0.35, 16, shade(rng, [0.7, 0.4, 0.3])), makeTransform({ pos: [0, 0.17, 0] }));
  return m;
}

function boat(rng, ctx) {
  const m = new Mesh();
  const hull = ctx.color || shade(rng, C.brown);
  // hull from a squashed, tapered box-ish shape using a scaled half-sphere
  const h = P.sphere(0.7, 18, 10, hull);
  for (let i = 0; i < h.positions.length; i += 3) {
    if (h.positions[i + 1] > 0) h.positions[i + 1] *= 0.15; // flatten top
    h.positions[i] *= 1.5; // lengthen along x
  }
  h.computeNormals();
  m.merge(h, makeTransform({ pos: [0, 0.4, 0] }));
  // mast + sail
  m.merge(P.cylinder(0.03, 0.03, 1.2, 8, shade(rng, C.darkBrown)), makeTransform({ pos: [0, 1.0, 0] }));
  m.merge(P.box(0.02, 0.7, 0.5, C.white), makeTransform({ pos: [0.0, 1.0, 0.0], rot: [0, 0, 0] }));
  return m;
}

function bottle(rng, ctx) {
  const m = new Mesh();
  const glass = ctx.color || shade(rng, [0.3, 0.6, 0.45]);
  m.merge(P.cylinder(0.28, 0.28, 0.8, 18, glass), makeTransform({ pos: [0, 0.4, 0] }));
  m.merge(P.cylinder(0.28, 0.1, 0.25, 18, shade(rng, glass)), makeTransform({ pos: [0, 0.92, 0] }));
  m.merge(P.cylinder(0.1, 0.1, 0.25, 14, shade(rng, glass)), makeTransform({ pos: [0, 1.15, 0] }));
  m.merge(P.cylinder(0.11, 0.11, 0.08, 14, shade(rng, C.brown)), makeTransform({ pos: [0, 1.3, 0] }));
  return m;
}

function shiftUp(m, dy) {
  for (let i = 1; i < m.positions.length; i += 3) m.positions[i] += dy;
  return m;
}

export const RECIPES = {
  tree, house, car, robot, snowman, mushroom, rocket, chair, table, sword,
  gem, flower, castle, person, cat, star, heart, donut, mountain, lamp,
  cactus, boat, bottle,
};

export { shade, extrudePolygon, C, shiftUp };
