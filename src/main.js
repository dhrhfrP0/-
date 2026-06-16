// App bootstrap: wires the prompt UI to the generator, viewer and exporters.
import { generate } from "./generator.js";
import { Viewer } from "./webgl-viewer.js";
import { toOBJ, toSTL, toGLTF } from "./exporter.js";

const $ = (sel) => document.querySelector(sel);

let viewer;
let current = null; // { mesh, stats, name }

function safeName(prompt) {
  const base = (prompt || "model").trim().toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return base || "model";
}

function run() {
  const prompt = $("#prompt").value;
  const seedRaw = $("#seed").value.trim();
  const seed = seedRaw === "" ? null : (parseInt(seedRaw, 10) >>> 0);
  const result = generate(prompt, seed);
  current = { ...result, name: safeName(prompt) };
  $("#seed").value = result.stats.seed;
  viewer.setMesh(result.mesh);
  renderStats(result.stats);
}

function renderStats(s) {
  const swatch = s.color
    ? `<span class="swatch" style="background:rgb(${s.color.map((c) => Math.round(c * 255)).join(",")})"></span>`
    : "auto";
  $("#stats").innerHTML = `
    <div><span>type</span><b>${s.object}</b></div>
    <div><span>count</span><b>${s.count}</b></div>
    <div><span>styles</span><b>${s.styles.length ? s.styles.join(", ") : "—"}</b></div>
    <div><span>color</span><b>${swatch}</b></div>
    <div><span>seed</span><b>${s.seed}</b></div>
    <div><span>vertices</span><b>${s.vertices.toLocaleString()}</b></div>
    <div><span>triangles</span><b>${s.triangles.toLocaleString()}</b></div>`;
}

function download(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function init() {
  try {
    viewer = new Viewer($("#view"));
  } catch (e) {
    $("#view").outerHTML = `<div class="error">렌더러를 초기화할 수 없습니다: ${e.message}</div>`;
    return;
  }

  $("#generate").addEventListener("click", run);
  $("#prompt").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run();
  });

  $("#randomize").addEventListener("click", () => {
    $("#seed").value = (Math.random() * 0xffffffff) >>> 0;
    run();
  });

  $("#wire").addEventListener("change", (e) => viewer.setWireframe(e.target.checked));
  $("#rotate").addEventListener("change", (e) => viewer.setAutoRotate(e.target.checked));

  $("#exportObj").addEventListener("click", () => {
    if (current) download(current.name + ".obj", toOBJ(current.mesh, current.name));
  });
  $("#exportStl").addEventListener("click", () => {
    if (current) download(current.name + ".stl", toSTL(current.mesh, current.name));
  });
  $("#exportGltf").addEventListener("click", () => {
    if (current) download(current.name + ".gltf", toGLTF(current.mesh, current.name), "model/gltf+json");
  });

  document.querySelectorAll(".chip").forEach((c) => {
    c.addEventListener("click", () => {
      $("#prompt").value = c.dataset.prompt;
      $("#seed").value = "";
      run();
    });
  });

  // first render
  $("#prompt").value = "빨간 지붕의 작은 집";
  run();
}

init();
