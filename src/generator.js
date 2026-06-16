// Turn a prompt into a finished, grounded Mesh.
import { parsePrompt } from "./parser.js";
import { RNG, hashStringToSeed } from "./rng.js";
import { RECIPES, shade, C } from "./library.js";
import { Mesh, makeTransform } from "./mesh.js";
import * as P from "./primitives.js";

function scaleMesh(mesh, sx, sy, sz) {
  for (let i = 0; i < mesh.positions.length; i += 3) {
    mesh.positions[i] *= sx;
    mesh.positions[i + 1] *= sy;
    mesh.positions[i + 2] *= sz;
  }
  return mesh;
}

function styleScale(styles) {
  let sx = 1, sy = 1, sz = 1;
  if (styles.includes("tall")) sy *= 1.5;
  if (styles.includes("wide")) { sx *= 1.4; sz *= 1.4; }
  if (styles.includes("big")) { sx *= 1.4; sy *= 1.4; sz *= 1.4; }
  if (styles.includes("tiny")) { sx *= 0.6; sy *= 0.6; sz *= 0.6; }
  return [sx, sy, sz];
}

// Fallback "abstract sculpture" for prompts with no recognized object.
// Deterministic from the text so it still feels intentional.
function abstractSculpture(rng, ctx) {
  const m = new Mesh();
  const palette = ctx.color
    ? [ctx.color, shade(rng, ctx.color, 0.15), shade(rng, ctx.color, 0.25)]
    : [
        [rng.range(0.2, 0.9), rng.range(0.2, 0.9), rng.range(0.2, 0.9)],
        [rng.range(0.2, 0.9), rng.range(0.2, 0.9), rng.range(0.2, 0.9)],
      ];
  const kinds = ["box", "sphere", "cylinder", "cone", "torus", "gem"];
  const n = rng.int(4, 8);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const k = rng.pick(kinds);
    const s = rng.range(0.4, 0.9) * (1 - i * 0.05);
    const color = rng.pick(palette);
    let part;
    if (k === "box") part = P.box(s, s, s, color);
    else if (k === "sphere") part = P.sphere(s * 0.6, 16, 12, color);
    else if (k === "cylinder") part = P.cylinder(s * 0.4, s * 0.4, s, 16, color);
    else if (k === "cone") part = P.cone(s * 0.5, s, 14, color);
    else if (k === "torus") part = P.torus(s * 0.45, s * 0.18, 18, 12, color);
    else part = P.gem(s * 0.6, color);
    const rot = [rng.jitter(0.6), rng.range(0, Math.PI * 2), rng.jitter(0.6)];
    m.merge(part, makeTransform({ pos: [rng.jitter(0.3), y + s / 2, rng.jitter(0.3)], rot }));
    y += s * rng.range(0.5, 0.8);
  }
  return m;
}

// Build a single instance for a given recipe id (or abstract).
function buildOne(recipeId, rng, ctx) {
  const recipe = RECIPES[recipeId];
  const mesh = recipe ? recipe(rng, ctx) : abstractSculpture(rng, ctx);
  return mesh;
}

// Arrange `count` instances around the origin.
function arrange(count, recipeId, baseSeed, ctx) {
  const scene = new Mesh();
  if (count <= 1) {
    scene.merge(buildOne(recipeId, new RNG(baseSeed), ctx));
    return scene;
  }
  // estimate footprint from one sample
  const sample = buildOne(recipeId, new RNG(baseSeed), ctx);
  const sb = sample.bounds();
  const spacing = Math.max(sb.size[0], sb.size[2]) * 1.4 + 0.4;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  let placed = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols && placed < count; c++) {
      const inst = buildOne(recipeId, new RNG(baseSeed + placed * 9173 + 1), ctx);
      const x = (c - (cols - 1) / 2) * spacing;
      const z = (r - (rows - 1) / 2) * spacing;
      const yaw = new RNG(baseSeed + placed).range(0, Math.PI * 2);
      scene.merge(inst, makeTransform({ pos: [x, 0, z], rot: [0, yaw, 0] }));
      placed++;
    }
  }
  return scene;
}

// Main entry. Returns { mesh, intent, stats }.
export function generate(prompt, seedOverride = null) {
  const intent = parsePrompt(prompt);
  const seed = seedOverride != null
    ? (seedOverride >>> 0)
    : hashStringToSeed(intent.text || "model");

  const ctx = {
    color: intent.colors[0] || null,
    styles: intent.styles,
  };

  let mesh = arrange(intent.count, intent.object, seed, ctx);

  // apply global style scaling
  const [sx, sy, sz] = styleScale(intent.styles);
  if (sx !== 1 || sy !== 1 || sz !== 1) scaleMesh(mesh, sx, sy, sz);

  mesh.groundAndCenter();
  if (mesh.normals.length === 0 || mesh.normals.length !== mesh.positions.length) {
    mesh.computeNormals();
  }

  const stats = {
    object: intent.object || "abstract",
    count: intent.count,
    styles: intent.styles,
    color: ctx.color,
    seed,
    vertices: mesh.vertexCount,
    triangles: mesh.triangleCount,
  };
  return { mesh, intent, stats };
}

export { RECIPES };
