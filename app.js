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
const VB_W   = 1000;              // 뷰박스 가로 (모든 좌표의 기준)
const M = { t: 62, l: 62, r: 62, b: 150 };  // 방 테두리 바깥 여백 (아래는 스위치판 자리)
const STORE  = 'switchdeung.doc.v1';

/* 흑백 인쇄를 고려해 명도 차이가 큰 색만 고름 */
const COLORS = [
  '#e5484d', '#0090ff', '#f76b15', '#30a46c', '#8e4ec6',
  '#0d9488', '#e93d82', '#a16207', '#3e63dd', '#65a30d'
];
const SHAPES = {
  bar:    { w: 152, h: 34 },
  square: { w: 74,  h: 74 },
  circle: { w: 74,  h: 74 }
};
const RATIOS = [
  { id: '16:9',  w: 16,  h: 9   },
  { id: '16:10', w: 16,  h: 10  },
  { id: '4:3',   w: 4,   h: 3   },
  { id: 'A4',    w: 297, h: 210 }
];
const TEMPLATES = [
  { id:'classroom', name:'일반 교실', desc:'형광등 3줄 × 3개 · 스위치 3구',
    ratio:{id:'4:3',w:4,h:3}, cols:3, rows:3, shape:'bar', gangs:3,
    sides:{top:'칠판 (앞쪽)', bottom:'뒤 게시판', left:'창문', right:'출입문 · 복도'} },
  { id:'classroom-s', name:'특별실 · 작은 교실', desc:'형광등 3줄 × 2개 · 스위치 2구',
    ratio:{id:'4:3',w:4,h:3}, cols:3, rows:2, shape:'bar', gangs:2,
    sides:{top:'앞쪽', bottom:'뒤쪽', left:'창문', right:'출입문'} },
  { id:'hall', name:'강당 · 체육관', desc:'원형 등 6 × 4 · 스위치 4구',
    ratio:{id:'16:9',w:16,h:9}, cols:6, rows:4, shape:'circle', gangs:4,
    sides:{top:'무대', bottom:'', left:'', right:'출입문'} },
  { id:'office', name:'사무실 · 교무실', desc:'사각 등 4 × 3 · 스위치 3구',
    ratio:{id:'16:10',w:16,h:10}, cols:4, rows:3, shape:'square', gangs:3,
    sides:{top:'', bottom:'', left:'창문', right:'출입문'} },
  { id:'corridor', name:'복도 · 계단', desc:'형광등 8개 한 줄 · 스위치 2구',
    ratio:{id:'custom',w:5,h:1}, cols:8, rows:1, shape:'bar', gangs:2,
    sides:{top:'', bottom:'', left:'계단 쪽', right:'교실 쪽'} }
];

/* ── 상태 ───────────────────────────────────────────────── */
function blankDoc() {
  return {
    title: '', hasBlueprint: false,
    ratio: { id: '4:3', w: 4, h: 3 },
    bg: null, bgOpacity: 0.45,
    sides: { top: '', right: '', bottom: '', left: '' },
    lights: [], switches: []
  };
}
let doc = blankDoc();
let ui  = { screen: 'home', tool: 'select', shape: 'bar', selected: null, activeGang: null };
let undoStack = [];

/* ── 저장 / 불러오기 ────────────────────────────────────── */
function snapshot() {
  undoStack.push(JSON.stringify(doc));
  if (undoStack.length > 60) undoStack.shift();
}
function undo() {
  if (!undoStack.length) return;
  doc = JSON.parse(undoStack.pop());
  ui.selected = null; ui.activeGang = null;
  persist(); render();
}
function persist() { try { localStorage.setItem(STORE, JSON.stringify(doc)); } catch (e) {} }
function restore() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.lights)) return false;
    doc = Object.assign(blankDoc(), d);
    return true;
  } catch (e) { return false; }
}

/* ── 좌표 ───────────────────────────────────────────────── */
/* 방 테두리가 고른 비율을 그대로 지키고, 뷰박스 높이가 거기에 맞춰 늘어난다 */
function roomBox() {
  const w = VB_W - M.l - M.r;
  const h = clamp(Math.round(w * doc.ratio.h / doc.ratio.w), 150, 2200);
  return { x: M.l, y: M.t, w: w, h: h };
}
function vb() { return { W: VB_W, H: M.t + roomBox().h + M.b }; }
/* 스위치판이 놓이는 기본 자리 (방 아래 띠) */
function switchBandY() { const rb = roomBox(); return rb.y + rb.h + 74; }
function svgPoint(ev) {
  const svg = $('#plan');
  const r = svg.getBoundingClientRect();
  const b = vb();
  return { x: (ev.clientX - r.left) * (b.W / r.width), y: (ev.clientY - r.top) * (b.H / r.height) };
}
function toNorm(pt) {
  const rb = roomBox();
  return { nx: clamp((pt.x - rb.x) / rb.w, 0, 1), ny: clamp((pt.y - rb.y) / rb.h, 0, 1) };
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
function findGang(id) {
  const hit = allGangs().filter(p => p.g.id === id)[0];
  return hit ? hit.g : null;
}
function nextColor() {
  const used = allGangs().map(p => p.g.color);
  for (let i = 0; i < COLORS.length; i++) if (used.indexOf(COLORS[i]) < 0) return COLORS[i];
  return COLORS[used.length % COLORS.length];
}
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
function addLight(nx, ny, shape) {
  const sh = SHAPES[shape || ui.shape];
  doc.lights.push({ id: uid(), nx: nx, ny: ny, shape: shape || ui.shape, w: sh.w, h: sh.h });
}
function removeLight(id) {
  doc.lights = doc.lights.filter(l => l.id !== id);
  doc.switches.forEach(sw => sw.gangs.forEach(g => {
    g.lightIds = g.lightIds.filter(x => x !== id);
  }));
  if (ui.selected === id) ui.selected = null;
}
function addSwitch(gangCount) {
  const n = doc.switches.length;
  const sw = {
    id: uid(),
    name: n === 0 ? '출입문 옆 스위치' : '스위치 ' + (n + 1),
    nx: 0, ny: 0,
    gangs: []
  };
  const rb0 = roomBox(), b0 = vb();
  sw.nx = clamp((rb0.x + (0.16 + n * 0.26) * rb0.w) / b0.W, 0.08, 0.92);
  sw.ny = switchBandY() / b0.H;
  doc.switches.push(sw);   /* 색이 겹치지 않으려면 먼저 등록한 뒤 버튼을 만들어야 한다 */
  for (let i = 0; i < (gangCount || 2); i++) sw.gangs.push(newGang(sw, i));
  return sw;
}
function newGang(sw, idx) {
  return { id: uid(), label: String((idx == null ? sw.gangs.length : idx) + 1), color: nextColor(), desc: '', lightIds: [] };
}
function gridPlace(rows, cols, shape) {
  doc.lights = [];
  doc.switches.forEach(sw => sw.gangs.forEach(g => { g.lightIds = []; }));
  const pad = 0.10;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = cols === 1 ? 0.5 : pad + (c / (cols - 1)) * (1 - pad * 2);
      const ny = rows === 1 ? 0.5 : pad + (r / (rows - 1)) * (1 - pad * 2);
      addLight(nx, ny, shape);
    }
  }
}

/* ============================================================
   그리기 — 평면도 SVG
   ============================================================ */
function planSVG(forPrint) {
  const b = vb(), rb = roomBox();
  let s = '';
  s += '<rect x="0" y="0" width="' + b.W + '" height="' + b.H + '" fill="#ffffff"/>';

  if (doc.bg) {
    s += '<image href="' + esc(doc.bg) + '" x="' + rb.x + '" y="' + rb.y + '" width="' + rb.w +
         '" height="' + rb.h + '" preserveAspectRatio="xMidYMid meet" opacity="' + doc.bgOpacity + '"/>';
  }
  s += '<rect x="' + rb.x + '" y="' + rb.y + '" width="' + rb.w + '" height="' + rb.h +
       '" fill="none" stroke="#111111" stroke-width="3.5"/>';

  /* 벽 이름표 */
  const F = 'font-family="' + "'Apple SD Gothic Neo','Malgun Gothic',sans-serif" + '"';
  const lab = (t, x, y, rot) => t
    ? '<text ' + F + ' x="' + x + '" y="' + y + '" font-size="23" font-weight="700" fill="#444" ' +
      'text-anchor="middle"' + (rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : '') + '>' + esc(t) + '</text>'
    : '';
  s += lab(doc.sides.top,    rb.x + rb.w / 2, rb.y - 20, 0);
  s += lab(doc.sides.bottom, rb.x + rb.w / 2, rb.y + rb.h + 32, 0);
  s += lab(doc.sides.left,   rb.x - 24, rb.y + rb.h / 2, -90);
  s += lab(doc.sides.right,  rb.x + rb.w + 30, rb.y + rb.h / 2, 90);

  /* 등 */
  doc.lights.forEach(l => {
    const cx = rb.x + l.nx * rb.w, cy = rb.y + l.ny * rb.h;
    const gs = gangsOf(l.id);
    const fill = gs.length ? gs[0].color : '#e6e9ed';
    const txt  = gs.map(dlabel).join('·');
    const on   = !ui.activeGang || gs.some(g => g.id === ui.activeGang);
    const op   = forPrint ? 1 : (on ? 1 : 0.28);
    const sel  = !forPrint && ui.selected === l.id;
    const stroke = sel ? '#111111' : (gs.length ? '#00000030' : '#b8bec7');
    const sw = sel ? 4 : 1.5;

    let shp;
    if (l.shape === 'circle') {
      shp = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (l.w / 2) + '" ry="' + (l.h / 2) +
            '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    } else {
      const rx = l.shape === 'bar' ? l.h / 2 : 8;
      shp = '<rect x="' + (cx - l.w / 2) + '" y="' + (cy - l.h / 2) + '" width="' + l.w + '" height="' + l.h +
            '" rx="' + rx + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    }
    let fs = l.shape === 'bar' ? 21 : 26;
    if (txt.length > 3) fs = Math.max(13, fs - (txt.length - 3) * 3);
    const label = txt
      ? '<text ' + F + ' x="' + cx + '" y="' + (cy + fs * 0.35) + '" font-size="' + fs +
        '" font-weight="800" fill="' + inkOn(fill) + '" text-anchor="middle">' + esc(txt) + '</text>'
      : '<text ' + F + ' x="' + cx + '" y="' + (cy + 7) + '" font-size="20" font-weight="700" fill="#9aa2ad" text-anchor="middle">?</text>';

    s += '<g data-light="' + l.id + '" opacity="' + op + '" style="cursor:pointer">' + shp + label + '</g>';
  });

  /* 스위치 위치 표시 */
  doc.switches.forEach(sw => {
    if (!sw.gangs.length) return;
    const labels = sw.gangs.map(dlabel);
    const kw = labels.some(t => t.length > 1) ? 36 : 26;
    const kh = 34, gap = 4, pad = 7, nameH = 24;
    const pw = sw.gangs.length * kw + (sw.gangs.length - 1) * gap + pad * 2;
    const ph = kh + pad * 2;
    let cx = sw.nx * b.W, cy = sw.ny * b.H;
    cx = clamp(cx, pw / 2 + 6, b.W - pw / 2 - 6);
    cy = clamp(cy, ph / 2 + 6, b.H - ph / 2 - nameH - 6);
    const x0 = cx - pw / 2, y0 = cy - ph / 2;
    const hot = !forPrint && ui.activeGang && sw.gangs.some(g => g.id === ui.activeGang);

    let keys = '';
    sw.gangs.forEach((g, i) => {
      const kx = x0 + pad + i * (kw + gap), t = labels[i];
      keys += '<rect x="' + kx + '" y="' + (y0 + pad) + '" width="' + kw + '" height="' + kh +
              '" rx="3" fill="' + g.color + '"/>' +
              '<text ' + F + ' x="' + (kx + kw / 2) + '" y="' + (y0 + pad + kh / 2 + 5) +
              '" font-size="' + (t.length > 1 ? 13 : 15) + '" font-weight="800" fill="' + inkOn(g.color) +
              '" text-anchor="middle">' + esc(t) + '</text>';
    });
    s += '<g data-switch="' + sw.id + '" style="cursor:move">' +
         '<rect x="' + x0 + '" y="' + y0 + '" width="' + pw + '" height="' + ph +
         '" rx="6" fill="#ffffff" stroke="' + (hot ? '#111111' : '#333333') + '" stroke-width="' + (hot ? 3.5 : 2) + '"/>' +
         keys +
         '<text ' + F + ' x="' + cx + '" y="' + (y0 + ph + 19) + '" font-size="17" font-weight="700" fill="#222" ' +
         'text-anchor="middle">' + esc(sw.name) + '</text>' +
         '</g>';
  });

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + b.W + ' ' + b.H + '">' + s + '</svg>';
}

function renderPlan() {
  const b = vb();
  const paper = $('#paper');
  paper.style.aspectRatio = b.W + ' / ' + b.H;
  paper.style.width = '100%';
  const svg = $('#plan');
  svg.setAttribute('viewBox', '0 0 ' + b.W + ' ' + b.H);
  svg.innerHTML = planSVG(false).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
}

/* ============================================================
   그리기 — 상단 비율 버튼 · 하단 독 · 안내 배너
   ============================================================ */
function renderRatios() {
  const g = $('#ratio-group');
  let h = '';
  RATIOS.forEach(r => {
    h += '<button class="tb-btn' + (doc.ratio.id === r.id ? ' on' : '') + '" data-ratio="' + r.id + '">' + r.id + '</button>';
  });
  h += '<button class="tb-btn' + (doc.ratio.id === 'custom' ? ' on' : '') + '" data-ratio="custom">사용자 지정</button>';
  g.innerHTML = h;
}
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
  if (ui.tool === 'light')  { el.hidden = false; el.innerHTML = '<span>방 안을 클릭해 등을 놓으세요</span>'; return; }
  if (ui.tool === 'erase')  { el.hidden = false; el.innerHTML = '<span>지울 등을 클릭하세요</span>'; return; }
  el.hidden = true;
}

/* ============================================================
   그리기 — 오른쪽 패널
   ============================================================ */
function renderPanel() {
  const p = $('#panel-scroll');
  let h = '';

  /* 스위치 */
  h += '<div class="sec"><div class="sec-h"><span>스위치</span>' +
       '<button class="mini" data-act="add-switch">＋ 추가</button></div>';
  if (!doc.switches.length) {
    h += '<div class="empty">아직 스위치가 없습니다.<br>“스위치 추가”를 눌러 시작하세요.</div>';
  }
  doc.switches.forEach(sw => {
    h += '<div class="sw"><div class="sw-head">' +
         '<input class="sw-name" data-sw-name="' + sw.id + '" value="' + esc(sw.name) + '" maxlength="24">' +
         '<button class="icon-x" data-act="del-switch" data-id="' + sw.id + '" title="스위치 삭제">✕</button>' +
         '</div><div class="sw-body">';
    sw.gangs.forEach(g => {
      const on = ui.activeGang === g.id;
      h += '<div class="gang' + (on ? ' on' : '') + '">' +
           '<button class="gang-btn" data-act="pick-gang" data-id="' + g.id + '" ' +
           'style="background:' + g.color + ';color:' + inkOn(g.color) + '" title="이 버튼이 켜는 등 고르기">' + esc(dlabel(g)) + '</button>' +
           '<input class="gang-desc" data-gang-desc="' + g.id + '" value="' + esc(g.desc) + '" maxlength="22" placeholder="예) 칠판 쪽">' +
           '<span class="gang-cnt">' + g.lightIds.length + '개</span>' +
           '<button class="icon-x" data-act="del-gang" data-id="' + g.id + '" title="버튼 삭제">✕</button>' +
           '</div>';
    });
    h += '<button class="add-gang" data-act="add-gang" data-id="' + sw.id + '">＋ 버튼(구) 추가</button>';
    h += '</div></div>';
  });
  h += '</div>';

  /* 평면도 이미지 */
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

  /* 벽 이름표 */
  h += '<div class="sec"><div class="sec-h"><span>벽 이름표</span></div>' +
       '<div class="sides">' +
       sideField('top', '위쪽', '칠판 · 앞') + sideField('bottom', '아래쪽', '뒤쪽') +
       sideField('left', '왼쪽', '창문') + sideField('right', '오른쪽', '출입문') +
       '</div></div>';

  /* 등 */
  h += '<div class="sec"><div class="sec-h"><span>등</span>' +
       '<button class="mini" data-act="grid">격자로 다시 배치</button></div>' +
       '<div class="empty" style="text-align:left">전체 ' + doc.lights.length + '개 · ' +
       '배정 안 된 등 ' + doc.lights.filter(l => !gangsOf(l.id).length).length + '개</div></div>';

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
      if (act === 'add-switch') { snapshot(); const sw = addSwitch(2); ui.activeGang = sw.gangs[0].id; }
      else if (act === 'del-switch') { snapshot(); doc.switches = doc.switches.filter(s => s.id !== id); ui.activeGang = null; }
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
      else if (act === 'del-bg') { snapshot(); doc.bg = null; }
      else if (act === 'grid') { openGridModal(); return; }
      persist(); render();
    };
  });

  $$('[data-sw-name]', p).forEach(inp => {
    inp.oninput = () => {
      const sw = doc.switches.filter(s => s.id === inp.dataset.swName)[0];
      if (sw) { sw.name = inp.value; persist(); renderPlan(); }
    };
  });
  $$('[data-gang-desc]', p).forEach(inp => {
    inp.oninput = () => {
      const g = findGang(inp.dataset.gangDesc);
      if (g) { g.desc = inp.value; persist(); }
    };
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
      img.onload = () => {
        doc.ratio = { id: 'custom', w: img.naturalWidth, h: img.naturalHeight };
        reflowSwitches(); persist(); render();
      };
      img.onerror = () => { persist(); render(); };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  };
  const op = $('#bg-op', p);
  if (op) op.oninput = () => { doc.bgOpacity = op.value / 100; persist(); renderPlan(); };
}

function reflowSwitches() {
  const rb = roomBox(), b = vb();
  doc.switches.forEach(sw => {
    if (sw.ny * b.H > rb.y + rb.h - 4) sw.ny = switchBandY() / b.H;
    sw.nx = clamp(sw.nx, 0.08, 0.92);
  });
}

function render() { renderRatios(); renderPlan(); renderPanel(); renderDock(); renderHint(); }

/* ============================================================
   캔버스 조작
   ============================================================ */
function bindCanvas() {
  const svg = $('#plan');
  let drag = null;

  svg.addEventListener('pointerdown', ev => {
    const lg = ev.target.closest('[data-light]');
    const sg = ev.target.closest('[data-switch]');

    if (ui.tool === 'erase' && lg) { snapshot(); removeLight(lg.dataset.light); persist(); render(); return; }

    if (ui.tool === 'light' && !lg && !sg) {
      const n = toNorm(svgPoint(ev));
      snapshot(); addLight(n.nx, n.ny);
      if (ui.activeGang) findGang(ui.activeGang).lightIds.push(doc.lights[doc.lights.length - 1].id);
      persist(); render(); return;
    }

    if (lg || sg) {
      const el = lg || sg;
      svg.setPointerCapture(ev.pointerId);
      drag = { el: el, kind: lg ? 'light' : 'switch', id: el.dataset.light || el.dataset.switch,
               x0: ev.clientX, y0: ev.clientY, moved: false, saved: false };
      if (lg && ui.tool === 'select') { ui.selected = drag.id; renderPlan(); }
      return;
    }

    if (ui.tool === 'select') { ui.selected = null; renderPlan(); }
  });

  svg.addEventListener('pointermove', ev => {
    if (!drag) return;
    if (Math.abs(ev.clientX - drag.x0) + Math.abs(ev.clientY - drag.y0) < 4) return;
    if (!drag.saved) { snapshot(); drag.saved = true; }
    drag.moved = true;

    const rb = roomBox(), pt = svgPoint(ev);
    if (drag.kind === 'light') {
      const l = doc.lights.filter(x => x.id === drag.id)[0];
      if (l) { l.nx = clamp((pt.x - rb.x) / rb.w, 0, 1); l.ny = clamp((pt.y - rb.y) / rb.h, 0, 1); }
    } else {
      const sw = doc.switches.filter(x => x.id === drag.id)[0];
      const bb = vb();
      if (sw) { sw.nx = clamp(pt.x / bb.W, 0, 1); sw.ny = clamp(pt.y / bb.H, 0, 1); }
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
      const left = ((c + 0.5) / t.cols * 100), top = ((r + 0.5) / t.rows * 100);
      const w = t.shape === 'bar' ? 12 : 6, hh = t.shape === 'bar' ? 4 : 6;
      const br = t.shape === 'circle' ? '50%' : '1px';
      mini += '<i style="left:' + left + '%;top:' + top + '%;width:' + w + 'px;height:' + hh + 'px;border-radius:' + br + '"></i>';
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
      doc.ratio = { id: t.ratio.id, w: t.ratio.w, h: t.ratio.h };
      doc.sides = Object.assign({ top: '', right: '', bottom: '', left: '' }, t.sides);
      doc.switches = [];
      ui.shape = t.shape;
      gridPlace(t.rows, t.cols, t.shape);
      const sw = addSwitch(t.gangs);
      /* 등을 세로 구역으로 나눠 각 버튼에 임시 배정 — 출발점만 잡아줌 */
      const per = Math.ceil(doc.lights.length / t.gangs);
      const sorted = doc.lights.slice().sort((a, b2) => (a.ny - b2.ny) || (a.nx - b2.nx));
      sorted.forEach((l, i) => { sw.gangs[Math.min(t.gangs - 1, Math.floor(i / per))].lightIds.push(l.id); });
      ui.activeGang = null; ui.selected = null;
      persist(); render(); closeModal();
    });
  });
}

function openGridModal() {
  const h = '<h3>등을 격자로 배치</h3><p class="m-sub">가로·세로 개수를 넣으면 방 안에 고르게 놓습니다.</p>' +
    '<div class="num-row"><label>가로 개수</label><input type="number" id="g-cols" min="1" max="20" value="3"></div>' +
    '<div class="num-row"><label>세로 개수</label><input type="number" id="g-rows" min="1" max="20" value="3"></div>' +
    '<div class="note">기존 등과 스위치 연결이 모두 지워지고 새로 놓입니다.</div>' +
    '<div class="modal-row"><button class="m-btn" data-close>취소</button>' +
    '<button class="m-btn primary" id="g-ok">배치하기</button></div>';
  openModal(h, m => {
    $('#g-ok', m).onclick = () => {
      const c = clamp(parseInt($('#g-cols', m).value, 10) || 1, 1, 20);
      const r = clamp(parseInt($('#g-rows', m).value, 10) || 1, 1, 20);
      snapshot(); gridPlace(r, c, ui.shape); persist(); render(); closeModal();
    };
  });
}

function openRatioModal() {
  const h = '<h3>사용자 지정 비율</h3><p class="m-sub">방의 가로·세로 비율을 넣으세요. 실제 치수(예: 900 × 750cm)를 그대로 넣어도 됩니다.</p>' +
    '<div class="num-row"><label>가로</label><input type="number" id="r-w" min="1" max="9999" value="' + doc.ratio.w + '"></div>' +
    '<div class="num-row"><label>세로</label><input type="number" id="r-h" min="1" max="9999" value="' + doc.ratio.h + '"></div>' +
    '<div class="modal-row"><button class="m-btn" data-close>취소</button>' +
    '<button class="m-btn primary" id="r-ok">적용</button></div>';
  openModal(h, m => {
    $('#r-ok', m).onclick = () => {
      const w = clamp(parseInt($('#r-w', m).value, 10) || 4, 1, 9999);
      const hh = clamp(parseInt($('#r-h', m).value, 10) || 3, 1, 9999);
      snapshot(); doc.ratio = { id: 'custom', w: w, h: hh }; reflowSwitches(); persist(); render(); closeModal();
    };
  });
}

function openSwitchModal() {
  const h = '<h3>스위치 추가</h3><p class="m-sub">스위치판에 버튼이 몇 개 달려 있나요? (보통 “○구”라고 부릅니다)</p>' +
    '<div class="num-row"><label>버튼 개수</label><input type="number" id="s-n" min="1" max="8" value="2"></div>' +
    '<div class="modal-row"><button class="m-btn" data-close>취소</button>' +
    '<button class="m-btn primary" id="s-ok">추가</button></div>';
  openModal(h, m => {
    $('#s-ok', m).onclick = () => {
      const n = clamp(parseInt($('#s-n', m).value, 10) || 2, 1, 8);
      snapshot(); const sw = addSwitch(n); ui.activeGang = sw.gangs[0].id;
      persist(); render(); closeModal();
    };
  });
}

/* ============================================================
   인쇄
   ============================================================ */
function buildPrintSheet() {
  const wide = (doc.ratio.w / doc.ratio.h) >= 1.15;
  let ps = document.getElementById('page-style');
  if (!ps) { ps = document.createElement('style'); ps.id = 'page-style'; document.head.appendChild(ps); }
  ps.textContent = '@page{size:A4 ' + (wide ? 'portrait' : 'portrait') + ';margin:14mm}';

  const title = doc.title.trim() || '조명 스위치 안내';
  const d = new Date();
  const stamp = d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';

  let lg = '';
  doc.switches.forEach(sw => {
    let keys = '', items = '';
    sw.gangs.forEach(g => {
      const t = dlabel(g);
      keys += '<span class="lg-key" style="background:' + g.color + ';color:' + inkOn(g.color) + '">' + esc(t) + '</span>';
      items += '<li><span class="lg-dot" style="background:' + g.color + '"></span>' +
               '<b>' + esc(t === g.label ? t + '번' : t) + '</b><span>' +
               (g.desc ? esc(g.desc) + ' · ' : '') + '등 ' + g.lightIds.length + '개</span></li>';
    });
    lg += '<div class="lg-sw"><div class="lg-sw-name">' + esc(sw.name) + '</div>' +
          '<div class="lg-sw-body"><div class="lg-plate">' + keys + '</div>' +
          '<ul class="lg-list">' + items + '</ul></div></div>';
  });

  document.getElementById('print-root').innerHTML =
    '<div class="sheet">' +
      '<div class="sheet-head"><h1>' + esc(title) + '</h1>' +
      '<div class="sh-tag">조명 스위치 안내판</div></div>' +
      '<div class="sheet-plan">' + planSVG(true) + '</div>' +
      (lg ? '<h2 class="lg-title">스위치 · 버튼별 안내</h2><div class="lg-grid">' + lg + '</div>' : '') +
      '<div class="sheet-foot"><span>등 안의 숫자 = 그 등을 켜는 스위치 버튼 번호</span><span>' + stamp + '</span></div>' +
    '</div>';
}

const EMBEDDED = (function () { try { return window.top !== window.self; } catch (e) { return true; } })();
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 6000);
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
      doc = Object.assign(blankDoc(), d);
      ui.selected = null; ui.activeGang = null; undoStack = [];
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

  $$('[data-blueprint]').forEach(b => b.onclick = () => {
    const yes = b.dataset.blueprint === 'yes';
    doc = blankDoc(); doc.hasBlueprint = yes; undoStack = [];
    ui.selected = null; ui.activeGang = null;
    if (!yes) { gridPlace(3, 3, 'bar'); doc.sides.top = '칠판 (앞쪽)'; }
    persist(); go('editor');
    if (!yes) setTimeout(openTemplateModal, 220);
  });

  $('#doc-title').oninput = e => { doc.title = e.target.value; persist(); };
  $('#btn-template').onclick = openTemplateModal;
  $('#btn-add-switch').onclick = openSwitchModal;
  $('#btn-save-file').onclick = saveFile;
  $('#btn-print').onclick = () => {
    buildPrintSheet();
    setTimeout(() => {
      try { window.print(); } catch (e) {}
      if (EMBEDDED) toast('인쇄 창이 뜨지 않으면, 이 페이지를 새 탭에서 연 뒤 다시 눌러주세요.');
    }, 60);
  };
  $('#btn-grid').onclick = openGridModal;
  $('#btn-undo').onclick = undo;

  $('#ratio-group').onclick = e => {
    const b = e.target.closest('[data-ratio]'); if (!b) return;
    if (b.dataset.ratio === 'custom') { openRatioModal(); return; }
    const r = RATIOS.filter(x => x.id === b.dataset.ratio)[0];
    snapshot(); doc.ratio = { id: r.id, w: r.w, h: r.h }; reflowSwitches(); persist(); render();
  };

  $$('#dock .dock-btn[data-tool]').forEach(b => b.onclick = () => {
    ui.tool = b.dataset.tool; ui.selected = null; render();
  });
  $$('#dock-shapes .shape-btn').forEach(b => b.onclick = () => {
    ui.shape = b.dataset.shape;
    if (ui.selected) {
      const l = doc.lights.filter(x => x.id === ui.selected)[0];
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
    if (t === 'INPUT' || t === 'TEXTAREA') return;
    if (e.key === 'Escape') { ui.activeGang = null; ui.selected = null; closeModal(); render(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selected) {
      e.preventDefault(); snapshot(); removeLight(ui.selected); persist(); render();
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
