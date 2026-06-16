// Headless validation of the generation engine (no browser needed).
// Verifies every recipe produces finite, non-empty, well-formed geometry
// and that all three exporters succeed.
import { generate, RECIPES } from "../src/generator.js";
import { toOBJ, toSTL, toGLTF } from "../src/exporter.js";

// Polyfill btoa for the glTF exporter under Node.
if (typeof globalThis.btoa === "undefined") {
  globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
}

let failures = 0;
const assert = (cond, msg) => {
  if (!cond) { console.error("  ✗ " + msg); failures++; }
};

function checkMesh(label, mesh) {
  assert(mesh.vertexCount > 0, `${label}: has vertices`);
  assert(mesh.triangleCount > 0, `${label}: has triangles`);
  assert(mesh.positions.length === mesh.normals.length, `${label}: pos/normal count match`);
  assert(mesh.positions.length === mesh.colors.length, `${label}: pos/color count match`);
  // all finite
  let finite = true;
  for (const v of mesh.positions) if (!Number.isFinite(v)) finite = false;
  for (const v of mesh.normals) if (!Number.isFinite(v)) finite = false;
  assert(finite, `${label}: all coordinates finite`);
  // indices in range
  let inRange = true;
  for (const i of mesh.indices) if (i < 0 || i >= mesh.vertexCount) inRange = false;
  assert(inRange, `${label}: indices in range`);
  // colors in 0..1
  let colorsOk = true;
  for (const c of mesh.colors) if (c < -0.001 || c > 1.001) colorsOk = false;
  assert(colorsOk, `${label}: colors in [0,1]`);
}

console.log("Recipes:");
for (const id of Object.keys(RECIPES)) {
  const { mesh, stats } = generate(id);
  checkMesh(id, mesh);
  // exporters must not throw and must produce content
  assert(toOBJ(mesh).length > 50, `${id}: OBJ export`);
  assert(toSTL(mesh).length > 50, `${id}: STL export`);
  const gltf = toGLTF(mesh);
  assert(gltf.length > 50, `${id}: glTF export`);
  JSON.parse(gltf); // valid JSON
  console.log(`  ✓ ${id.padEnd(10)} v=${stats.vertices} t=${stats.triangles}`);
}

console.log("\nPrompt parsing & features:");
const cases = [
  ["빨간 자동차", "car"],
  ["blue robot", "robot"],
  ["키 큰 소나무 나무 3그루", "tree"],
  ["황금 보석", "gem"],
  ["눈사람", "snowman"],
  ["보라색 추상 무늬 덩어리", "abstract"], // unknown -> abstract fallback
];
for (const [prompt, expected] of cases) {
  const { stats } = generate(prompt);
  assert(stats.object === expected, `"${prompt}" -> ${expected} (got ${stats.object})`);
  console.log(`  ✓ "${prompt}" -> ${stats.object}, count=${stats.count}, styles=[${stats.styles}]`);
}

// determinism: same prompt+seed => identical geometry
const a = generate("파란 로봇", 12345).mesh.positions;
const b = generate("파란 로봇", 12345).mesh.positions;
assert(JSON.stringify(a) === JSON.stringify(b), "deterministic with fixed seed");
console.log("  ✓ deterministic with fixed seed");

// count produces multiple instances (more geometry than one)
const one = generate("tree", 7).stats.triangles;
const five = generate("tree 5", 7).stats.triangles;
assert(five > one, `count multiplies geometry (1->${one}, 5->${five})`);
console.log(`  ✓ count multiplies geometry (1 tree=${one} tris, 5 trees=${five} tris)`);

console.log(failures === 0 ? "\n✅ ALL PASSED" : `\n❌ ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
