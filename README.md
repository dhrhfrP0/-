# Text → 3D · 나만의 3D 모델 생성 AI

문장(프롬프트)을 입력하면 **절차적으로 3D 모델을 생성**해 브라우저에서 바로 보여주고,
`.OBJ` / `.STL` / `.glTF` 로 내보낼 수 있는 웹앱입니다.

- **외부 의존성 0개** — Three.js 같은 라이브러리 없이 **자체 WebGL2 렌더러**를 직접 구현했습니다. 오프라인에서도 완전히 동작합니다.
- **한국어 · 영어 프롬프트** 모두 인식합니다.
- **GPU·학습 불필요** — 규칙/파라미터 기반 절차 생성이라 어떤 환경에서도 즉시 동작합니다.

## 빠른 시작

```bash
npm start          # = node server.js
# 브라우저에서 http://localhost:5173 열기
```

> ES 모듈을 쓰므로 `index.html`을 파일로 직접 여는 대신 위 서버로 실행하세요.
> (Python만 있다면 `python3 -m http.server 5173` 도 가능합니다.)

엔진 검증 테스트:

```bash
npm test
```

## 사용법

1. 프롬프트 입력 (예: `빨간 지붕의 작은 집`, `파란 로봇 3개`, `눈 덮인 산`).
2. **✨ 생성하기** (또는 `Ctrl+Enter`).
3. **🎲 변형** 으로 같은 프롬프트의 다른 무작위 변형을 생성. 시드를 직접 입력하면 결과가 고정·재현됩니다.
4. `.OBJ` / `.STL` / `.glTF` 버튼으로 다운로드 → Blender, 게임 엔진, 3D 프린터 등에서 사용.

뷰어 조작: **드래그=회전, 휠=확대/축소, Shift+드래그(우클릭)=이동.**

## 프롬프트가 인식하는 것

| 종류 | 예시 키워드 |
|------|-------------|
| **사물** | 나무/tree, 집/house, 자동차/car, 로봇/robot, 눈사람/snowman, 버섯/mushroom, 로켓/rocket, 의자/chair, 테이블/table, 검/sword, 보석/gem, 꽃/flower, 성/castle, 사람/person, 고양이/cat, 별/star, 하트/heart, 도넛/donut, 산/mountain, 램프/lamp, 선인장/cactus, 배/boat, 병/bottle |
| **색상** | 빨강, 파랑, 초록, 노랑, 주황, 보라, 분홍, 흰, 검정, 회색, 갈색, 금색, 은색 (영어 동일) |
| **개수** | `3`, `다섯개`, `3그루`, `two` … (1~12개를 격자로 배치) |
| **스타일** | 큰/거대한, 작은, 키 큰/높은, 넓은, 둥근, 뾰족, 로우폴리 |

> 인식되는 사물이 없으면, 프롬프트 텍스트를 해시한 시드로 **추상 조형물**을 생성합니다.
> 즉, **어떤 입력이든 항상 결과가 나옵니다.**

## 구조

```
index.html              UI 레이아웃
styles/style.css        스타일
server.js               의존성 없는 정적 서버
src/
  glmath.js             4x4 행렬 / vec3 수학
  rng.js                시드 기반 결정적 난수 (재현 가능)
  mesh.js               인덱스 메시 자료구조 (병합·법선·바운딩)
  primitives.js         박스/구/원기둥/원뿔/토러스 등 파라메트릭 프리미티브
  parser.js             프롬프트 → 의도(intent) 파싱 (한/영)
  library.js            사물별 절차 생성 레시피 (23종) + 추상 조형
  generator.js          파서+레시피 결합, 개수/스타일/배치 적용
  exporter.js           OBJ / STL / glTF 내보내기
  webgl-viewer.js       자체 WebGL2 렌더러 + 오빗 컨트롤
  main.js               UI 연결
test/generate.test.js   엔진 검증 (모든 레시피·내보내기·결정성)
```

## 동작 원리

```
프롬프트 ──parser──▶ intent{object, colors, count, styles}
                         │
                         ▼
        seed(텍스트 해시) ─▶ RNG ─▶ library 레시피(프리미티브 조합)
                         │
                         ▼
            개수 배치 · 스타일 스케일 · 바닥 정렬 ─▶ Mesh
                         │
              ┌──────────┼───────────┐
              ▼          ▼           ▼
          WebGL 뷰어   OBJ/STL/glTF  통계
```

같은 `프롬프트 + 시드`는 항상 **동일한 모델**을 생성합니다(결정적).

## 확장하기

새 사물을 추가하려면:

1. `src/library.js` 에 `function myThing(rng, ctx) { ... return mesh; }` 추가 후 `RECIPES` 에 등록.
2. `src/parser.js` 의 `OBJECTS` 에 키워드(한/영) 추가.
3. 필요하면 `index.html` 의 예시 칩에도 추가.

## 라이선스

MIT
