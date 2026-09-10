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
const STORE = 'switchdeung.doc.v3';
const FONT  = "'Apple SD Gothic Neo','Malgun Gothic',sans-serif";

/* 등 모양과 크기. 편집 툴바에서 고른 모양을 한 번 더 누르면 크기를 고른다. */
const SIZES = {
  bar:    { s: { w: 70, h: 16 }, m: { w: 106, h: 24 },  l: { w: 148, h: 32 } },
  vbar:   { s: { w: 16, h: 70 }, m: { w: 24,  h: 106 }, l: { w: 32,  h: 148 } },
  square: { s: { w: 36, h: 36 }, m: { w: 52,  h: 52 },  l: { w: 72,  h: 72 } },
  circle: { s: { w: 36, h: 36 }, m: { w: 52,  h: 52 },  l: { w: 72,  h: 72 } }
};
const SIZE_NAMES = { s: '소', m: '중', l: '대' };
function sizeOf(shape, key) { return SIZES[shape][key] || SIZES[shape].m; }
/* 종이는 A4 가로 하나뿐이다.
   A 계열(A5·A4·A3·A2)은 모두 같은 1:√2 모양이라, 이 한 비율로 어떤 크기에 뽑아도 꽉 찬다. */
/* 화면에서 보는 것이 곧 인쇄되는 A4 세로 한 장이다.
   위에서부터 제목 칸 · 방 칸 · 스위치 칸으로 나뉜다. */
const PAPER_H = Math.round(VB_W * 297 / 210);   /* 1414 */
const M = 42;                                   /* 종이 안쪽 여백 */
const TITLE_H = 140;                            /* 제목 칸 아래 경계 */
const ROOM_BOTTOM = 810;                        /* 방 칸 아래 경계 */
const MAX_SWITCHES = 4;
const FOOT_H = 34;                              /* 맨 아래 사이트 주소 자리 */
const SITE = 'dhrhfrp0.github.io/switch-light';
function roomBand() { return { x: M, y: TITLE_H, w: VB_W - M * 2, h: ROOM_BOTTOM - TITLE_H }; }
function switchBand() { return { x: M, y: ROOM_BOTTOM, w: VB_W - M * 2, h: PAPER_H - M - FOOT_H - ROOM_BOTTOM }; }
/* 스위치는 개수에 맞춰 칸을 나눈다 */
function switchCells(n) {
  const b = switchBand(), cols = n <= 1 ? 1 : 2, rows = Math.ceil(n / cols);
  const cw = b.w / cols, ch = b.h / rows, out = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: b.x + (i % cols) * cw, y: b.y + Math.floor(i / cols) * ch, w: cw, h: ch });
  }
  return { cells: out, cols: cols, rows: rows, band: b };
}

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
    v: 3, title: '', hasBlueprint: false,
    room: { x: 0.03, y: 0.06, w: 0.94, h: 0.88 },
    bg: null, bgOpacity: 0.45,
    sides: { top: '', right: '', bottom: '', left: '' },
    lights: [], switches: []
  };
}
let doc = blankDoc();
let ui  = { screen: 'home', tool: 'select', shape: 'bar', size: 'm', sel: null, activeGang: null, guides: [] };
let undoStack = [];

/* 예전 판으로 저장한 내용도 열리도록 맞춰준다 */
function migrate(d) {
  d = Object.assign(blankDoc(), d || {});
  /* 종이가 A4 세로 한 장으로 바뀌기 전에 저장한 것.
     등은 방 기준 좌표라 그대로 살아 있으니, 방만 새 칸에 다시 앉히면 된다. */
  if (d.v !== 3 || !d.room || typeof d.room.w !== 'number') {
    const b = roomBand();
    d.room = { x: 0.03, y: 0.06, w: 0.94, h: 0.88 };
  }
  (d.switches || []).forEach(sw => {
    sw.style = STYLE_ALIAS[sw.style] || sw.style || 'k-v';
    delete sw.nx; delete sw.ny;
    (sw.gangs || []).forEach(g => { if (!g.color) g.color = GANG_GRAY; });
  });
  if (d.switches && d.switches.length > MAX_SWITCHES) d.switches = d.switches.slice(0, MAX_SWITCHES);
  d.v = 3;
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
let persistWarned = false;
function persist() {
  try {
    localStorage.setItem(STORE, JSON.stringify(doc));
    persistWarned = false;
  } catch (e) {
    /* 저장 공간이 가득 찼는데 아무 말 없이 넘어가면, 새로고침했을 때 작업이 사라진다 */
    if (!persistWarned) {
      persistWarned = true;
      toast('브라우저에 자동 저장하지 못했습니다. 작업이 사라지지 않도록 “작업 저장”으로 파일을 내려받아 두세요.');
    }
  }
}
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
  const r = doc.room, b = roomBand();
  return { x: b.x + r.x * b.w, y: b.y + r.y * b.h, w: r.w * b.w, h: r.h * b.h };
}
function svgPoint(ev) {
  const r = $('#plan').getBoundingClientRect();
  return { x: (ev.clientX - r.left) * (VB_W / r.width), y: (ev.clientY - r.top) * (paperH() / r.height) };
}
function toRoomNorm(pt) {
  const rb = roomBox();
  return { nx: clamp((pt.x - rb.x) / rb.w, 0, 1), ny: clamp((pt.y - rb.y) / rb.h, 0, 1) };
}
/* 방을 주어진 가로:세로 모양으로 방 칸 안에 앉힌다 */
function placeRoom(aw, ah) {
  const b = roomBand();
  const maxW = b.w * 0.94, maxH = b.h * 0.88;
  let w = maxW, h = w * ah / aw;
  if (h > maxH) { h = maxH; w = h * aw / ah; }
  doc.room = { x: 0.5 - (w / b.w) / 2, y: (b.h - h) / 2 / b.h, w: w / b.w, h: h / b.h };
}



/* ── 줄 맞추기 ──────────────────────────────────────────
   끌 때 다른 등·스위치판과 줄이 맞으면 살짝 붙고 안내선을 보여준다. */
/* 붙는 거리는 화면에서 늘 비슷하게 느껴져야 한다.
   뷰박스 단위로 고정해 두면 종이가 작게 보일수록 판정이 깐깐해져 손가락으로 맞추기 어렵다. */
function snapDist() {
  const r = $('#plan').getBoundingClientRect();
  return r.width ? (9 * VB_W / r.width) : 9;   /* 화면에서 9px쯤 */
}
function nearest(want, cands) {
  const snap = snapDist();
  let best = null;
  cands.forEach(c => {
    const d = Math.abs(want - c.at);
    if (d <= snap && (!best || d < best.d)) best = { d: d, at: c.at, line: c.line };
  });
  return best;
}
function snapTo(pt, vx, hy) {
  const sx = nearest(pt.x, vx), sy = nearest(pt.y, hy), guides = [];
  if (sx) guides.push({ axis: 'v', at: sx.line });
  if (sy) guides.push({ axis: 'h', at: sy.line });
  return { x: sx ? sx.at : pt.x, y: sy ? sy.at : pt.y, guides: guides };
}
/* 끄는 등의 중심·양 끝이 다른 등의 중심·양 끝, 방 한가운데와 맞는 자리 */
function snapLight(l, pt) {
  const rb = roomBox(), hw = l.w / 2, hh = l.h / 2, vx = [], hy = [];
  doc.lights.forEach(o => {
    if (o.id === l.id) return;
    const ox = rb.x + o.nx * rb.w, oy = rb.y + o.ny * rb.h, ow = o.w / 2, oh = o.h / 2;
    vx.push({ at: ox, line: ox }, { at: ox - ow + hw, line: ox - ow }, { at: ox + ow - hw, line: ox + ow });
    hy.push({ at: oy, line: oy }, { at: oy - oh + hh, line: oy - oh }, { at: oy + oh - hh, line: oy + oh });
  });
  const cx = rb.x + rb.w / 2, cy = rb.y + rb.h / 2;
  vx.push({ at: cx, line: cx }); hy.push({ at: cy, line: cy });
  return snapTo(pt, vx, hy);
}
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
  const like = size || sizeOf(sp, ui.size);
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
  const sw = {
    id: uid(), style: 'k-v',
    name: n === 0 ? '출입문 옆 스위치' : '스위치 ' + (n + 1),
    gangs: []
  };
  doc.switches.push(sw);   /* 색이 겹치지 않으려면 먼저 등록한 뒤 버튼을 만들어야 한다 */
  for (let i = 0; i < (gangCount || 2); i++) sw.gangs.push(newGang(sw, i));
  return sw;
}
function gridPlace(rows, cols, shape) {
  doc.lights = [];
  doc.switches.forEach(sw => sw.gangs.forEach(g => { g.lightIds = []; }));
  const sp = shape || ui.shape, base = sizeOf(sp, ui.size), rb = roomBox(), pad = 0.10;
  /* 등이 빽빽할수록 작게 그린다 — 안 그러면 서로 겹친다 */
  const stepX = cols > 1 ? rb.w * (1 - pad * 2) / (cols - 1) : rb.w * 0.8;
  const stepY = rows > 1 ? rb.h * (1 - pad * 2) / (rows - 1) : rb.h * 0.8;
  let size;
  if (sp === 'bar') {
    const w = clamp(stepX * 0.82, 28, base.w);
    size = { w: w, h: clamp(w * 0.23, 8, base.h) };
  } else if (sp === 'vbar') {
    const h = clamp(stepY * 0.82, 28, base.h);
    size = { w: clamp(h * 0.23, 8, base.w), h: h };
  } else {
    const d = clamp(Math.min(stepX, stepY) * 0.62, 18, base.w);
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
/* 배경 평면도 그림.
   사진은 base64 글자로 아주 길어서, 끌 때마다 도면을 통째로 다시 만들면
   매 순간 사진을 다시 읽느라 뚝뚝 끊긴다. 그래서 이 조각만 따로 두고
   끄는 동안에는 자리(x·y·크기)만 고쳐 준다. */
function bgSVG() {
  if (!doc.bg) return '';
  const rb = roomBox();
  return '<image id="bg-img" href="' + esc(doc.bg) + '" x="' + rb.x + '" y="' + rb.y +
         '" width="' + rb.w + '" height="' + rb.h +
         '" preserveAspectRatio="xMidYMid meet" opacity="' + doc.bgOpacity + '"/>';
}
function planSVG(forPrint) {
  const rb = roomBox();
  let s = '';

  /* 제목 칸 */
  if (doc.title.trim()) {
    s += '<text font-family="' + FONT + '" x="' + M + '" y="' + (M + 52) +
         '" font-size="46" font-weight="800" fill="#111">' + esc(doc.title.trim()) + '</text>';
  }
  const sep = y => '<line x1="' + M + '" y1="' + y + '" x2="' + (VB_W - M) + '" y2="' + y +
                   '" stroke="#c9ccd2" stroke-width="1.6" stroke-dasharray="8 6"/>';
  s += sep(TITLE_H) + sep(ROOM_BOTTOM);

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
    /* 글자가 등 밖으로 삐져나오지 않게 가로·세로 모두에 맞춰 줄인다 */
    const base = (l.shape === 'square' || l.shape === 'circle') ? 24 : 20;
    const qs = clamp(Math.min(16, l.h * 0.62, l.w * 0.62), 7, 16);
    let fs = base;
    if (txt) fs = clamp(Math.min(base, (l.w - 6) / (txt.length * 0.62), (l.h - 5) / 1.15), 7, base);
    const label = txt
      ? '<text font-family="' + FONT + '" x="' + cx + '" y="' + (cy + fs * 0.35) + '" font-size="' + fs +
        '" font-weight="800" fill="' + inkOn(fill) + '" text-anchor="middle">' + esc(txt) + '</text>'
      : '<text font-family="' + FONT + '" x="' + cx + '" y="' + (cy + qs * 0.35) + '" font-size="' + qs +
        '" font-weight="700" fill="#9aa2ad" text-anchor="middle">?</text>';
    s += '<g data-light="' + l.id + '" opacity="' + op + '" style="cursor:pointer">' + shp + label + '</g>';
  });

  /* 스위치 칸 — 스위치마다 한 칸씩, 최대 넷 */
  const lay = switchCells(doc.switches.length);
  lay.cells.forEach((c, i) => {
    const sw = doc.switches[i], pad = 20;
    if (!forPrint && ui.activeGang && sw.gangs.some(g => g.id === ui.activeGang)) {
      s += '<rect x="' + (c.x + 3) + '" y="' + (c.y + 3) + '" width="' + (c.w - 6) + '" height="' + (c.h - 6) +
           '" rx="10" fill="#14161a08" stroke="#111111" stroke-width="2" stroke-dasharray="6 4"/>';
    }
    s += '<text font-family="' + FONT + '" x="' + (c.x + pad) + '" y="' + (c.y + pad + 24) +
         '" font-size="26" font-weight="800" fill="#111">' + esc(sw.name) + '</text>';

    const p = plateSVG(sw);
    const k = Math.min(1, (c.h - pad * 2 - 44) / p.h);
    const px = c.x + pad, py = c.y + pad + 44;
    s += '<g transform="translate(' + px + ' ' + py + ') scale(' + k + ')">' + p.svg + '</g>';

    /* 버튼마다 무엇을 켜는지 */
    let ty = py + 26;
    const tx = px + p.w * k + 26;
    sw.gangs.forEach(g => {
      const t = dlabel(g);
      s += '<rect x="' + tx + '" y="' + (ty - 14) + '" width="18" height="18" rx="4" fill="' + g.color + '"/>' +
           '<text font-family="' + FONT + '" x="' + (tx + 27) + '" y="' + ty +
           '" font-size="20" font-weight="800" fill="#111">' + esc(t) + '</text>' +
           '<text font-family="' + FONT + '" x="' + (tx + 27 + t.length * 13 + 12) + '" y="' + ty +
           '" font-size="18" fill="#555">' +
           esc((g.desc ? g.desc + ' · ' : '') + '등 ' + g.lightIds.length + '개') + '</text>';
      ty += 30;
    });
  });
  /* 칸 나누는 선 */
  if (lay.cells.length > 1) {
    const b = lay.band;
    if (lay.cols === 2) {
      s += '<line x1="' + (b.x + b.w / 2) + '" y1="' + (b.y + 10) + '" x2="' + (b.x + b.w / 2) +
           '" y2="' + (b.y + b.h - 10) + '" stroke="#d7dade" stroke-width="1.4"/>';
    }
    for (let r = 1; r < lay.rows; r++) {
      const yy = b.y + (b.h / lay.rows) * r;
      s += '<line x1="' + b.x + '" y1="' + yy + '" x2="' + (b.x + b.w) + '" y2="' + yy +
           '" stroke="#d7dade" stroke-width="1.4"/>';
    }
  }

  /* 맨 아래 사이트 주소 */
  s += '<text font-family="' + FONT + '" x="' + (VB_W / 2) + '" y="' + (PAPER_H - 20) +
       '" font-size="15" fill="#a6abb3" text-anchor="middle">' + SITE + '</text>';

  /* 줄 맞춤 안내선 */
  if (!forPrint && ui.guides.length) {
    ui.guides.forEach(g => {
      const c = g.axis === 'v'
        ? 'x1="' + g.at + '" y1="0" x2="' + g.at + '" y2="' + PAPER_H + '"'
        : 'x1="0" y1="' + g.at + '" x2="' + VB_W + '" y2="' + g.at + '"';
      s += '<line ' + c + ' stroke="#e93d82" stroke-width="1.4" stroke-dasharray="7 5"/>';
    });
  }

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
    /* 점은 늘 종이 안에 두고, 잡는 범위는 눈에 보이는 것보다 넉넉하게 준다.
       종이 끝에 걸치면 손가락은커녕 마우스로도 잡히지 않아 방을 되돌릴 수 없었다. */
    const HIT = 34;
    pts.forEach(q => {
      const hx = clamp(q[1], half + 1, VB_W - half - 1);
      const hy = clamp(q[2], half + 1, PAPER_H - half - 1);
      s += '<g data-handle="' + q[0] + '" style="cursor:' + q[3] + '">' +
           '<rect x="' + (hx - HIT / 2) + '" y="' + (hy - HIT / 2) + '" width="' + HIT + '" height="' + HIT +
           '" fill="none" pointer-events="all"/>' +
           '<rect x="' + (hx - half) + '" y="' + (hy - half) + '" width="' + H + '" height="' + H +
           '" rx="2.5" fill="#ffffff" stroke="#2563eb" stroke-width="2"/>' +
           '</g>';
    });
  }
  return s;
}

function renderPlan() {
  const svg = $('#plan');
  $('#paper').style.aspectRatio = VB_W + ' / ' + PAPER_H;
  svg.setAttribute('viewBox', '0 0 ' + VB_W + ' ' + PAPER_H);
  svg.innerHTML = '<rect width="' + VB_W + '" height="' + PAPER_H + '" fill="#ffffff"/>' +
                  '<g id="lay-bg">' + bgSVG() + '</g>' +
                  '<g id="lay-fg">' + planSVG(false) + '</g>';
}
/* 끄는 동안 쓰는 가벼운 다시 그리기 — 배경 사진은 건드리지 않는다 */
function renderDrag() {
  const fg = document.getElementById('lay-fg');
  if (!fg || (doc.bg && !document.getElementById('bg-img'))) { renderPlan(); return; }
  const img = document.getElementById('bg-img');
  if (img) {
    const rb = roomBox();
    img.setAttribute('x', rb.x); img.setAttribute('y', rb.y);
    img.setAttribute('width', rb.w); img.setAttribute('height', rb.h);
  }
  fg.innerHTML = planSVG(false);
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
      h += '<div class="field"><label>진하기 <b id="bg-op-val">' + Math.round(doc.bgOpacity * 100) + '</b>%</label>' +
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
    inp.oninput = () => {
      const g = findGang(inp.dataset.gangDesc);
      if (g) { g.desc = inp.value; persist(); renderPlan(); }
    };
  });
  $$('[data-side]', p).forEach(inp => {
    inp.oninput = () => { doc.sides[inp.dataset.side] = inp.value; persist(); renderPlan(); };
  });

  const bf = $('#bg-file', p);
  if (bf) bf.onchange = () => {
    const f = bf.files && bf.files[0];
    if (f) loadBlueprint(f);
  };
  const op = $('#bg-op', p);
  if (op) {
    /* 끄는 내내 숫자와 사진이 같이 따라오게 한다.
       숫자는 곧바로 고쳐 쓰고, 사진은 한 프레임에 한 번만 고쳐
       손가락을 빨리 움직여도 일이 밀리지 않게 한다. */
    const val = $('#bg-op-val', p);
    let raf = 0;
    op.addEventListener('input', () => {
      const v = +op.value;
      doc.bgOpacity = v / 100;
      if (val) val.textContent = v;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        const im = document.getElementById('bg-img');
        /* style 쪽이 attribute보다 다시 칠하는 비용이 적다 */
        if (im) im.style.opacity = doc.bgOpacity; else renderPlan();
      });
    });
    op.addEventListener('change', () => persist());   /* 화면은 이미 맞으니 저장만 */
  }
}

function render() { renderPlan(); renderPanel(); renderDock(); renderHint(); }

/* ============================================================
   확대 · 축소 · 이동
   손가락 두 개로 벌리고 오므려 크기를, 그대로 끌어 자리를 바꾼다.
   종이(.paper)에 CSS 변형을 걸어 두면 좌표 계산은 손댈 필요가 없다 —
   svgPoint 가 실제로 그려진 크기를 재서 쓰기 때문이다.
   ============================================================ */
let view = { k: 1, x: 0, y: 0 };
const K_MIN = 0.4, K_MAX = 6;

function applyView() {
  const paper = $('#paper'), stage = $('#stage');
  if (!paper || !stage) return;
  view.k = clamp(view.k, K_MIN, K_MAX);
  const put = () => { paper.style.transform =
    'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.k + ')'; };
  put();
  /* 종이를 화면 밖으로 완전히 놓치지 않도록 붙잡아 둔다 */
  const st = stage.getBoundingClientRect(), r = paper.getBoundingClientRect(), pad = 90;
  let dx = 0, dy = 0;
  if (r.right  < st.left + pad)  dx = st.left + pad - r.right;
  if (r.left   > st.right - pad) dx = st.right - pad - r.left;
  if (r.bottom < st.top + pad)   dy = st.top + pad - r.bottom;
  if (r.top    > st.bottom - pad) dy = st.bottom - pad - r.top;
  if (dx || dy) { view.x += dx; view.y += dy; put(); }
  const zv = $('#zoom-val');
  if (zv) zv.textContent = Math.round(view.k * 100) + '%';
}
function resetView() { view = { k: 1, x: 0, y: 0 }; applyView(); }
/* 변형을 뺀 원래 자리 — 손짓이 이어지는 동안에는 바뀌지 않는다 */
function paperLayout() {
  const r = $('#paper').getBoundingClientRect();
  return { l: r.left - view.x, t: r.top - view.y };
}
/* 화면의 한 점을 붙잡은 채 크기를 바꾼다 */
function zoomAt(sx, sy, k2, lay) {
  k2 = clamp(k2, K_MIN, K_MAX);
  const px = (sx - lay.l - view.x) / view.k, py = (sy - lay.t - view.y) / view.k;
  view.x = sx - lay.l - k2 * px;
  view.y = sy - lay.t - k2 * py;
  view.k = k2;
}
function zoomStep(f) {
  const st = $('#stage').getBoundingClientRect();
  zoomAt(st.left + st.width / 2, st.top + st.height / 2, view.k * f, paperLayout());
  applyView();
}

function bindZoom() {
  const stage = $('#stage');
  const pts = new Map();
  let pinch = null;

  stage.addEventListener('pointerdown', ev => {
    if (ev.target.closest('.zoombar')) return;
    pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pts.size === 2) {
      canvasDrag = null;                 /* 한 손가락으로 끌던 것은 여기서 그만둔다 */
      ui.guides = [];
      const v = Array.from(pts.values());
      pinch = {
        d0: Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) || 1,
        mid0: { x: (v[0].x + v[1].x) / 2, y: (v[0].y + v[1].y) / 2 },
        k0: view.k, x0: view.x, y0: view.y, lay: paperLayout()
      };
      renderPlan();
      ev.stopPropagation();
    }
  }, true);

  stage.addEventListener('pointermove', ev => {
    if (!pts.has(ev.pointerId)) return;
    pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (!pinch || pts.size < 2) return;
    const v = Array.from(pts.values());
    const d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
    const mid = { x: (v[0].x + v[1].x) / 2, y: (v[0].y + v[1].y) / 2 };
    view.k = pinch.k0; view.x = pinch.x0; view.y = pinch.y0;
    zoomAt(pinch.mid0.x, pinch.mid0.y, pinch.k0 * (d / pinch.d0), pinch.lay);
    view.x += mid.x - pinch.mid0.x;
    view.y += mid.y - pinch.mid0.y;
    applyView();
    ev.stopPropagation(); ev.preventDefault();
  }, true);

  const end = ev => { pts.delete(ev.pointerId); if (pts.size < 2) pinch = null; };
  stage.addEventListener('pointerup', end, true);
  stage.addEventListener('pointercancel', end, true);

  /* 마우스·트랙패드 */
  stage.addEventListener('wheel', ev => {
    ev.preventDefault();
    if (ev.ctrlKey || ev.metaKey) {
      zoomAt(ev.clientX, ev.clientY, view.k * (ev.deltaY < 0 ? 1.12 : 1 / 1.12), paperLayout());
    } else {
      view.x -= ev.deltaX; view.y -= ev.deltaY;
    }
    applyView();
  }, { passive: false });

  $('#zoombar').onclick = ev => {
    const b = ev.target.closest('[data-zoom]'); if (!b) return;
    if (b.dataset.zoom === 'in') zoomStep(1.25);
    else if (b.dataset.zoom === 'out') zoomStep(1 / 1.25);
    else resetView();
  };
}

/* ============================================================
   캔버스 조작
   ============================================================ */
let canvasDrag = null;
function bindCanvas() {
  const svg = $('#plan');

  const inRoom = pt => {
    const rb = roomBox();
    return pt.x >= rb.x - 6 && pt.x <= rb.x + rb.w + 6 && pt.y >= rb.y - 6 && pt.y <= rb.y + rb.h + 6;
  };

  svg.addEventListener('pointerdown', ev => {
    const pt = svgPoint(ev);
    const lg = ev.target.closest('[data-light]');
    const hd = ev.target.closest('[data-handle]');

    if (ui.tool === 'erase' && lg) { snapshot(); removeLight(lg.dataset.light); persist(); render(); return; }

    if (ui.tool === 'light' && !lg && !hd) {
      const n = toRoomNorm(pt);
      snapshot(); addLight(n.nx, n.ny);
      if (ui.activeGang) findGang(ui.activeGang).lightIds.push(doc.lights[doc.lights.length - 1].id);
      persist(); render(); return;
    }

    if (hd) {
      svg.setPointerCapture(ev.pointerId);
      canvasDrag = { kind: 'resize', dir: hd.dataset.handle, p0: pt, room0: Object.assign({}, doc.room), saved: false };
      return;
    }
    if (lg) {
      svg.setPointerCapture(ev.pointerId);
      canvasDrag = { kind: 'light', id: lg.dataset.light,
               x0: ev.clientX, y0: ev.clientY, moved: false, saved: false };
      if (ui.tool === 'select') { ui.sel = { t: 'light', id: canvasDrag.id }; renderPlan(); renderHint(); }
      return;
    }
    if (ui.tool === 'select' && inRoom(pt)) {
      svg.setPointerCapture(ev.pointerId);
      canvasDrag = { kind: 'room', p0: pt, room0: Object.assign({}, doc.room), moved: false, saved: false };
      const was = ui.sel && ui.sel.t === 'room';
      ui.sel = { t: 'room', id: 'room' };
      if (!was) { renderPlan(); renderHint(); }
      return;
    }
    if (ui.tool === 'select') { ui.sel = null; renderPlan(); renderHint(); }
  });

  svg.addEventListener('pointermove', ev => {
    if (!canvasDrag) return;
    const pt = svgPoint(ev);

    if (canvasDrag.kind === 'resize' || canvasDrag.kind === 'room') {
      if (!canvasDrag.saved) { snapshot(); canvasDrag.saved = true; }
      const bd = roomBand();
      const r0 = canvasDrag.room0, dx = (pt.x - canvasDrag.p0.x) / bd.w, dy = (pt.y - canvasDrag.p0.y) / bd.h;

      if (canvasDrag.kind === 'room') {
        /* 방 한가운데를 방 칸 한가운데에 맞춰 준다 */
        const cx = bd.x + bd.w / 2, cy = bd.y + bd.h / 2;
        const sn = snapTo(
          { x: bd.x + (r0.x + dx + r0.w / 2) * bd.w, y: bd.y + (r0.y + dy + r0.h / 2) * bd.h },
          [{ at: cx, line: cx }], [{ at: cy, line: cy }]);
        ui.guides = sn.guides;
        doc.room = {
          x: clamp((sn.x - bd.x) / bd.w - r0.w / 2, 0, 1 - r0.w),
          y: clamp((sn.y - bd.y) / bd.h - r0.h / 2, 0, 1 - r0.h),
          w: r0.w, h: r0.h
        };
      } else {
        /* 끌지 않는 쪽 벽은 제자리에 두고, 그 벽에서 방 칸 끝까지가 최대 크기다 */
        const d = canvasDrag.dir, MIN = 0.07;
        let x = r0.x, y = r0.y, w = r0.w, h = r0.h;
        const maxW = d.indexOf('w') >= 0 ? r0.x + r0.w : 1 - r0.x;
        const maxH = d.indexOf('n') >= 0 ? r0.y + r0.h : 1 - r0.y;

        if (d.indexOf('w') >= 0)      { w = clamp(r0.w - dx, MIN, maxW); x = r0.x + r0.w - w; }
        else if (d.indexOf('e') >= 0) { w = clamp(r0.w + dx, MIN, maxW); }
        if (d.indexOf('n') >= 0)      { h = clamp(r0.h - dy, MIN, maxH); y = r0.y + r0.h - h; }
        else if (d.indexOf('s') >= 0) { h = clamp(r0.h + dy, MIN, maxH); }

        /* Shift를 누르면 모서리에서 비율을 지킨다 — 종이를 넘지 않는 선까지만 */
        if (ev.shiftKey && d.length === 2) {
          const ar = (r0.w * bd.w) / (r0.h * bd.h);
          h = (w * bd.w / ar) / bd.h;
          if (h > maxH) { h = maxH; w = (h * bd.h * ar) / bd.w; }
          if (h < MIN)  { h = MIN;  w = (h * bd.h * ar) / bd.w; }
          w = clamp(w, MIN, maxW);
          if (d.indexOf('n') >= 0) y = r0.y + r0.h - h;
          if (d.indexOf('w') >= 0) x = r0.x + r0.w - w;
        }
        /* 등 크기는 건드리지 않는다. 소·중·대로 정해 쓰는 값이라 방을 늘렸다고
           같이 커지면 애써 맞춰 놓은 크기가 흐트러진다.
           자리는 방 기준 좌표라 저절로 따라온다. */
        doc.room = { x: clamp(x, 0, 1 - w), y: clamp(y, 0, 1 - h), w: w, h: h };
      }
      renderDrag(); return;
    }

    if (Math.abs(ev.clientX - canvasDrag.x0) + Math.abs(ev.clientY - canvasDrag.y0) < 4) return;
    if (!canvasDrag.saved) { snapshot(); canvasDrag.saved = true; }
    canvasDrag.moved = true;
    const rb = roomBox();
    if (canvasDrag.kind === 'light') {
      const l = doc.lights.filter(x => x.id === canvasDrag.id)[0];
      if (l) {
        const sn = snapLight(l, pt);
        l.nx = clamp((sn.x - rb.x) / rb.w, 0, 1);
        l.ny = clamp((sn.y - rb.y) / rb.h, 0, 1);
        ui.guides = sn.guides;
      }
    }
    renderDrag();
  });

  svg.addEventListener('pointerup', ev => {
    if (!canvasDrag) return;
    const d = canvasDrag; canvasDrag = null;
    ui.guides = [];
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
   평면도 그림 넣기
   ============================================================ */
/* 휴대폰 사진은 4000px가 넘는데 도면에서는 900px 남짓으로 그려진다.
   그대로 두면 끌 때 버벅이고, 브라우저 저장 공간(5MB)도 넘겨 작업이
   저장되지 않는다. 그래서 받자마자 줄여서 담는다. */
const BG_MAX = 1600;
function shrinkBlueprint(url, cb) {
  const img = new Image();
  img.onload = () => {
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    if (long <= BG_MAX) { cb(url, img); return; }
    const k = BG_MAX / long;
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);   /* 투명 배경이 검게 나오지 않도록 */
    g.drawImage(img, 0, 0, c.width, c.height);
    let out = url;
    try { out = c.toDataURL('image/jpeg', 0.85); } catch (e) {}
    cb(out, img);
  };
  img.onerror = () => cb(null, null);
  img.src = url;
}
function loadBlueprint(file) {
  const rd = new FileReader();
  rd.onload = () => shrinkBlueprint(rd.result, (url, img) => {
    if (!url) { alert('이미지를 읽을 수 없습니다. 다른 파일로 해보세요.'); return; }
    snapshot();
    doc.bg = url;
    placeRoom(img.naturalWidth, img.naturalHeight);
    persist(); render();
  });
  rd.readAsDataURL(file);
}

/* ============================================================
   색 고르기
   ============================================================ */
function closePop() {
  const el = document.getElementById('pop');
  if (el) el.remove();
  document.removeEventListener('pointerdown', onPopOutside, true);
}
function onPopOutside(ev) { if (!ev.target.closest('#pop')) closePop(); }
/* 누른 것 옆에, 화면 밖으로 나가지 않게 띄운다 */
function openPop(html, anchor) {
  closePop();
  const el = document.createElement('div');
  el.className = 'pop'; el.id = 'pop'; el.innerHTML = html;
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  el.style.left = clamp(r.right - el.offsetWidth, 8, window.innerWidth - el.offsetWidth - 8) + 'px';
  el.style.top = (r.bottom + 8 + el.offsetHeight > window.innerHeight
    ? Math.max(8, r.top - el.offsetHeight - 8) : r.bottom + 8) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', onPopOutside, true), 0);
  return el;
}

/* 등 크기 — 고른 모양을 한 번 더 누르면 나온다 */
function openSizePop(anchor) {
  const sp = ui.shape;
  let html = '<div class="pop-sizes">';
  ['s', 'm', 'l'].forEach(k => {
    const z = sizeOf(sp, k);
    const w = Math.max(5, Math.round(z.w / 5.2)), h = Math.max(5, Math.round(z.h / 5.2));
    const br = sp === 'circle' ? '50%' : (sp === 'square' ? '3px' : Math.min(w, h) / 2 + 'px');
    html += '<button class="sz-btn' + (ui.size === k ? ' on' : '') + '" data-sz="' + k + '">' +
            '<span class="sz-ico"><i style="width:' + w + 'px;height:' + h + 'px;border-radius:' + br + '"></i></span>' +
            '<span>' + SIZE_NAMES[k] + '</span></button>';
  });
  const el = openPop(html + '</div>', anchor);
  $$('.sz-btn', el).forEach(b => b.onclick = () => {
    ui.size = b.dataset.sz;
    applyShapeToSelection();
    closePop(); render();
  });
}
/* 골라 둔 등이 있으면 모양·크기를 바로 입힌다 */
function applyShapeToSelection() {
  if (!ui.sel || ui.sel.t !== 'light') return;
  const l = doc.lights.filter(x => x.id === ui.sel.id)[0];
  if (!l) return;
  const z = sizeOf(ui.shape, ui.size);
  snapshot(); l.shape = ui.shape; l.w = z.w; l.h = z.h; persist();
}

function openColorPop(gangId, anchor) {
  const g = findGang(gangId); if (!g) return;
  snapshot();

  let sw = '';
  PALETTE.forEach(c => {
    const on = c.toLowerCase() === String(g.color).toLowerCase();
    sw += '<button class="pop-sw' + (on ? ' on' : '') + '" data-c="' + c + '" style="background:' + c +
          '" title="' + (c === GANG_GRAY ? '색 없음' : c) + '"></button>';
  });
  const el = openPop('<div class="pop-grid">' + sw + '</div>' +
    '<div class="pop-foot"><span>직접 고르기</span>' +
    '<input type="color" id="pop-custom" value="' + esc(g.color) + '"></div>', anchor);

  const apply = (c, done) => {
    g.color = c;
    if (done) { persist(); render(); closePop(); }
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
  if (doc.switches.length >= MAX_SWITCHES) {
    openModal('<h3>스위치는 넷까지</h3>' +
      '<p class="m-sub">한 장에 스위치 넷까지 담을 수 있습니다. 더 넣으려면 안내판을 한 장 더 만드세요.</p>' +
      '<div class="modal-row"><button class="m-btn primary" data-close>알겠습니다</button></div>');
    return;
  }
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

/* ── PDF 직접 만들기 ────────────────────────────────────
   브라우저 인쇄를 거치면 주소·날짜·페이지 번호가 자동으로 붙는데,
   iOS에서는 그것을 끌 방법이 없다. 그래서 종이 한 장을 그대로 그려
   PDF를 손수 만들어 내려받는다. 붙는 글자가 하나도 없다. */
const PDF_DPI = 200;
function pageSVGString() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + VB_W + '" height="' + PAPER_H +
         '" viewBox="0 0 ' + VB_W + ' ' + PAPER_H + '">' +
         '<rect width="' + VB_W + '" height="' + PAPER_H + '" fill="#ffffff"/>' +
         bgSVG() + planSVG(true) + '</svg>';
}
/* 낱장 PDF 한 개를 바이트로 짠다 (그림 하나를 A4에 꽉 채운 형태) */
function makePdf(jpeg, pxW, pxH) {
  const PT_W = 595.28, PT_H = 841.89;           /* A4, 1/72인치 단위 */
  const parts = [], offsets = [];
  let len = 0;
  const put = x => {
    const b = typeof x === 'string' ? Uint8Array.from(x, c => c.charCodeAt(0) & 0xff) : x;
    parts.push(b); len += b.length;
  };
  const obj = (n, body, extra) => {
    offsets[n] = len;
    put(n + ' 0 obj\n' + body + '\n');
    if (extra) { put('stream\n'); put(extra); put('\nendstream\n'); }
    put('endobj\n');
  };
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PT_W + ' ' + PT_H +
         '] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
  const content = 'q ' + PT_W + ' 0 0 ' + PT_H + ' 0 0 cm /Im0 Do Q';
  obj(4, '<< /Length ' + content.length + ' >>', content);
  obj(5, '<< /Type /XObject /Subtype /Image /Width ' + pxW + ' /Height ' + pxH +
         ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>', jpeg);
  const xref = len;
  let t = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) t += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  put(t);
  put('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');

  const out = new Uint8Array(len);
  let at = 0;
  parts.forEach(b => { out.set(b, at); at += b.length; });
  return out;
}
function savePdf() {
  const pxW = Math.round(210 / 25.4 * PDF_DPI);
  const pxH = Math.round(pxW * PAPER_H / VB_W);
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = pxW; c.height = pxH;
      const g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, pxW, pxH);
      g.drawImage(img, 0, 0, pxW, pxH);
      const b64 = c.toDataURL('image/jpeg', 0.94).split(',')[1];
      const bin = atob(b64), jpeg = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) jpeg[i] = bin.charCodeAt(i);
      downloadBlob(new Blob([makePdf(jpeg, pxW, pxH)], { type: 'application/pdf' }),
                   (doc.title.trim() || '조명안내판') + '.pdf');
    } catch (e) { toast('PDF를 만들지 못했습니다. 인쇄 버튼으로 뽑아보세요.'); }
  };
  img.onerror = () => toast('PDF를 만들지 못했습니다. 인쇄 버튼으로 뽑아보세요.');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pageSVGString());
}

/* 화면에서 보는 것이 그대로 한 장이다. 덧붙이는 머리말·꼬리말이 없다. */
function buildPrintSheet() {
  document.getElementById('print-root').innerHTML =
    '<div class="sheet"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VB_W + ' ' + PAPER_H + '">' +
      '<rect width="' + VB_W + '" height="' + PAPER_H + '" fill="#ffffff"/>' +
      bgSVG() + planSVG(true) +
    '</svg></div>';
}

/* ============================================================
   파일 저장 / 불러오기
   ============================================================ */
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[\\/:*?"<>|]/g, '');
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  if (EMBEDDED) toast('내려받기가 막힌 화면입니다. 파일이 저장되지 않았다면 이 페이지를 새 탭에서 열고 다시 눌러주세요.');
}
function saveFile() {
  downloadBlob(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
               (doc.title.trim() || '조명안내판') + '.json');
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

  $('#doc-title').oninput = e => { doc.title = e.target.value; persist(); renderPlan(); };
  $('#btn-template').onclick = openTemplateModal;
  $('#btn-add-switch').onclick = openSwitchModal;
  $('#btn-save-file').onclick = saveFile;
  $('#btn-grid').onclick = openGridModal;
  $('#btn-undo').onclick = undo;
  $('#btn-pdf').onclick = savePdf;
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
    const sp = b.dataset.shape;
    if (sp === ui.shape) { openSizePop(b); return; }   /* 이미 고른 모양을 또 누르면 크기 고르기 */
    ui.shape = sp;
    applyShapeToSelection();
    render();
  });

  $('#modal-back').onclick = e => {
    if (e.target.id === 'modal-back' || e.target.hasAttribute('data-close')) closeModal();
  };

  document.addEventListener('keydown', e => {
    if (ui.screen !== 'editor') return;
    const t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    if (e.key === 'Escape') { ui.activeGang = null; ui.sel = null; closeModal(); closePop(); render(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && ui.sel && ui.sel.t === 'light') {
      e.preventDefault(); snapshot(); removeLight(ui.sel.id); persist(); render();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if (e.key === 'v') { ui.tool = 'select'; render(); }
    if (e.key === 'l') { ui.tool = 'light'; render(); }
    if (e.key === 'e') { ui.tool = 'erase'; render(); }
  });

  bindCanvas();
  bindZoom();
  applyView();

  /* 줄이기 전 판에서 담긴 사진은 열 때 한 번 줄인다.
     용량이 작아도 4000px짜리면 다시 칠할 때마다 비싸므로, 그림의 실제 크기로 판단한다. */
  if (doc.bg) {
    shrinkBlueprint(doc.bg, url => {
      if (!url || url === doc.bg) return;
      doc.bg = url; persist();
      if (ui.screen === 'editor') renderPlan();
    });
  }

  if (had && (doc.lights.length || doc.switches.length || doc.bg)) go('editor');
  else go('home');
}

document.addEventListener('DOMContentLoaded', boot);
})();
