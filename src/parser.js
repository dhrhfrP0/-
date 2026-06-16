// Parse a free-text prompt into a structured "intent" the generator understands.
// Supports English and Korean keywords.

const COLORS = {
  red: [0.86, 0.22, 0.22], "빨강": [0.86, 0.22, 0.22], "빨간": [0.86, 0.22, 0.22], "붉은": [0.86, 0.22, 0.22],
  orange: [0.95, 0.55, 0.18], "주황": [0.95, 0.55, 0.18], "주황색": [0.95, 0.55, 0.18],
  yellow: [0.96, 0.82, 0.25], "노랑": [0.96, 0.82, 0.25], "노란": [0.96, 0.82, 0.25],
  green: [0.30, 0.70, 0.35], "초록": [0.30, 0.70, 0.35], "녹색": [0.30, 0.70, 0.35], "초록색": [0.30, 0.70, 0.35],
  blue: [0.25, 0.50, 0.88], "파랑": [0.25, 0.50, 0.88], "파란": [0.25, 0.50, 0.88], "파란색": [0.25, 0.50, 0.88],
  cyan: [0.30, 0.78, 0.82], "청록": [0.30, 0.78, 0.82],
  purple: [0.60, 0.35, 0.80], "보라": [0.60, 0.35, 0.80], "보라색": [0.60, 0.35, 0.80],
  pink: [0.92, 0.55, 0.72], "분홍": [0.92, 0.55, 0.72], "핑크": [0.92, 0.55, 0.72],
  white: [0.92, 0.92, 0.94], "흰": [0.92, 0.92, 0.94], "하양": [0.92, 0.92, 0.94], "흰색": [0.92, 0.92, 0.94],
  black: [0.13, 0.13, 0.16], "검정": [0.13, 0.13, 0.16], "검은": [0.13, 0.13, 0.16], "검정색": [0.13, 0.13, 0.16],
  gray: [0.55, 0.55, 0.58], grey: [0.55, 0.55, 0.58], "회색": [0.55, 0.55, 0.58],
  brown: [0.5, 0.34, 0.22], "갈색": [0.5, 0.34, 0.22],
  gold: [0.86, 0.70, 0.30], "금색": [0.86, 0.70, 0.30], "황금": [0.86, 0.70, 0.30],
  silver: [0.75, 0.78, 0.82], "은색": [0.75, 0.78, 0.82],
};

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  "하나": 1, "둘": 2, "셋": 3, "넷": 4, "다섯": 5, "여섯": 6, "일곱": 7, "여덟": 8, "아홉": 9, "열": 10,
  "한": 1, "두": 2, "세": 3, "네": 4,
};

// Object kind synonyms -> canonical recipe id.
const OBJECTS = [
  ["tree", ["tree", "나무", "trees", "pine", "소나무"]],
  ["house", ["house", "집", "home", "cottage", "cabin", "오두막"]],
  ["car", ["car", "자동차", "차", "vehicle", "auto"]],
  ["robot", ["robot", "로봇", "android", "bot", "mech"]],
  ["snowman", ["snowman", "눈사람"]],
  ["mushroom", ["mushroom", "버섯", "toadstool"]],
  ["rocket", ["rocket", "로켓", "spaceship", "우주선", "missile"]],
  ["chair", ["chair", "의자", "stool"]],
  ["table", ["table", "테이블", "책상", "desk"]],
  ["sword", ["sword", "검", "칼", "blade"]],
  ["gem", ["gem", "보석", "crystal", "크리스탈", "수정", "diamond", "다이아몬드", "jewel"]],
  ["flower", ["flower", "꽃", "rose", "tulip"]],
  ["castle", ["castle", "성", "tower", "탑", "fort"]],
  ["person", ["person", "사람", "human", "man", "woman", "people", "character", "캐릭터"]],
  ["cat", ["cat", "고양이", "kitten", "animal", "동물", "dog", "강아지", "개"]],
  ["star", ["star", "별", "starfish"]],
  ["heart", ["heart", "하트", "심장"]],
  ["donut", ["donut", "도넛", "doughnut", "torus", "ring", "반지"]],
  ["mountain", ["mountain", "산", "hill", "언덕"]],
  ["lamp", ["lamp", "램프", "전등", "streetlight", "가로등"]],
  ["cactus", ["cactus", "선인장"]],
  ["boat", ["boat", "배", "ship", "선박"]],
  ["bottle", ["bottle", "병", "vase", "꽃병"]],
];

const STYLES = [
  ["lowpoly", ["lowpoly", "low-poly", "low poly", "로우폴리", "저폴리"]],
  ["spiky", ["spiky", "spike", "sharp", "뾰족", "가시"]],
  ["round", ["round", "smooth", "둥근", "둥글", "부드러운"]],
  ["tall", ["tall", "high", "큰키", "키큰", "긴", "높은", "높이"]],
  ["wide", ["wide", "fat", "넓은", "뚱뚱", "두꺼운"]],
  ["tiny", ["tiny", "small", "mini", "작은", "작게", "미니"]],
  ["big", ["big", "huge", "large", "giant", "큰", "거대한", "크게"]],
];

function findColors(text) {
  const found = [];
  for (const [name, rgb] of Object.entries(COLORS)) {
    if (text.includes(name)) found.push(rgb);
  }
  return found;
}

function findCount(text) {
  const digit = text.match(/(\d+)\s*(개|마리|채|그루|송이|x|times)?/);
  if (digit) {
    const n = parseInt(digit[1], 10);
    if (n >= 1 && n <= 12) return n;
  }
  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    if (text.includes(word)) return n;
  }
  return 1;
}

function findObject(text) {
  for (const [id, words] of OBJECTS) {
    for (const w of words) {
      if (text.includes(w)) return id;
    }
  }
  return null;
}

function findStyles(text) {
  const set = new Set();
  for (const [id, words] of STYLES) {
    for (const w of words) {
      if (text.includes(w)) { set.add(id); break; }
    }
  }
  return [...set];
}

export function parsePrompt(rawPrompt) {
  const text = (rawPrompt || "").toLowerCase().trim();
  return {
    raw: rawPrompt,
    text,
    object: findObject(text),
    colors: findColors(text),
    count: findCount(text),
    styles: findStyles(text),
  };
}

export { COLORS };
