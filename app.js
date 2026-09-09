/* ============================================================
   스위치등 — 조명 스위치 안내판 만들기
   어느 스위치가 어느 등을 켜는지 한 장으로 정리해 인쇄합니다.
   ============================================================ */
(function () {
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ── 상수 ───────────────────────────────────────────────── */
/* 캔버스가 곧 종이다. 가로를 1000으로 고정하고 세로는 고른 비율에서 나온다.
   방은 그 위에 놓인 도형이라 파워포인트처럼 옮기고 늘릴 수 있다. */
const VB_W = 1000;
const STORE = 'switchdeung.doc.v2';
const FONT  = "'Apple SD Gothic Neo','Malgun Gothic',sans-serif";

const SHAPES = {
  bar:    { w: 152, h: 34 },   /* 가로 형광등 */
  vbar:   { w: 34,  h: 152 },  /* 세로 형광등 */
  square: { w: 74,  h: 74 },
  circle: { w: 74,  h: 74 }
};
/* 종이는 A4 가로 하나뿐이다.
   A 계열(A5·A4·A3·A2)은 모두 같은 1:√2 모양이라, 이 한 비율로 어떤 크기에 뽑아도 꽉 찬다. */
const PAPER_H = Math.round(VB_W * 210 / 297);   /* 707 */
/* 아래쪽은 벽 이름표와 스위치판이 앉을 자리 */
const BAND = 168, ROOM_TOP = 40;

/* 버튼 색. 처음에는 아무도 고르지 않은 회색이고, 쓰는 사람이 바꾼다. */
const GANG_GRAY = '#98a1ac';
const PALETTE = [
  GANG_GRAY, '#e5484d', '#f76b15', '#a16207', '#65a30d', '#30a46c',
  '#0d9488',  '#0090ff', '#3e63dd', '#8e4ec6', '#e93d82', '#1f2937'
];

/* 스위치 생김새 — 한국에서 쓰는 것만.
   한국 매입 스위치는 버튼이 위아래로 쌓이고, 4구가 넘으면 두 줄(2연장)이 된다.
   버튼 오른쪽의 짧은 빗금은 실제 제품에 있는 표시다. */
const SWITCH_STYLES = [
  { id: 'k-v',   name: '매입형 · 세로 배열', desc: '버튼이 위아래로 · 가장 흔한 형태' },
  { id: 'k-h',   name: '매입형 · 가로 배열', desc: '버튼이 좌우로 나란히' },
  { id: 'touch', name: '터치 유리',          desc: '유리 패널 터치식' },
  { id: 'round', name: '노출형 원형',        desc: '벽 표면에 붙는 둥근 스위치' }
];
const STYLE_ALIAS = { k86: 'k-h', wide: 'k-v', decora: 'k-h', toggle: 'k-v' };

const TEMPLATES = [
  { id:'classroom', name:'일반 교실', desc:'형광등 3줄 × 3개 · 스위치 3구',
    ratio:[4,3], cols:3, rows:3, shape:'bar', gangs:3,
    sides:{top:'칠판 (앞쪽)', bottom:'뒤 게시판', left:'창문', right:'출입문 · 복도'} },
  { id:'classroom-s', name:'특별실 · 작은 교실', desc:'형광등 3줄 × 2개 · 스위치 2구',
    ratio:[4,3], cols:3, rows:2, shape:'bar', gangs:2,
    sides:{top:'앞쪽', bottom:'뒤쪽', left:'창문', right:'출입문'} },
  { id:'hall', name:'강당 · 체육관', desc:'원형 등 6 × 4 · 스위치 4구',
    ratio:[16,9], cols:6, rows:4, shape:'circle', gangs:4,
    sides:{top:'무대', bottom:'', left:'', right:'출입문'} },
  { id:'office', name:'사무실 · 교무실', desc:'사각 등 4 × 3 · 스위치 3구',
    ratio:[16,10], cols:4, rows:3, shape:'square', gangs:3,
    sides:{top:'', bottom:'', left:'창문', right:'출입문'} },
  { id:'corridor', name:'복도 · 계단', desc:'형광등 8개 한 줄 · 스위치 2구',
    ratio:[5,1], cols:8, rows:1, shape:'bar', gangs:2,
    sides:{top:'', bottom:'', left:'계단 쪽', right:'교실 쪽'} }
];

/* ── 상태 ───────────────────────────────────────────────── */
function blankDoc() {
  return {
    title: '', hasBlueprint: false,
    room: { x: 0.07, y: ROOM_TOP / PAPER_H, w: 0.86, h: (PAPER_H - ROOM_TOP - BAND) / PAPER_H },
    bg: null, bgOpacity: 0.45,
    sides: { top: '', right: '', bottom: '', left: '' },
    lights: [], switches: []
  };
}
let doc = blankDoc();
let ui  = { screen: 'home', tool: 'select', shape: 'bar', sel: null, activeGang: null };
let undoStack = [];

/* 예전 판으로 저장한 내용도 열리도록 맞춰준다 */
function migrate(d) {
  d = Object.assign(blankDoc(), d || {});
  if (!d.room || typeof d.room.w !== 'number') d.room = blankDoc().room;
  /* 종이 비율을 고르던 시절에 저장한 것 — 방과 스위치의 실제 위치를 지키며 A4로 옮긴다 */
  const old = d.paper || d.ratio;
  if (old && old.w) {
    const oldH = clamp(Math.round(VB_W * old.h / old.w), 150, 1600);
    if (Math.abs(oldH - PAPER_H) > 1) {
      const k = oldH / PAPER_H;
      d.room.h = clamp(d.room.h * k, 0.05, 1);
      d.room.y = clamp(d.room.y * k, 0, 1 - d.room.h);
      (d.switches || []).forEach(sw => { sw.ny = sw.ny * k; });
    }
  }
  (d.switches || []).forEach(sw => {
    sw.style = STYLE_ALIAS[sw.style] || sw.style || 'k-v';
    if (sw.ny > 1.6) { sw.nx = clamp(sw.nx, 0.06, 0.94); sw.ny = 0.88; }   // 아주 옛 좌표계
    (sw.gangs || []).forEach(g => { if (!g.color) g.color = GANG_GRAY; });
  });
  delete d.ratio; delete d.paper;
  return d;
}

/* ── 저장 / 되돌리기 ────────────────────────────────────── */
function snapshot() {
  undoStack.push(JSON.stringify(doc));
  if (undoStack.length > 60) undoStack.shift();
}
function undo() {
  if (!undoStack.length) return;
  doc = JSON.parse(undoStack.pop());
  ui.sel = null; ui.activeGang = null;
  persist(); render();
}
function persist() { try { localStorage.setItem(STORE, JSON.stringify(doc)); } catch (e) {} }
function restore() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.lights)) return false;
    doc = migrate(d);
    persist();          /* 옛 형식을 고쳐 읽었으면 그 상태로 다시 저장해 둔다 */
    return true;
  } catch (e) { return false; }
}

/* ── 좌표 ───────────────────────────────────────────────── */
function vb() { return { W: VB_W, H: PAPER_H }; }
function paperH() { return PAPER_H; }
function roomBox() {
  const r = doc.room, H = paperH();
  return { x: r.x * VB_W, y: r.y * H, w: r.w * VB_W, h: r.h * H };
}
function svgPoint(ev) {
  const r = $('#plan').getBoundingClientRect();
  return { x: (ev.clientX - r.left) * (VB_W / r.width), y: (ev.clientY - r.top) * (paperH() / r.height) };
}
function toRoomNorm(pt) {
  const rb = roomBox();
  return { nx: clamp((pt.x - rb.x) / rb.w, 0, 1), ny: clamp((pt.y - rb.y) / rb.h, 0, 1) };
}
/* 방을 주어진 가로:세로 모양으로 종이 안에 앉힌다. 아래쪽은 스위치판 자리로 남긴다. */
function placeRoom(aw, ah) {
  const maxW = VB_W * 0.88, maxH = PAPER_H - ROOM_TOP - BAND;
  let w = maxW, h = w * ah / aw;
  if (h > maxH) { h = maxH; w = h * aw / ah; }
  doc.room = { x: 0.5 - (w / VB_W) / 2, y: ROOM_TOP / PAPER_H, w: w / VB_W, h: h / PAPER_H };
}
function paperAspect() { return VB_W / PAPER_H; }
/* 종이 높이가 고정이라 스위치판을 줄일 일이 없다 */
function plateScale() { return 1; }

/* ── 조회 헬퍼 ──────────────────────────────────────────── */
function allGangs() {
  const out = [];
  doc.switches.forEach(sw => sw.gangs.forEach(g => out.push({ sw: sw, g: g })));
  return out;
}
function gangsOf(lightId) {
  return allGangs().filter(p => p.g.lightIds.indexOf(lightId) >= 0).map(p => p.g);
}
function findGang(id) { const h = allGangs().filter(p => p.g.id === id)[0]; return h ? h.g : null; }
function inkOn(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 165 ? '#14161a' : '#ffffff';
}

/* 스위치가 둘 이상이면 “가1 · 나2”처럼 앞글자를 붙인다.
   색만으로 구분하면 흑백 프린터에서 무용지물이 되기 때문. */
const PREFIX = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차'];
function swIndexOfGang(gid) {
  for (let i = 0; i < doc.switches.length; i++)
    if (doc.switches[i].gangs.some(g => g.id === gid)) return i;
  return -1;
}
function dlabel(g) {
  if (doc.switches.length < 2) return g.label;
  const i = swIndexOfGang(g.id);
  return (i >= 0 ? (PREFIX[i] || String(i + 1)) : '') + g.label;
}

/* ── 변경 동작 ──────────────────────────────────────────── */
function addLight(nx, ny, shape, size) {
  const sp = shape || ui.shape;
  /* 크기를 따로 주지 않으면, 같은 모양으로 이미 놓인 등에 맞춘다 */
  const like = size || doc.lights.filter(l => l.shape === sp).slice(-1)[0] || SHAPES[sp];
  doc.lights.push({ id: uid(), nx: nx, ny: ny, shape: sp, w: like.w, h: like.h });
}
function removeLight(id) {
  doc.lights = doc.lights.filter(l => l.id !== id);
  doc.switches.forEach(sw => sw.gangs.forEach(g => { g.lightIds = g.lightIds.filter(x => x !== id); }));
  if (ui.sel && ui.sel.id === id) ui.sel = null;
}
function newGang(sw, idx) {
  return { id: uid(), label: String((idx == null ? sw.gangs.length : idx) + 1),
           color: GANG_GRAY, desc: '', lightIds: [] };
}
function addSwitch(gangCount) {
  const n = doc.switches.length;
  const rb = roomBox();
  const sw = {
    id: uid(), style: 'k-v',
    name: n === 0 ? '출입문 옆 스위치' : '스위치 ' + (n + 1),
    nx: clamp((rb.x + (0.16 + n * 0.26) * rb.w) / VB_W, 0.09, 0.91),
    ny: clamp((rb.y + rb.h + 20 + 62 * plateScale()) / paperH(), 0.1, 0.97),
    gangs: []
  };
  doc.switches.push(sw);   /* 색이 겹치지 않으려면 먼저 등록한 뒤 버튼을 만들어야 한다 */
  for (let i = 0; i < (gangCount || 2); i++) sw.gangs.push(newGang(sw, i));
  return sw;
}
function gridPlace(rows, cols, shape) {
  doc.lights = [];
  doc.switches.forEach(sw => sw.gangs.forEach(g => { g.lightIds = []; }));
  const sp = shape || ui.shape, base = SHAPES[sp], rb = roomBox(), pad = 0.10;
  /* 등이 빽빽할수록 작게 그린다 — 안 그러면 서로 겹친다 */
  const stepX = cols > 1 ? rb.w * (1 - pad * 2) / (cols - 1) : rb.w * 0.8;
  const stepY = rows > 1 ? rb.h * (1 - pad * 2) / (rows - 1) : rb.h * 0.8;
  let size;
  if (sp === 'bar') {
    const w = clamp(stepX * 0.82, 46, base.w);
    size = { w: w, h: clamp(w * 0.22, 15, base.h) };
  } else if (sp === 'vbar') {
    const h = clamp(stepY * 0.82, 46, base.h);
    size = { w: clamp(h * 0.22, 15, base.w), h: h };
  } else {
    const d = clamp(Math.min(stepX, stepY) * 0.62, 26, base.w);
    size = { w: d, h: d };
  }
  /* 등이 방 테두리를 넘지 않도록 등 크기만큼 여백을 더 준다 */
  const padX = Math.max(pad, (size.w / 2 + 6) / rb.w);
  const padY = Math.max(pad, (size.h / 2 + 6) / rb.h);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    addLight(cols === 1 ? 0.5 : padX + (c / (cols - 1)) * (1 - padX * 2),
             rows === 1 ? 0.5 : padY + (r / (rows - 1)) * (1 - padY * 2), sp, size);
  }
}

/* ============================================================
   스위치판 그리기 — 나라·제품별 생김새
   원점(0,0)이 왼쪽 위. {w, h, svg} 를 돌려준다.
   ============================================================ */
function plateSVG(sw) {
  const gs = sw.gangs, n = gs.length;
  const labels = gs.map(dlabel);
  const style = STYLE_ALIAS[sw.style] || sw.style || 'k-v';
  const txt = (x, y, t, fill, size) =>
    '<text font-family="' + FONT + '" x="' + x + '" y="' + y + '" font-size="' + size +
    '" font-weight="800" fill="' + fill + '" text-anchor="middle">' + esc(t) + '</text>';
  const fs = labels.some(t => t.length > 1) ? 13 : 15;
  /* 실제 제품 버튼 오른쪽에 있는 짧은 빗금 */
  const hatch = (x, cy, ink) => {
    let o = '';
    [-3.5, 3.5].forEach(d => {
      o += '<line x1="' + x + '" y1="' + (cy + d) + '" x2="' + (x + 9) + '" y2="' + (cy + d) +
           '" stroke="' + ink + '" stroke-width="1.6" opacity=".55"/>';
    });
    return o;
  };
  const frame = (W, H, r) =>
    '<rect width="' + W + '" height="' + H + '" rx="' + r + '" fill="#f6f5f1" stroke="#b3b6bb" stroke-width="1.8"/>' +
    '<rect x="4.5" y="4.5" width="' + (W - 9) + '" height="' + (H - 9) + '" rx="' + Math.max(1, r - 2) +
    '" fill="#fdfdfb" stroke="#e0e1e3"/>';

  let W, H, s2 = '';

  if (style === 'k-v') {
    /* 버튼이 위아래로. 4구 이상이면 두 줄로 나뉜다 (2연장) */
    const cols = Math.ceil(n / 3), rows = Math.ceil(n / cols);
    const bw = 46, gap = 5, pad = 11;
    const bh = rows === 1 ? 56 : (rows === 2 ? 49 : 31);
    W = pad * 2 + cols * bw + (cols - 1) * gap;
    H = pad * 2 + rows * bh + (rows - 1) * gap;
    s2 += frame(W, H, 6);
    gs.forEach((g, i) => {
      const c = Math.floor(i / rows), r = i % rows;
      const bx = pad + c * (bw + gap), by = pad + r * (bh + gap);
      const ink = inkOn(g.color);
      s2 += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="3.5" fill="' + g.color + '"/>';
      s2 += hatch(bx + bw - 13, by + bh / 2, ink);
      s2 += txt(bx + (bw - 14) / 2, by + bh / 2 + fs * 0.36, labels[i], ink, fs);
    });

  } else if (style === 'k-h') {
    /* 버튼이 좌우로 나란히 — 정사각 플레이트 */
    const bh = 62, gap = 5, pad = 13;
    const bw = n <= 3 ? (96 - pad * 2 - (n - 1) * gap) / n : 24;
    W = Math.max(96, pad * 2 + n * bw + (n - 1) * gap);
    H = 96;
    const by = (H - bh) / 2;
    s2 += frame(W, H, 8);
    gs.forEach((g, i) => {
      const bx = pad + i * (bw + gap), ink = inkOn(g.color);
      s2 += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="3" fill="' + g.color + '"/>';
      s2 += txt(bx + bw / 2, by + bh / 2 + fs * 0.36, labels[i], ink, fs);
      [-3.5, 3.5].forEach(d => {
        s2 += '<line x1="' + (bx + bw / 2 + d) + '" y1="' + (by + bh - 13) + '" x2="' + (bx + bw / 2 + d) +
              '" y2="' + (by + bh - 5) + '" stroke="' + ink + '" stroke-width="1.6" opacity=".55"/>';
      });
    });

  } else if (style === 'touch') {
    const d = 36, gap = 15, pad = 16; H = 86;
    W = n * d + (n - 1) * gap + pad * 2;
    s2 += '<rect width="' + W + '" height="' + H + '" rx="11" fill="#1c1f26" stroke="#3a3f49" stroke-width="1.6"/>';
    gs.forEach((g, i) => {
      const cx = pad + i * (d + gap) + d / 2, cy = H / 2;
      s2 += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (d / 2 + 5) + '" fill="none" stroke="' + g.color + '" stroke-width="1.6" opacity=".45"/>';
      s2 += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (d / 2) + '" fill="' + g.color + '"/>';
      s2 += txt(cx, cy + fs * 0.36, labels[i], inkOn(g.color), fs);
    });

  } else { /* round — 노출형 */
    const d = 44, gap = 10, pad = 12;
    W = n * d + (n - 1) * gap + pad * 2; H = d + pad * 2;
    s2 += '<rect width="' + W + '" height="' + H + '" rx="' + (H / 2) + '" fill="#fbfbfa" stroke="#b3b6bb" stroke-width="1.8"/>';
    gs.forEach((g, i) => {
      const cx = pad + i * (d + gap) + d / 2, cy = H / 2;
      s2 += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (d / 2) + '" fill="' + g.color + '"/>';
      s2 += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (d / 2 - 6) + '" fill="none" stroke="#ffffff" stroke-width="1.4" opacity=".55"/>';
      s2 += txt(cx, cy + fs * 0.36, labels[i], inkOn(g.color), fs);
    });
  }
  return { w: W, h: H, svg: s2 };
}

/* ============================================================
   그리기 — 평면도 SVG
   ============================================================ */
function planSVG(forPrint) {
  const rb = roomBox();
  let s = '';

  if (doc.bg) {
    s += '<image href="' + esc(doc.bg) + '" x="' + rb.x + '" y="' + rb.y + '" width="' + rb.w +
         '" height="' + rb.h + '" preserveAspectRatio="xMidYMid meet" opacity="' + doc.bgOpacity + '"/>';
  }
  s += '<rect data-room="1" x="' + rb.x + '" y="' + rb.y + '" width="' + rb.w + '" height="' + rb.h +
       '" fill="none" stroke="#111111" stroke-width="3.5"/>';

  /* 벽 이름표 */
  const lab = (t, x, y, rot) => t
    ? '<text font-family="' + FONT + '" x="' + x + '" y="' + y + '" font-size="23" font-weight="700" fill="#444" ' +
      'text-anchor="middle"' + (rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : '') + '>' + esc(t) + '</text>'
    : '';
  s += lab(doc.sides.top,    rb.x + rb.w / 2, rb.y - 18, 0);
  s += lab(doc.sides.bottom, rb.x + rb.w / 2, rb.y + rb.h + 32, 0);
  s += lab(doc.sides.left,   rb.x - 22, rb.y + rb.h / 2, -90);
  s += lab(doc.sides.right,  rb.x + rb.w + 28, rb.y + rb.h / 2, 90);

  /* 등 */
  doc.lights.forEach(l => {
    const cx = rb.x + l.nx * rb.w, cy = rb.y + l.ny * rb.h;
    const gs = gangsOf(l.id);
    const fill = gs.length ? gs[0].color : '#e6e9ed';
    const txt  = gs.map(dlabel).join('·');
    const on   = !ui.activeGang || gs.some(g => g.id === ui.activeGang);
    const op   = forPrint ? 1 : (on ? 1 : 0.28);
    const sel  = !forPrint && ui.sel && ui.sel.t === 'light' && ui.sel.id === l.id;
    const stroke = sel ? '#111111' : (gs.length ? '#00000030' : '#b8bec7');
    const sw = sel ? 4 : 1.5;

    let shp;
    if (l.shape === 'circle') {
      shp = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (l.w / 2) + '" ry="' + (l.h / 2) +
            '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    } else {
      const rx = l.shape === 'bar' ? l.h / 2 : (l.shape === 'vbar' ? l.w / 2 : 8);
      shp = '<rect x="' + (cx - l.w / 2) + '" y="' + (cy - l.h / 2) + '" width="' + l.w + '" height="' + l.h +
            '" rx="' + rx + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    }
    /* 글자가 등 밖으로 삐져나오지 않게 폭에 맞춰 줄인다 */
    let fs = l.shape === 'bar' ? 21 : (l.shape === 'vbar' ? 19 : 26);
    if (txt) fs = clamp(Math.min(fs, (l.w - 8) / (txt.length * 0.60)), 9, fs);
    const label = txt
      ? '<text font-family="' + FONT + '" x="' + cx + '" y="' + (cy + fs * 0.35) + '" font-size="' + fs +
        '" font-weight="800" fill="' + inkOn(fill) + '" text-anchor="middle">' + esc(txt) + '</text>'
      : '<text font-family="' + FONT + '" x="' + cx + '" y="' + (cy + 7) + '" font-size="20" font-weight="700" fill="#9aa2ad" text-anchor="middle">?</text>';
    s += '<g data-light="' + l.id + '" opacity="' + op + '" style="cursor:pointer">' + shp + label + '</g>';
  });

  /* 스위치판 */
  doc.switches.forEach(sw => {
    if (!sw.gangs.length) return;
    const p = plateSVG(sw);
    const k = plateScale();
    const pw = p.w * k, ph = p.h * k, nameH = 24 * k;
    const cx = clamp(sw.nx * VB_W, pw / 2 + 4, VB_W - pw / 2 - 4);
    const PH = paperH();
    const cy = clamp(sw.ny * PH, ph / 2 + 4, PH - ph / 2 - nameH - 4);
    const x0 = cx - pw / 2, y0 = cy - ph / 2;
    const hot = !forPrint && ui.activeGang && sw.gangs.some(g => g.id === ui.activeGang);
    const sel = !forPrint && ui.sel && ui.sel.t === 'switch' && ui.sel.id === sw.id;
    const ring = (hot || sel)
      ? '<rect x="-5" y="-5" width="' + (p.w + 10) + '" height="' + (p.h + 10) +
        '" rx="12" fill="none" stroke="#111111" stroke-width="2.5" stroke-dasharray="6 4"/>' : '';
    s += '<g data-switch="' + sw.id + '" transform="translate(' + x0 + ' ' + y0 + ') scale(' + k + ')" style="cursor:move">' +
         ring + p.svg +
         '<text font-family="' + FONT + '" x="' + (p.w / 2) + '" y="' + (p.h + 19) +
         '" font-size="17" font-weight="700" fill="#222" text-anchor="middle">' + esc(sw.name) + '</text>' +
         '</g>';
  });

  /* 방 손잡이 — 파워포인트처럼 여덟 점으로 크기 조절 */
  if (!forPrint && ui.sel && ui.sel.t === 'room') {
    const H = 13, half = H / 2;
    const pts = [
      ['nw', rb.x,            rb.y,             'nwse-resize'],
      ['n',  rb.x + rb.w / 2, rb.y,             'ns-resize'],
      ['ne', rb.x + rb.w,     rb.y,             'nesw-resize'],
      ['e',  rb.x + rb.w,     rb.y + rb.h / 2,  'ew-resize'],
      ['se', rb.x + rb.w,     rb.y + rb.h,      'nwse-resize'],
      ['s',  rb.x + rb.w / 2, rb.y + rb.h,      'ns-resize'],
      ['sw', rb.x,            rb.y + rb.h,      'nesw-resize'],
      ['w',  rb.x,            rb.y + rb.h / 2,  'ew-resize']
    ];
    s += '<rect x="' + (rb.x - 4) + '" y="' + (rb.y - 4) + '" width="' + (rb.w + 8) + '" height="' + (rb.h + 8) +
         '" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="7 5"/>';
    pts.forEach(p => {
      s += '<rect data-handle="' + p[0] + '" x="' + (p[1] - half) + '" y="' + (p[2] - half) +
           '" width="' + H + '" height="' + H + '" rx="2.5" fill="#ffffff" stroke="#2563eb" stroke-width="2" ' +
           'style="cursor:' + p[3] + '"/>';
    });
  }
  return s;
}

function renderPlan() {
  const svg = $('#plan');
  const H = paperH();
  $('#paper').style.aspectRatio = VB_W + ' / ' + H;
  svg.setAttribute('viewBox', '0 0 ' + VB_W + ' ' + H);
  svg.innerHTML = '<rect width="' + VB_W + '" height="' + H + '" fill="#ffffff"/>' + planSVG(false);
}

/* ============================================================
   그리기 — 상단 · 독 · 안내 배너
   ============================================================ */
function renderDock() {
  $$('#dock .dock-btn[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === ui.tool));
  $$('#dock-shapes .shape-btn').forEach(b => b.classList.toggle('on', b.dataset.shape === ui.shape));
}
function renderHint() {
  const el = $('#hint');
  if (ui.activeGang) {
    const g = findGang(ui.activeGang);
    if (g) {
      el.hidden = false;
      el.innerHTML = '<span><b style="color:' + g.color + '">' + esc(dlabel(g)) + '번 버튼</b>이 켜는 등을 클릭하세요' +
                     ' · 선택 ' + g.lightIds.length + '개</span><button id="hint-done">완료</button>';
      $('#hint-done').onclick = () => { ui.activeGang = null; render(); };
      return;
    }
  }
  if (ui.tool === 'light') { el.hidden = false; el.innerHTML = '<span>방 안을 클릭해 등을 놓으세요</span>'; return; }
  if (ui.tool === 'erase') { el.hidden = false; el.innerHTML = '<span>지울 등을 클릭하세요</span>'; return; }
  if (ui.sel && ui.sel.t === 'room') {
    el.hidden = false;
    el.innerHTML = '<span>점을 끌어 방 크기 조절 · 안쪽을 끌어 이동 · Shift를 누르면 비율 유지</span>';
    return;
  }
  el.hidden = true;
}

/* ============================================================
   그리기 — 오른쪽 패널
   ============================================================ */
function renderPanel() {
  const p = $('#panel-scroll');
  let h = '';

  h += '<div class="sec"><div class="sec-h"><span>스위치</span></div>';
  if (!doc.switches.length) {
    h += '<div class="empty">아직 스위치가 없습니다.<br>위쪽 <b>스위치 추가</b>를 눌러 시작하세요.</div>';
  }
  doc.switches.forEach(sw => {
    h += '<div class="sw"><div class="sw-head">' +
         '<input class="sw-name" data-sw-name="' + sw.id + '" value="' + esc(sw.name) + '" maxlength="24">' +
         '<button class="icon-x" data-act="del-switch" data-id="' + sw.id + '" title="스위치 삭제">✕</button>' +
         '</div>';
    h += '<div class="style-row"><select data-sw-style="' + sw.id + '" title="스위치 생김새">';
    SWITCH_STYLES.forEach(st => {
      const cur = STYLE_ALIAS[sw.style] || sw.style || 'k-v';
      h += '<option value="' + st.id + '"' + (cur === st.id ? ' selected' : '') + '>' +
           esc(st.name) + ' — ' + esc(st.desc) + '</option>';
    });
    h += '</select></div>';
    h += '<div class="sw-body">';
    sw.gangs.forEach(g => {
      const on = ui.activeGang === g.id;
      h += '<div class="gang' + (on ? ' on' : '') + '">' +
           '<button class="gang-btn" data-act="pick-gang" data-id="' + g.id + '" ' +
           'style="background:' + g.color + ';color:' + inkOn(g.color) + '" title="이 버튼이 켜는 등 고르기">' +
           esc(dlabel(g)) + '</button>' +
           '<input class="gang-desc" data-gang-desc="' + g.id + '" value="' + esc(g.desc) + '" maxlength="22" placeholder="예) 칠판 쪽">' +
           '<span class="gang-cnt">' + g.lightIds.length + '개</span>' +
           '<button class="swatch" data-act="pick-color" data-id="' + g.id + '" ' +
           'style="background:' + g.color + '" title="색 고르기"></button>' +
           '<button class="icon-x" data-act="del-gang" data-id="' + g.id + '" title="버튼 삭제">✕</button>' +
           '</div>';
    });
    h += '<button class="add-gang" data-act="add-gang" data-id="' + sw.id + '">＋ 버튼(구) 추가</button>';
    h += '</div></div>';
  });
  h += '</div>';

  if (doc.hasBlueprint) {
    h += '<div class="sec"><div class="sec-h"><span>평면도 이미지</span></div>' +
         '<div class="field"><input type="file" id="bg-file" accept="image/*"></div>';
    if (doc.bg) {
      h += '<div class="field"><label>진하기 ' + Math.round(doc.bgOpacity * 100) + '%</label>' +
           '<input type="range" id="bg-op" min="10" max="100" value="' + Math.round(doc.bgOpacity * 100) + '"></div>' +
           '<button class="mini" data-act="del-bg" style="align-self:flex-start">이미지 지우기</button>';
    }
    h += '</div>';
  }

  h += '<div class="sec"><div class="sec-h"><span>벽 이름표</span></div><div class="sides">' +
       sideField('top', '위쪽', '칠판 · 앞') + sideField('bottom', '아래쪽', '뒤쪽') +
       sideField('left', '왼쪽', '창문') + sideField('right', '오른쪽', '출입문') +
       '</div></div>';

  h += '<div class="sec"><div class="sec-h"><span>등</span></div>' +
       '<div class="room-row">전체 <b>' + doc.lights.length + '개</b> · 배정 안 된 등 <b>' +
       doc.lights.filter(l => !gangsOf(l.id).length).length + '개</b></div></div>';

  p.innerHTML = h;
  bindPanel();
}
function sideField(key, label, ph) {
  return '<div class="field"><label>' + label + '</label>' +
         '<input type="text" data-side="' + key + '" value="' + esc(doc.sides[key]) + '" placeholder="' + ph + '" maxlength="14"></div>';
}

function bindPanel() {
  const p = $('#panel-scroll');
  $$('[data-act]', p).forEach(btn => {
    btn.onclick = () => {
      const act = btn.dataset.act, id = btn.dataset.id;
      if (act === 'del-switch') { snapshot(); doc.switches = doc.switches.filter(s => s.id !== id); ui.activeGang = null; }
      else if (act === 'add-gang') {
        snapshot();
        const sw = doc.switches.filter(s => s.id === id)[0];
        if (sw) { const g = newGang(sw); sw.gangs.push(g); ui.activeGang = g.id; }
      }
      else if (act === 'del-gang') {
        snapshot();
        doc.switches.forEach(s => { s.gangs = s.gangs.filter(g => g.id !== id); });
        if (ui.activeGang === id) ui.activeGang = null;
      }
      else if (act === 'pick-gang') { ui.activeGang = ui.activeGang === id ? null : id; }
      else if (act === 'pick-color') { openColorPop(id, btn); return; }
      else if (act === 'del-bg') { snapshot(); doc.bg = null; }
      persist(); render();
    };
  });
  $$('[data-sw-name]', p).forEach(inp => {
    inp.oninput = () => {
      const sw = doc.switches.filter(s => s.id === inp.dataset.swName)[0];
      if (sw) { sw.name = inp.value; persist(); renderPlan(); }
    };
  });
  $$('[data-sw-style]', p).forEach(sel => {
    sel.onchange = () => {
      const sw = doc.switches.filter(s => s.id === sel.dataset.swStyle)[0];
      if (sw) { snapshot(); sw.style = sel.value; persist(); renderPlan(); }
    };
  });
  $$('[data-gang-desc]', p).forEach(inp => {
    inp.oninput = () => { const g = findGang(inp.dataset.gangDesc); if (g) { g.desc = inp.value; persist(); } };
  });
  $$('[data-side]', p).forEach(inp => {
    inp.oninput = () => { doc.sides[inp.dataset.side] = inp.value; persist(); renderPlan(); };
  });

  const bf = $('#bg-file', p);
  if (bf) bf.onchange = () => {
    const f = bf.files && bf.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      snapshot(); doc.bg = rd.result;
      const img = new Image();
      img.onload  = () => { placeRoom(img.naturalWidth, img.naturalHeight); persist(); render(); };
      img.onerror = () => { persist(); render(); };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  };
  const op = $('#bg-op', p);
  if (op) op.oninput = () => { doc.bgOpacity = op.value / 100; persist(); renderPlan(); };
}

function render() { renderPlan(); renderPanel(); renderDock(); renderHint(); }

/* ============================================================
   캔버스 조작
   ============================================================ */
function bindCanvas() {
  const svg = $('#plan');
  let drag = null;

  const inRoom = pt => {
    const rb = roomBox();
    return pt.x >= rb.x - 6 && pt.x <= rb.x + rb.w + 6 && pt.y >= rb.y - 6 && pt.y <= rb.y + rb.h + 6;
  };

  svg.addEventListener('pointerdown', ev => {
    const pt = svgPoint(ev);
    const lg = ev.target.closest('[data-light]');
    const sg = ev.target.closest('[data-switch]');
    const hd = ev.target.closest('[data-handle]');

    if (ui.tool === 'erase' && lg) { snapshot(); removeLight(lg.dataset.light); persist(); render(); return; }

    if (ui.tool === 'light' && !lg && !sg && !hd) {
      const n = toRoomNorm(pt);
      snapshot(); addLight(n.nx, n.ny);
      if (ui.activeGang) findGang(ui.activeGang).lightIds.push(doc.lights[doc.lights.length - 1].id);
      persist(); render(); return;
    }

    if (hd) {
      svg.setPointerCapture(ev.pointerId);
      drag = { kind: 'resize', dir: hd.dataset.handle, p0: pt, room0: Object.assign({}, doc.room),
               lights0: doc.lights.map(l => ({ w: l.w, h: l.h })), saved: false };
      return;
    }
    if (lg || sg) {
      const el = lg || sg;
      svg.setPointerCapture(ev.pointerId);
      drag = { kind: lg ? 'light' : 'switch', id: el.dataset.light || el.dataset.switch,
               x0: ev.clientX, y0: ev.clientY, moved: false, saved: false };
      if (ui.tool === 'select') { ui.sel = { t: lg ? 'light' : 'switch', id: drag.id }; renderPlan(); renderHint(); }
      return;
    }
    if (ui.tool === 'select' && inRoom(pt)) {
      svg.setPointerCapture(ev.pointerId);
      drag = { kind: 'room', p0: pt, room0: Object.assign({}, doc.room), moved: false, saved: false };
      const was = ui.sel && ui.sel.t === 'room';
      ui.sel = { t: 'room', id: 'room' };
      if (!was) { renderPlan(); renderHint(); }
      return;
    }
    if (ui.tool === 'select') { ui.sel = null; renderPlan(); renderHint(); }
  });

  svg.addEventListener('pointermove', ev => {
    if (!drag) return;
    const pt = svgPoint(ev);

    if (drag.kind === 'resize' || drag.kind === 'room') {
      if (!drag.saved) { snapshot(); drag.saved = true; }
      const PH = paperH();
      const r0 = drag.room0, dx = (pt.x - drag.p0.x) / VB_W, dy = (pt.y - drag.p0.y) / PH;

      if (drag.kind === 'room') {
        doc.room = { x: clamp(r0.x + dx, 0, 1 - r0.w), y: clamp(r0.y + dy, 0, 1 - r0.h), w: r0.w, h: r0.h };
      } else {
        const d = drag.dir;
        let x = r0.x, y = r0.y, w = r0.w, h = r0.h;
        if (d.indexOf('w') >= 0) { x = r0.x + dx; w = r0.w - dx; }
        if (d.indexOf('e') >= 0) { w = r0.w + dx; }
        if (d.indexOf('n') >= 0) { y = r0.y + dy; h = r0.h - dy; }
        if (d.indexOf('s') >= 0) { h = r0.h + dy; }
        const MIN = 0.07;
        if (w < MIN) { if (d.indexOf('w') >= 0) x = r0.x + r0.w - MIN; w = MIN; }
        if (h < MIN) { if (d.indexOf('n') >= 0) y = r0.y + r0.h - MIN; h = MIN; }
        /* Shift를 누르면 모서리에서 비율을 지킨다 */
        if (ev.shiftKey && d.length === 2) {
          const ar = (r0.w * VB_W) / (r0.h * PH);
          h = (w * VB_W / ar) / PH;
          if (d.indexOf('n') >= 0) y = r0.y + r0.h - h;
          if (d.indexOf('w') >= 0) x = r0.x + r0.w - w;
        }
        doc.room = { x: clamp(x, 0, 1 - w), y: clamp(y, 0, 1 - h), w: w, h: h };
        /* 방이 커지고 작아지는 만큼 등도 함께 — 넓이 기준이라 등 모양은 그대로다 */
        const k = Math.sqrt((doc.room.w * doc.room.h) / (r0.w * r0.h));
        doc.lights.forEach((l, i) => {
          const o = drag.lights0[i]; if (!o) return;
          l.w = clamp(o.w * k, 10, 700); l.h = clamp(o.h * k, 6, 700);
        });
      }
      renderPlan(); return;
    }

    if (Math.abs(ev.clientX - drag.x0) + Math.abs(ev.clientY - drag.y0) < 4) return;
    if (!drag.saved) { snapshot(); drag.saved = true; }
    drag.moved = true;
    const rb = roomBox();
    if (drag.kind === 'light') {
      const l = doc.lights.filter(x => x.id === drag.id)[0];
      if (l) { l.nx = clamp((pt.x - rb.x) / rb.w, 0, 1); l.ny = clamp((pt.y - rb.y) / rb.h, 0, 1); }
    } else {
      const sw = doc.switches.filter(x => x.id === drag.id)[0];
      if (sw) { sw.nx = clamp(pt.x / VB_W, 0, 1); sw.ny = clamp(pt.y / paperH(), 0, 1); }
    }
    renderPlan();
  });

  svg.addEventListener('pointerup', ev => {
    if (!drag) return;
    const d = drag; drag = null;
    try { svg.releasePointerCapture(ev.pointerId); } catch (e) {}

    if (!d.moved && d.kind === 'light' && ui.activeGang) {
      const g = findGang(ui.activeGang);
      if (g) {
        snapshot();
        const i = g.lightIds.indexOf(d.id);
        if (i >= 0) g.lightIds.splice(i, 1); else g.lightIds.push(d.id);
      }
    }
    persist(); render();
  });
}

/* ============================================================
   색 고르기
   ============================================================ */
function closeColorPop() {
  const el = document.getElementById('color-pop');
  if (el) el.remove();
  document.removeEventListener('pointerdown', onPopOutside, true);
}
function onPopOutside(ev) {
  if (!ev.target.closest('#color-pop')) closeColorPop();
}
function openColorPop(gangId, anchor) {
  closeColorPop();
  const g = findGang(gangId); if (!g) return;
  snapshot();

  let sw = '';
  PALETTE.forEach(c => {
    const on = c.toLowerCase() === String(g.color).toLowerCase();
    sw += '<button class="pop-sw' + (on ? ' on' : '') + '" data-c="' + c + '" style="background:' + c +
          '" title="' + (c === GANG_GRAY ? '색 없음' : c) + '"></button>';
  });
  const el = document.createElement('div');
  el.className = 'pop'; el.id = 'color-pop';
  el.innerHTML = '<div class="pop-grid">' + sw + '</div>' +
    '<div class="pop-foot"><span>직접 고르기</span>' +
    '<input type="color" id="pop-custom" value="' + esc(g.color) + '"></div>';
  document.body.appendChild(el);

  /* 화면 밖으로 나가지 않게 앉힌다 */
  const r = anchor.getBoundingClientRect();
  el.style.left = clamp(r.right - el.offsetWidth, 8, window.innerWidth - el.offsetWidth - 8) + 'px';
  el.style.top = (r.bottom + 8 + el.offsetHeight > window.innerHeight
    ? Math.max(8, r.top - el.offsetHeight - 8) : r.bottom + 8) + 'px';

  const apply = (c, done) => {
    g.color = c;
    if (done) { persist(); render(); closeColorPop(); }
    else {
      renderPlan();
      anchor.style.background = c;
      const btn = document.querySelector('[data-act="pick-gang"][data-id="' + g.id + '"]');
      if (btn) { btn.style.background = c; btn.style.color = inkOn(c); }
      $$('.pop-sw', el).forEach(b => b.classList.toggle('on', b.dataset.c.toLowerCase() === c.toLowerCase()));
    }
  };
  $$('.pop-sw', el).forEach(b => b.onclick = () => apply(b.dataset.c, true));
  const ci = $('#pop-custom', el);
  ci.oninput = () => apply(ci.value, false);
  ci.onchange = () => apply(ci.value, true);

  setTimeout(() => document.addEventListener('pointerdown', onPopOutside, true), 0);
}

/* ============================================================
   모달
   ============================================================ */
function openModal(html, onMount) {
  $('#modal').innerHTML = html;
  $('#modal-back').hidden = false;
  if (onMount) onMount($('#modal'));
}
function closeModal() { $('#modal-back').hidden = true; $('#modal').innerHTML = ''; }

function openTemplateModal() {
  let h = '<h3>사전 양식 불러오기</h3><p class="m-sub">가까운 모양을 고르면 방 비율·등 배치·스위치가 한 번에 채워집니다. 불러온 뒤 자유롭게 고칠 수 있습니다.</p><div class="tpl-list">';
  TEMPLATES.forEach(t => {
    let mini = '';
    for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) {
      const w = t.shape === 'bar' ? 12 : 6, hh = t.shape === 'bar' ? 4 : 6;
      const br = t.shape === 'circle' ? '50%' : '1px';
      mini += '<i style="left:' + ((c + 0.5) / t.cols * 100) + '%;top:' + ((r + 0.5) / t.rows * 100) +
              '%;width:' + w + 'px;height:' + hh + 'px;border-radius:' + br + '"></i>';
    }
    h += '<button class="tpl" data-tpl="' + t.id + '"><span class="tpl-mini">' + mini + '</span>' +
         '<span class="tpl-txt"><strong>' + esc(t.name) + '</strong><small>' + esc(t.desc) + '</small></span></button>';
  });
  h += '</div><div class="note">불러오면 지금 배치한 등과 스위치 연결이 새 양식으로 바뀝니다. (되돌리기로 복구 가능)</div>' +
       '<div class="modal-row"><button class="m-btn" data-close>취소</button></div>';

  openModal(h, m => {
    $$('[data-tpl]', m).forEach(b => b.onclick = () => {
      const t = TEMPLATES.filter(x => x.id === b.dataset.tpl)[0];
      snapshot();
      placeRoom(t.ratio[0], t.ratio[1]);
      doc.sides = Object.assign({ top: '', right: '', bottom: '', left: '' }, t.sides);
      doc.switches = [];
      ui.shape = t.shape;
      gridPlace(t.rows, t.cols, t.shape);
      const sw = addSwitch(t.gangs);
      /* 등을 앞뒤 구역으로 나눠 임시 배정 — 출발점만 잡아준다 */
      const per = Math.ceil(doc.lights.length / t.gangs);
      doc.lights.slice().sort((a, b2) => (a.ny - b2.ny) || (a.nx - b2.nx))
        .forEach((l, i) => sw.gangs[Math.min(t.gangs - 1, Math.floor(i / per))].lightIds.push(l.id));
      ui.activeGang = null; ui.sel = null;
      persist(); render(); closeModal();
    });
  });
}

function openGridModal() {
  openModal('<h3>등을 격자로 배치</h3><p class="m-sub">가로·세로 개수를 넣으면 방 안에 고르게 놓습니다.</p>' +
    '<div class="num-row"><label>가로 개수</label><input type="number" id="g-cols" min="1" max="20" value="3"></div>' +
    '<div class="num-row"><label>세로 개수</label><input type="number" id="g-rows" min="1" max="20" value="3"></div>' +
    '<div class="note">기존 등과 스위치 연결이 모두 지워지고 새로 놓입니다.</div>' +
    '<div class="modal-row"><button class="m-btn" data-close>취소</button>' +
    '<button class="m-btn primary" id="g-ok">배치하기</button></div>', m => {
    $('#g-ok', m).onclick = () => {
      const c = clamp(parseInt($('#g-cols', m).value, 10) || 1, 1, 20);
      const r = clamp(parseInt($('#g-rows', m).value, 10) || 1, 1, 20);
      snapshot(); gridPlace(r, c, ui.shape); persist(); render(); closeModal();
    };
  });
}

function openSwitchModal() {
  openModal('<h3>스위치 추가</h3><p class="m-sub">스위치판에 버튼이 몇 개 달려 있나요? (보통 “○구”라고 부릅니다)</p>' +
    '<div class="num-row"><label>버튼 개수</label><input type="number" id="s-n" min="1" max="8" value="2"></div>' +
    '<div class="note">생김새는 추가한 뒤 오른쪽 목록에서 바꿀 수 있습니다. 기본값은 버튼이 위아래로 쌓인 매입형이며, 4구가 넘으면 두 줄로 그려집니다.</div>' +
    '<div class="modal-row"><button class="m-btn" data-close>취소</button>' +
    '<button class="m-btn primary" id="s-ok">추가</button></div>', m => {
    $('#s-ok', m).onclick = () => {
      snapshot();
      ui.activeGang = addSwitch(clamp(parseInt($('#s-n', m).value, 10) || 2, 1, 8)).gangs[0].id;
      persist(); render(); closeModal();
    };
  });
}

function openLeaveModal() {
  openModal('<h3>처음 화면으로 나갈까요?</h3>' +
    '<p class="m-sub">지금까지 만든 안내판은 이 브라우저에 저장돼 있어, 다시 들어오면 그대로 이어서 고칠 수 있습니다.</p>' +
    '<div class="note">다른 기기에서도 이어서 고치려면 나가기 전에 <b>작업 저장</b>을 눌러 작업 파일을 내려받아 두세요. 인쇄물은 <b>인쇄 / PDF</b>로 따로 뽑습니다.</div>' +
    '<div class="modal-row"><button class="m-btn" data-close>계속 편집</button>' +
    '<button class="m-btn primary" id="lv-ok">나가기</button></div>', m => {
    $('#lv-ok', m).onclick = () => { closeModal(); go('home'); };
  });
}

/* ============================================================
   인쇄
   ============================================================ */
const EMBEDDED = (function () { try { return window.top !== window.self; } catch (e) { return true; } })();
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 6000);
}

function buildPrintSheet() {
  const title = doc.title.trim() || '조명 스위치 안내';
  const d = new Date();
  const stamp = d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';

  let lg = '';
  doc.switches.forEach(sw => {
    const p = plateSVG(sw);
    let items = '';
    sw.gangs.forEach(g => {
      const t = dlabel(g);
      items += '<li><span class="lg-dot" style="background:' + g.color + '"></span>' +
               '<b>' + esc(t === g.label ? t + '번' : t) + '</b><span>' +
               (g.desc ? esc(g.desc) + ' · ' : '') + '등 ' + g.lightIds.length + '개</span></li>';
    });
    lg += '<div class="lg-sw"><div class="lg-sw-name">' + esc(sw.name) + '</div>' +
          '<div class="lg-sw-body">' +
          '<svg class="lg-plate" viewBox="0 0 ' + p.w + ' ' + p.h + '" width="' + Math.round(p.w * 0.7) + '">' + p.svg + '</svg>' +
          '<ul class="lg-list">' + items + '</ul></div></div>';
  });

  const root = document.getElementById('print-root');
  root.innerHTML =
    '<div class="sheet">' +
      '<div class="sheet-head"><h1>' + esc(title) + '</h1><div class="sh-tag">조명 스위치 안내판</div></div>' +
      '<div class="sheet-plan"><svg id="p-svg" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="' + VB_W + '" height="' + paperH() + '" fill="#ffffff"/>' + planSVG(true) + '</svg></div>' +
      (lg ? '<h2 class="lg-title">스위치 · 버튼별 안내</h2><div class="lg-grid">' + lg + '</div>' : '') +
      '<div class="sheet-foot"><span>등 안의 숫자 = 그 등을 켜는 스위치 버튼 번호</span><span>' + stamp + '</span></div>' +
    '</div>';

  /* 내용이 있는 만큼만 잘라낸다 — 작업 캔버스의 빈 곳은 인쇄되지 않는다 */
  const svg = document.getElementById('p-svg');
  svg.setAttribute('viewBox', '0 0 ' + VB_W + ' ' + paperH());
  /* A4 세로, 좌우 14mm 여백 → 쓸 수 있는 폭 182mm.
     종이가 세로로 길면 폭을 줄여 범례가 같은 쪽에 남게 한다. */
  const PAGE_W = 182, PLAN_H = 150;
  svg.style.width = Math.min(PAGE_W, PLAN_H * paperAspect()) + 'mm';
}

/* ============================================================
   파일 저장 / 불러오기
   ============================================================ */
function saveFile() {
  const name = (doc.title.trim() || '조명안내판').replace(/[\\/:*?"<>|]/g, '') + '.json';
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  if (EMBEDDED) toast('내려받기가 막힌 화면입니다. 파일이 저장되지 않았다면 이 페이지를 새 탭에서 열고 다시 눌러주세요.');
}
function loadFile(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || !Array.isArray(d.lights)) throw new Error('형식이 다릅니다');
      doc = migrate(d);
      ui.sel = null; ui.activeGang = null; undoStack = [];
      persist(); go('editor'); render();
    } catch (e) { alert('불러올 수 없는 파일입니다. 이 사이트에서 저장한 .json 파일을 골라주세요.'); }
  };
  rd.readAsText(file);
}

/* ============================================================
   화면 전환 · 이벤트
   ============================================================ */
function go(screen) {
  ui.screen = screen;
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === 'screen-' + screen));
  if (screen === 'editor') { $('#doc-title').value = doc.title; render(); }
}

function boot() {
  const had = restore();

  $('#btn-start').onclick = () => go('choose');
  $('#btn-load-file').onclick = () => $('#file-input').click();
  $('#file-input').onchange = e => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; };
  $$('[data-goto]').forEach(b => b.onclick = () => go(b.dataset.goto));
  $('#btn-home').onclick = openLeaveModal;

  $$('[data-blueprint]').forEach(b => b.onclick = () => {
    const yes = b.dataset.blueprint === 'yes';
    doc = blankDoc(); doc.hasBlueprint = yes; undoStack = [];
    ui.sel = null; ui.activeGang = null;
    if (!yes) { placeRoom(4, 3); gridPlace(3, 3, 'bar'); doc.sides.top = '칠판 (앞쪽)'; }
    persist(); go('editor');
    if (!yes) setTimeout(openTemplateModal, 220);
  });

  $('#doc-title').oninput = e => { doc.title = e.target.value; persist(); };
  $('#btn-template').onclick = openTemplateModal;
  $('#btn-add-switch').onclick = openSwitchModal;
  $('#btn-save-file').onclick = saveFile;
  $('#btn-grid').onclick = openGridModal;
  $('#btn-undo').onclick = undo;
  $('#btn-print').onclick = () => {
    buildPrintSheet();
    setTimeout(() => {
      try { window.print(); } catch (e) {}
      if (EMBEDDED) toast('인쇄 창이 뜨지 않으면, 이 페이지를 새 탭에서 연 뒤 다시 눌러주세요.');
    }, 60);
  };

  $$('#dock .dock-btn[data-tool]').forEach(b => b.onclick = () => {
    ui.tool = b.dataset.tool; ui.sel = null; render();
  });
  $$('#dock-shapes .shape-btn').forEach(b => b.onclick = () => {
    ui.shape = b.dataset.shape;
    if (ui.sel && ui.sel.t === 'light') {
      const l = doc.lights.filter(x => x.id === ui.sel.id)[0];
      if (l) { snapshot(); l.shape = ui.shape; l.w = SHAPES[ui.shape].w; l.h = SHAPES[ui.shape].h; persist(); }
    }
    render();
  });

  $('#modal-back').onclick = e => {
    if (e.target.id === 'modal-back' || e.target.hasAttribute('data-close')) closeModal();
  };

  document.addEventListener('keydown', e => {
    if (ui.screen !== 'editor') return;
    const t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    if (e.key === 'Escape') { ui.activeGang = null; ui.sel = null; closeModal(); closeColorPop(); render(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && ui.sel && ui.sel.t === 'light') {
      e.preventDefault(); snapshot(); removeLight(ui.sel.id); persist(); render();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if (e.key === 'v') { ui.tool = 'select'; render(); }
    if (e.key === 'l') { ui.tool = 'light'; render(); }
    if (e.key === 'e') { ui.tool = 'erase'; render(); }
  });

  bindCanvas();

  if (had && (doc.lights.length || doc.switches.length)) go('editor');
  else go('home');
}

document.addEventListener('DOMContentLoaded', boot);
})();
