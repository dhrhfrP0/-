// Dependency-free WebGL2 viewer: per-vertex color, directional lighting,
// orbit/zoom/pan controls, grid floor, wireframe toggle, auto-fit.
import { mat4 } from "./glmath.js";

const VERT = `#version 300 es
in vec3 aPosition; in vec3 aNormal; in vec3 aColor;
uniform mat4 uViewProj;
out vec3 vNormal; out vec3 vColor; out vec3 vWorld;
void main() {
  vNormal = aNormal; vColor = aColor; vWorld = aPosition;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 vNormal; in vec3 vColor; in vec3 vWorld;
uniform vec3 uLightDir; uniform vec3 uCamPos;
out vec4 frag;
void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uLightDir);
  float diff = max(dot(N, L), 0.0);
  float amb = 0.38;
  float fill = 0.22 * (dot(N, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5);
  vec3 V = normalize(uCamPos - vWorld);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.12;
  vec3 col = vColor * (amb + diff * 0.7 + fill) + rim;
  frag = vec4(pow(col, vec3(0.4545)), 1.0); // gamma
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error("Shader error: " + gl.getShaderInfoLog(s));
  }
  return s;
}

export class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { antialias: true });
    if (!gl) throw new Error("WebGL2 not supported in this browser.");
    this.gl = gl;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error("Link error: " + gl.getProgramInfoLog(prog));
    }
    this.prog = prog;
    this.loc = {
      aPosition: gl.getAttribLocation(prog, "aPosition"),
      aNormal: gl.getAttribLocation(prog, "aNormal"),
      aColor: gl.getAttribLocation(prog, "aColor"),
      uViewProj: gl.getUniformLocation(prog, "uViewProj"),
      uLightDir: gl.getUniformLocation(prog, "uLightDir"),
      uCamPos: gl.getUniformLocation(prog, "uCamPos"),
    };

    this.buffers = {
      pos: gl.createBuffer(),
      nrm: gl.createBuffer(),
      col: gl.createBuffer(),
      tri: gl.createBuffer(),
      line: gl.createBuffer(),
      grid: gl.createBuffer(),
      gridCol: gl.createBuffer(),
      gridNrm: gl.createBuffer(),
    };

    this.triCount = 0;
    this.lineCount = 0;
    this.wireframe = false;
    this.autoRotate = true;

    // camera (spherical around target)
    this.cam = { az: Math.PI * 0.75, el: 0.5, dist: 6, target: [0, 0.5, 0] };

    this._buildGrid();
    this._initControls();
    this._resize();
    window.addEventListener("resize", () => this._resize());

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.08, 0.09, 0.12, 1.0);

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  setMesh(mesh) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.pos);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.positions), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.nrm);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.normals), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.col);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.colors), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.tri);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mesh.indices), gl.STATIC_DRAW);
    this.triCount = mesh.indices.length;

    // edge index buffer for wireframe
    const edges = [];
    const seen = new Set();
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const t = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
      for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
        const key = a < b ? a + "_" + b : b + "_" + a;
        if (!seen.has(key)) { seen.add(key); edges.push(a, b); }
      }
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.line);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(edges), gl.STATIC_DRAW);
    this.lineCount = edges.length;

    this.frame(mesh);
  }

  // Fit the camera to a mesh's bounding sphere.
  frame(mesh) {
    const b = mesh.bounds();
    this.cam.target = b.center;
    const r = Math.max(b.radius, 0.5);
    this.cam.dist = r / Math.sin((50 * Math.PI / 180) / 2) * 1.15;
  }

  setWireframe(on) { this.wireframe = on; }
  setAutoRotate(on) { this.autoRotate = on; }

  _buildGrid() {
    const gl = this.gl;
    const n = 20, step = 0.5, ext = n * step;
    const verts = [];
    for (let i = -n; i <= n; i++) {
      verts.push(-ext, 0, i * step, ext, 0, i * step);
      verts.push(i * step, 0, -ext, i * step, 0, ext);
    }
    this.gridCount = verts.length / 3;
    const cols = new Array(this.gridCount * 3).fill(0.22);
    const nrms = [];
    for (let i = 0; i < this.gridCount; i++) nrms.push(0, 1, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.grid);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.gridCol);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cols), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.gridNrm);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nrms), gl.STATIC_DRAW);
  }

  _initControls() {
    const el = this.canvas;
    let dragging = false, mode = "rotate", lastX = 0, lastY = 0;
    el.addEventListener("pointerdown", (e) => {
      dragging = true;
      mode = (e.button === 2 || e.shiftKey) ? "pan" : "rotate";
      lastX = e.clientX; lastY = e.clientY;
      this.autoRotate = false;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (mode === "rotate") {
        this.cam.az -= dx * 0.01;
        this.cam.el = Math.max(-1.4, Math.min(1.4, this.cam.el + dy * 0.01));
      } else {
        const s = this.cam.dist * 0.0018;
        // pan in camera-right / world-up plane
        const right = [Math.cos(this.cam.az), 0, -Math.sin(this.cam.az)];
        this.cam.target[0] -= (dx * right[0]) * s;
        this.cam.target[2] -= (dx * right[2]) * s;
        this.cam.target[1] += dy * s;
      }
    });
    const end = (e) => { dragging = false; };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.cam.dist *= Math.exp(e.deltaY * 0.001);
      this.cam.dist = Math.max(0.8, Math.min(60, this.cam.dist));
    }, { passive: false });
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = Math.max(1, Math.floor(w * dpr));
    this.canvas.height = Math.max(1, Math.floor(h * dpr));
  }

  _camPos() {
    const { az, el, dist, target } = this.cam;
    const ce = Math.cos(el);
    return [
      target[0] + dist * ce * Math.cos(az),
      target[1] + dist * Math.sin(el),
      target[2] + dist * ce * Math.sin(az),
    ];
  }

  _bindAttr(buffer, loc, size) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  _loop() {
    const gl = this.gl;
    if (this.autoRotate) this.cam.az += 0.0035;
    const eye = this._camPos();
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const proj = mat4.perspective(50 * Math.PI / 180, aspect, 0.05, 200);
    const view = mat4.lookAt(eye, this.cam.target, [0, 1, 0]);
    const vp = mat4.multiply(proj, view);

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.loc.uViewProj, false, vp);
    gl.uniform3fv(this.loc.uLightDir, [0.5, 0.9, 0.4]);
    gl.uniform3fv(this.loc.uCamPos, eye);

    // grid
    this._bindAttr(this.buffers.grid, this.loc.aPosition, 3);
    this._bindAttr(this.buffers.gridNrm, this.loc.aNormal, 3);
    this._bindAttr(this.buffers.gridCol, this.loc.aColor, 3);
    gl.drawArrays(gl.LINES, 0, this.gridCount);

    // model
    if (this.triCount > 0) {
      this._bindAttr(this.buffers.pos, this.loc.aPosition, 3);
      this._bindAttr(this.buffers.nrm, this.loc.aNormal, 3);
      this._bindAttr(this.buffers.col, this.loc.aColor, 3);
      if (this.wireframe) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.line);
        gl.drawElements(gl.LINES, this.lineCount, gl.UNSIGNED_INT, 0);
      } else {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.tri);
        gl.drawElements(gl.TRIANGLES, this.triCount, gl.UNSIGNED_INT, 0);
      }
    }
    requestAnimationFrame(this._loop);
  }
}
