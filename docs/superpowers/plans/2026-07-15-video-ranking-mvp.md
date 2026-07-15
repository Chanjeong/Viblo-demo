# Video Ranking MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TikTok/IG/YouTube URL(또는 MP4 업로드) 클립 N개를 랭킹 숏폼(9:16, 1080×1920) 하나로 합성·미리보기·내보내기하는 로컬 Next.js 웹앱.

**Architecture:** 단일 Next.js 앱(App Router). Remotion 컴포지션 `<RankingVideo/>`를 브라우저 미리보기(`@remotion/player`)와 서버 렌더(`@remotion/renderer`)가 **공유**한다. URL 인제스트는 `yt-dlp`, 미디어는 로컬 `storage/`에 저장하고 Range 지원 HTTP 라우트로 서빙한다. 렌더는 백그라운드 잡 + 폴링.

**Tech Stack:** Next.js 15(App Router, TS), React 19, Remotion 4(`remotion`, `@remotion/player/bundler/renderer/cli/google-fonts`), zod, zustand, @dnd-kit, react-colorful, execa, vitest, tsx. 외부 바이너리: `ffmpeg`/`ffprobe`(설치됨), `yt-dlp`.

## Global Constraints

- 출력 규격 고정: **1080×1920, 30fps, H.264/AAC mp4** (유튜브 쇼츠/틱톡/릴스 규격).
- 클립 간 전환은 **하드컷** 고정. 클립 시작 시 해당 라벨이 **~0.33초(10프레임) 페이드인** 후 영상 끝까지 유지(누적).
- 숫자 팔레트 고정: rank1 `#E8252A`(빨강), rank2 `#F7941D`(주황), rank3 `#FFD200`(노랑), rank4+ `#FFFFFF`(흰) — 전부 검은 외곽선.
- 배경 기본 `#2B2A2A`, Video height 기본 `80`%.
- 업로드는 MP4만, **최대 500MB**.
- **Vercel 서버리스 배포 금지** — 항상 로컬 Node 서버(`next dev`/`next start`). 모든 API 라우트는 Node 런타임.
- 신뢰성 원칙: 모든 외부 프로세스(yt-dlp/ffprobe)는 타임아웃 필수, 실패는 유형 분류 후 한국어 메시지 + 업로드 폴백 안내. 렌더 시작 전 프로젝트 전체 검증(문제 클립 명시).
- 앱 루트는 저장소 하위 `web/` 디렉터리. 모든 npm 명령은 `web/`에서 실행.
- TDD: 순수 로직(스키마·타임라인·Range 파서·에러 분류·잡 레지스트리·스토어)은 vitest로 테스트 우선. UI는 브라우저 수동 검증 체크리스트.

## File Structure

```
Viblo/                          (git 루트, docs/ 기존)
└─ web/                         (Next.js 앱 루트 — Task 1에서 생성)
   ├─ next.config.ts
   ├─ vitest.config.ts
   ├─ scripts/
   │  ├─ make-fixtures.mjs      ffmpeg로 테스트 클립 3개 생성
   │  ├─ fixture-project.json   CLI 렌더용 RenderProject 픽스처
   │  └─ render.ts              CLI: RenderProject JSON → mp4
   ├─ public/fixtures/          (생성물, gitignore)
   ├─ storage/                  (gitignore) media/  renders/
   └─ src/
      ├─ lib/
      │  ├─ project.ts          도메인 타입 + zod 스키마 + 기본값 + buildRenderProject
      │  ├─ timeline.ts         computeTimeline·rankColor·레이아웃 상수·revealFrames
      │  ├─ media.ts            storage 경로·저장·ffprobe·uuid 검증
      │  ├─ range.ts            HTTP Range 헤더 파서(순수)
      │  ├─ ytdlp.ts            yt-dlp 실행·재시도·에러 분류
      │  ├─ jobs.ts             렌더 잡 레지스트리(globalThis)
      │  └─ renderer.ts         bundle 캐시 + renderProjectToFile
      ├─ remotion/
      │  ├─ index.ts            registerRoot
      │  ├─ Root.tsx            Composition + calculateMetadata
      │  ├─ fonts.ts            Archivo Black·Rubik 로드
      │  ├─ StrokedText.tsx     외곽선 텍스트(2겹 span)
      │  ├─ RankingVideo.tsx    최상위 컴포지션
      │  ├─ TitleBand.tsx       상단 제목 밴드
      │  ├─ NumberColumn.tsx    좌측 숫자+라벨(페이드인)
      │  └─ ClipLayer.tsx       클립 영상(cover 크롭·트림·볼륨)
      ├─ store/editor.ts        zustand 에디터 스토어(동기 변이만)
      ├─ components/
      │  ├─ TitleEditor.tsx     전체 제목 편집기
      │  ├─ GeneralSettings.tsx 높이%·배경색
      │  ├─ ColorPopover.tsx    react-colorful 팝오버
      │  ├─ ClipCard.tsx        URL/업로드/트림/볼륨/라벨
      │  ├─ TrimSlider.tsx      듀얼 핸들 트림 슬라이더
      │  ├─ OrderPanel.tsx      Custom Playback Order(dnd)
      │  ├─ PreviewPane.tsx     Remotion Player 미리보기
      │  └─ GeneratePanel.tsx   렌더 시작·진행률·다운로드
      └─ app/
         ├─ page.tsx            에디터 페이지(좌 설정/우 미리보기)
         └─ api/
            ├─ upload/route.ts
            ├─ ingest/route.ts
            ├─ media/[id]/route.ts
            └─ render/route.ts · render/[jobId]/route.ts · render/[jobId]/download/route.ts
```

**책임 분리:** `lib/`는 React 무관 순수/서버 로직(전부 단위테스트 가능), `remotion/`은 영상 화면 정의(미리보기·렌더 공유), `components/`는 에디터 UI, `app/api/`는 얇은 HTTP 어댑터(검증→lib 호출→응답).

---

### Task 1: Next.js 스캐폴드 + 도구 설정

**Files:**
- Create: `web/` (create-next-app), `web/vitest.config.ts`, `web/src/lib/smoke.test.ts`, `web/.env.local`
- Modify: `web/next.config.ts`, `web/package.json`(scripts), `web/.gitignore`

**Interfaces:**
- Produces: 실행 가능한 dev 서버, `npm test`(vitest), 경로 별칭 `@/* → src/*`, `storage/media`·`storage/renders` 디렉터리, `serverExternalPackages` 설정.

- [ ] **Step 1: 앱 생성**

```bash
cd "C:/Users/User/Desktop/myProject/Viblo"
npx create-next-app@latest web --ts --app --src-dir --tailwind --eslint --use-npm --import-alias "@/*" --turbopack --no-react-compiler
```
Expected: `web/` 생성, `npm run dev` 가능 상태. (프롬프트가 나오면 위 플래그 값대로 답변.)

- [ ] **Step 2: 의존성 설치**

```bash
cd web
npm i remotion @remotion/player @remotion/bundler @remotion/renderer @remotion/cli @remotion/google-fonts zod zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-colorful execa
npm i -D vitest tsx
```
Expected: 에러 없이 설치. `remotion`계열 5개 패키지 버전 동일(^4.x) 확인: `npm ls remotion @remotion/renderer`.

- [ ] **Step 3: next.config / scripts / gitignore / env / storage 디렉터리**

`web/next.config.ts` 전체 교체:
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Remotion 렌더러/번들러는 네이티브 바이너리를 포함하므로 Next 번들링에서 제외
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', 'esbuild'],
};

export default nextConfig;
```

`web/package.json`의 `scripts`에 추가:
```json
"test": "vitest run",
"studio": "remotion studio src/remotion/index.ts",
"fixtures": "node scripts/make-fixtures.mjs",
"render:cli": "tsx scripts/render.ts scripts/fixture-project.json"
```

`web/.gitignore`에 추가:
```
storage/
public/fixtures/
```

`web/.env.local` 생성:
```
# 서버 렌더가 자기 자신에게 미디어를 요청할 때 쓰는 오리진
APP_ORIGIN=http://127.0.0.1:3000
# 바이너리 경로 재정의(비우면 PATH 사용)
YT_DLP_PATH=
FFPROBE_PATH=
```

`web/vitest.config.ts` 생성:
```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

디렉터리 생성(PowerShell):
```powershell
New-Item -ItemType Directory -Force web/storage/media, web/storage/renders, web/public/fixtures
```

- [ ] **Step 4: 스모크 테스트 작성 → 실행**

`web/src/lib/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```
Run: `npm test` → Expected: 1 passed.
Run: `npm run dev` 후 http://localhost:3000 접속 → Next 기본 페이지 확인, 서버 종료.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app with remotion/vitest toolchain"
```

---

### Task 2: 프로젝트 도메인 모델 (types + zod + 기본값 + buildRenderProject)

**Files:**
- Create: `web/src/lib/project.ts`, `web/src/lib/project.test.ts`

**Interfaces:**
- Produces (이후 모든 태스크가 사용):
  - 타입: `Align`, `FontFamilyId('archivo-black'|'rubik')`, `TitleStyle`, `LabelStyle`, `ClipSource`, `Clip`, `Project`, `ResolvedSrc`, `RenderClip`, `RenderProject`, `ResolveSrc`
  - 함수: `defaultTitle(): TitleStyle`, `defaultLabel(): LabelStyle`, `newClip(): Clip`, `defaultProject(): Project`
  - `ProjectSchema`(zod) — API 경계 검증용
  - `buildRenderProject(project: Project, resolveSrc: ResolveSrc): { ok: true; value: RenderProject } | { ok: false; problems: string[] }`
  - 상수: `WIDTH=1080, HEIGHT=1920, FPS=30, MAX_UPLOAD_BYTES=524_288_000, MIN_TRIM_SEC=0.5`

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/lib/project.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  defaultProject, newClip, buildRenderProject, ProjectSchema, MIN_TRIM_SEC,
} from '@/lib/project';

const resolveSrc = (mediaId: string) => ({ kind: 'url' as const, url: `/api/media/${mediaId}` });

function readyClip(rankLabel: string) {
  const c = newClip();
  c.source = { type: 'upload', mediaId: crypto.randomUUID() };
  c.durationSec = 10;
  c.trim = { startSec: 1, endSec: 6 };
  c.label.text = rankLabel;
  return c;
}

describe('defaults', () => {
  it('has spec defaults', () => {
    const p = defaultProject();
    expect(p.general).toEqual({ videoHeightPct: 80, backgroundColor: '#2B2A2A' });
    expect(p.title.fontFamily).toBe('archivo-black');
    expect(p.customOrder).toBeNull();
    expect(p.clips.length).toBe(1); // 빈 카드 1개로 시작
  });
});

describe('ProjectSchema', () => {
  it('accepts a default project', () => {
    expect(ProjectSchema.safeParse(defaultProject()).success).toBe(true);
  });
  it('rejects volume out of range', () => {
    const p = defaultProject();
    p.clips[0].volume = 1.5;
    expect(ProjectSchema.safeParse(p).success).toBe(false);
  });
});

describe('buildRenderProject', () => {
  it('builds in default (rank) order with ranks assigned by card index', () => {
    const p = defaultProject();
    p.clips = [readyClip('A'), readyClip('B')];
    const r = buildRenderProject(p, resolveSrc);
    if (!r.ok) throw new Error(r.problems.join());
    expect(r.value.clips.map((c) => c.rank)).toEqual([1, 2]);
    expect(r.value.clips[0].src).toEqual({ kind: 'url', url: expect.stringContaining('/api/media/') });
  });
  it('applies customOrder as playback order but keeps ranks', () => {
    const p = defaultProject();
    p.clips = [readyClip('A'), readyClip('B')];
    p.customOrder = [p.clips[1].id, p.clips[0].id];
    const r = buildRenderProject(p, resolveSrc);
    if (!r.ok) throw new Error(r.problems.join());
    expect(r.value.clips.map((c) => c.rank)).toEqual([2, 1]);
  });
  it('reports problems per clip: missing media, bad trim, too-short trim', () => {
    const p = defaultProject();
    const bad = readyClip('X');
    bad.trim = { startSec: 5, endSec: 5 + MIN_TRIM_SEC / 2 };
    const noMedia = newClip();
    p.clips = [bad, noMedia];
    const r = buildRenderProject(p, resolveSrc);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problems.length).toBeGreaterThanOrEqual(2);
    expect(r.problems.join()).toMatch(/1번/);
    expect(r.problems.join()).toMatch(/2번/);
  });
  it('rejects customOrder that is not a permutation of clip ids', () => {
    const p = defaultProject();
    p.clips = [readyClip('A')];
    p.customOrder = ['nonexistent'];
    const r = buildRenderProject(p, resolveSrc);
    expect(r.ok).toBe(false);
  });
  it('rejects empty project (no clips)', () => {
    const p = defaultProject();
    p.clips = [];
    expect(buildRenderProject(p, resolveSrc).ok).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test` → Expected: FAIL (`@/lib/project` 없음).

- [ ] **Step 3: 구현**

`web/src/lib/project.ts`:
```ts
import { z } from 'zod';

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;
export const MAX_UPLOAD_BYTES = 524_288_000; // 500MB
export const MIN_TRIM_SEC = 0.5;

export type Align = 'left' | 'center' | 'right';
export type FontFamilyId = 'archivo-black' | 'rubik';

export interface TitleStyle {
  text: string; // \n 줄바꿈 허용
  fontFamily: FontFamilyId;
  fontSizePx: number;
  bold: boolean;
  italic: boolean;
  align: Align;
  color: string;
  strokeWidthPx: number;
  strokeColor: string;
}

export interface LabelStyle {
  text: string;
  fontSizePx: number;
  color: string;
  strokeWidthPx: number;
  strokeColor: string;
}

export type ClipSource =
  | { type: 'url'; url: string; mediaId: string | null }
  | { type: 'upload'; mediaId: string };

export interface Clip {
  id: string;
  source: ClipSource | null; // null = 아직 입력 안 됨
  durationSec: number | null; // 프로브 후 확정
  trim: { startSec: number; endSec: number } | null;
  volume: number; // 0..1
  label: LabelStyle;
}

export interface Project {
  title: TitleStyle;
  general: { videoHeightPct: number; backgroundColor: string };
  customOrder: string[] | null; // null = 기본(rank) 순서
  clips: Clip[]; // 배열 인덱스+1 = rank
}

export type ResolvedSrc = { kind: 'url'; url: string } | { kind: 'static'; path: string };
export type ResolveSrc = (mediaId: string) => ResolvedSrc;

export interface RenderClip {
  id: string;
  rank: number;
  src: ResolvedSrc;
  trimStartSec: number;
  trimEndSec: number;
  volume: number;
  label: LabelStyle;
}

export interface RenderProject {
  title: TitleStyle;
  general: { videoHeightPct: number; backgroundColor: string };
  clips: RenderClip[]; // 재생 순서대로
  ranksTotal: number;
}

export function defaultTitle(): TitleStyle {
  return {
    text: '', fontFamily: 'archivo-black', fontSizePx: 76,
    bold: false, italic: false, align: 'center',
    color: '#FFFFFF', strokeWidthPx: 4, strokeColor: '#000000',
  };
}

export function defaultLabel(): LabelStyle {
  return { text: '', fontSizePx: 52, color: '#FFFFFF', strokeWidthPx: 6, strokeColor: '#000000' };
}

export function newClip(): Clip {
  return { id: crypto.randomUUID(), source: null, durationSec: null, trim: null, volume: 1, label: defaultLabel() };
}

export function defaultProject(): Project {
  return {
    title: defaultTitle(),
    general: { videoHeightPct: 80, backgroundColor: '#2B2A2A' },
    customOrder: null,
    clips: [newClip()],
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TitleSchema = z.object({
  text: z.string().max(200),
  fontFamily: z.enum(['archivo-black', 'rubik']),
  fontSizePx: z.number().min(20).max(200),
  bold: z.boolean(), italic: z.boolean(),
  align: z.enum(['left', 'center', 'right']),
  color: z.string().regex(HEX),
  strokeWidthPx: z.number().min(0).max(20),
  strokeColor: z.string().regex(HEX),
});

const LabelSchema = z.object({
  text: z.string().max(80),
  fontSizePx: z.number().min(20).max(150),
  color: z.string().regex(HEX),
  strokeWidthPx: z.number().min(0).max(20),
  strokeColor: z.string().regex(HEX),
});

const SourceSchema = z.union([
  z.object({ type: z.literal('url'), url: z.string().url(), mediaId: z.string().regex(UUID).nullable() }),
  z.object({ type: z.literal('upload'), mediaId: z.string().regex(UUID) }),
]);

const ClipSchema = z.object({
  id: z.string().min(1),
  source: SourceSchema.nullable(),
  durationSec: z.number().positive().nullable(),
  trim: z.object({ startSec: z.number().min(0), endSec: z.number().positive() }).nullable(),
  volume: z.number().min(0).max(1),
  label: LabelSchema,
});

export const ProjectSchema = z.object({
  title: TitleSchema,
  general: z.object({
    videoHeightPct: z.number().min(50).max(100),
    backgroundColor: z.string().regex(HEX),
  }),
  customOrder: z.array(z.string()).nullable(),
  clips: z.array(ClipSchema).max(20),
});

function mediaIdOf(source: ClipSource | null): string | null {
  if (!source) return null;
  return source.mediaId;
}

export function buildRenderProject(
  project: Project,
  resolveSrc: ResolveSrc,
): { ok: true; value: RenderProject } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  if (project.clips.length < 1) problems.push('클립이 1개 이상 필요합니다.');

  project.clips.forEach((clip, i) => {
    const n = i + 1;
    const mediaId = mediaIdOf(clip.source);
    if (!mediaId) {
      problems.push(`${n}번 클립: 영상이 아직 준비되지 않았습니다(URL 가져오기 또는 업로드 필요).`);
      return;
    }
    if (clip.durationSec == null || clip.trim == null) {
      problems.push(`${n}번 클립: 영상 길이 정보가 없습니다. 다시 가져와 주세요.`);
      return;
    }
    const { startSec, endSec } = clip.trim;
    if (!(startSec >= 0 && endSec <= clip.durationSec + 0.05 && startSec < endSec)) {
      problems.push(`${n}번 클립: 트림 구간이 잘못되었습니다 (0 ≤ 시작 < 끝 ≤ ${clip.durationSec.toFixed(1)}s).`);
      return;
    }
    if (endSec - startSec < MIN_TRIM_SEC) {
      problems.push(`${n}번 클립: 트림 구간이 너무 짧습니다 (최소 ${MIN_TRIM_SEC}s).`);
    }
  });

  // 재생 순서 결정
  let ordered = project.clips;
  if (project.customOrder) {
    const byId = new Map(project.clips.map((c) => [c.id, c]));
    const sameSet =
      project.customOrder.length === project.clips.length &&
      project.customOrder.every((id) => byId.has(id));
    if (!sameSet) {
      problems.push('재생 순서(customOrder)가 클립 목록과 일치하지 않습니다.');
    } else {
      ordered = project.customOrder.map((id) => byId.get(id)!);
    }
  }

  if (problems.length > 0) return { ok: false, problems };

  const rankByClipId = new Map(project.clips.map((c, i) => [c.id, i + 1]));
  return {
    ok: true,
    value: {
      title: project.title,
      general: project.general,
      ranksTotal: project.clips.length,
      clips: ordered.map((c) => ({
        id: c.id,
        rank: rankByClipId.get(c.id)!,
        src: resolveSrc(mediaIdOf(c.source)!),
        trimStartSec: c.trim!.startSec,
        trimEndSec: c.trim!.endSec,
        volume: c.volume,
        label: c.label,
      })),
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test` → Expected: project.test.ts 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/project.ts src/lib/project.test.ts
git commit -m "feat: project domain model with zod schema and render-project builder"
```

---

### Task 3: 타임라인·팔레트·레이아웃 헬퍼

**Files:**
- Create: `web/src/lib/timeline.ts`, `web/src/lib/timeline.test.ts`

**Interfaces:**
- Consumes: `RenderProject`, `FPS` (Task 2)
- Produces (컴포지션·Player·calculateMetadata가 사용):
  - `interface ClipTiming { from: number; durationInFrames: number }`
  - `computeTimeline(clips: { trimStartSec: number; trimEndSec: number }[], fps: number): { timings: ClipTiming[]; totalFrames: number }`
  - `revealFramesByRank(project: RenderProject, fps: number): Map<number, number>` — rank → 그 rank 클립이 시작되는 절대 프레임
  - `rankColor(rank: number): string`
  - `LAYOUT` 상수 + `videoBox(videoHeightPct)` → `{ top, height }` + `numberRowCenterY(index, count, videoTop, videoHeight)`
  - `LABEL_FADE_FRAMES = 10`

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/lib/timeline.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  computeTimeline, revealFramesByRank, rankColor, videoBox, numberRowCenterY,
} from '@/lib/timeline';
import type { RenderProject } from '@/lib/project';

describe('computeTimeline', () => {
  it('stacks clips back-to-back (hard cut)', () => {
    const r = computeTimeline(
      [{ trimStartSec: 0, trimEndSec: 2 }, { trimStartSec: 1, trimEndSec: 2.5 }],
      30,
    );
    expect(r.timings).toEqual([
      { from: 0, durationInFrames: 60 },
      { from: 60, durationInFrames: 45 },
    ]);
    expect(r.totalFrames).toBe(105);
  });
  it('never returns 0-frame clips', () => {
    const r = computeTimeline([{ trimStartSec: 0, trimEndSec: 0.001 }], 30);
    expect(r.timings[0].durationInFrames).toBe(1);
  });
});

describe('revealFramesByRank', () => {
  it('maps each rank to its playback start frame', () => {
    const p = {
      clips: [
        { rank: 2, trimStartSec: 0, trimEndSec: 1 },
        { rank: 1, trimStartSec: 0, trimEndSec: 1 },
      ],
    } as unknown as RenderProject;
    const m = revealFramesByRank(p, 30);
    expect(m.get(2)).toBe(0);
    expect(m.get(1)).toBe(30);
  });
});

describe('palette & layout', () => {
  it('rank colors per spec', () => {
    expect(rankColor(1)).toBe('#E8252A');
    expect(rankColor(2)).toBe('#F7941D');
    expect(rankColor(3)).toBe('#FFD200');
    expect(rankColor(4)).toBe('#FFFFFF');
    expect(rankColor(9)).toBe('#FFFFFF');
  });
  it('videoBox centers vertically', () => {
    expect(videoBox(80)).toEqual({ top: 192, height: 1536 });
    expect(videoBox(100)).toEqual({ top: 0, height: 1920 });
  });
  it('number rows spread down and stay inside the video box', () => {
    const { top, height } = videoBox(80);
    const y0 = numberRowCenterY(0, 5, top, height);
    const y4 = numberRowCenterY(4, 5, top, height);
    expect(y0).toBeGreaterThan(top);
    expect(y4).toBeLessThan(top + height);
    expect(y4).toBeGreaterThan(y0);
    // 10개여도 박스 안
    expect(numberRowCenterY(9, 10, top, height)).toBeLessThan(top + height);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test` → Expected: FAIL (`@/lib/timeline` 없음).

- [ ] **Step 3: 구현**

`web/src/lib/timeline.ts`:
```ts
import { HEIGHT, type RenderProject } from '@/lib/project';

export const LABEL_FADE_FRAMES = 10;

export interface ClipTiming { from: number; durationInFrames: number }

export function computeTimeline(
  clips: { trimStartSec: number; trimEndSec: number }[],
  fps: number,
): { timings: ClipTiming[]; totalFrames: number } {
  const timings: ClipTiming[] = [];
  let cursor = 0;
  for (const c of clips) {
    const durationInFrames = Math.max(1, Math.round((c.trimEndSec - c.trimStartSec) * fps));
    timings.push({ from: cursor, durationInFrames });
    cursor += durationInFrames;
  }
  return { timings, totalFrames: cursor };
}

export function revealFramesByRank(project: RenderProject, fps: number): Map<number, number> {
  const { timings } = computeTimeline(project.clips, fps);
  const m = new Map<number, number>();
  project.clips.forEach((c, i) => m.set(c.rank, timings[i].from));
  return m;
}

const PALETTE: Record<number, string> = { 1: '#E8252A', 2: '#F7941D', 3: '#FFD200' };
export function rankColor(rank: number): string {
  return PALETTE[rank] ?? '#FFFFFF';
}

// ── 레이아웃 (참고 영상 실측 기반, 1080×1920 기준) ─────────────────
export const LAYOUT = {
  numberX: 55,          // 숫자 왼쪽 x
  labelX: 205,          // 라벨 왼쪽 x
  numberFontPx: 110,
  numberStrokePx: 8,
  titlePadX: 40,
  rowFirstRatio: 0.115, // 첫 줄: videoTop + videoH * 0.115
  rowStepRatio: 0.12,   // 기본 줄 간격 비율
  rowMaxSpanRatio: 0.77, // 줄들이 차지할 수 있는 최대 세로 비율
};

export function videoBox(videoHeightPct: number): { top: number; height: number } {
  const height = Math.round((HEIGHT * videoHeightPct) / 100);
  return { top: Math.round((HEIGHT - height) / 2), height };
}

export function numberRowCenterY(
  index: number, count: number, videoTop: number, videoHeight: number,
): number {
  const step = count <= 1
    ? 0
    : Math.min(LAYOUT.rowStepRatio, LAYOUT.rowMaxSpanRatio / (count - 1));
  return Math.round(videoTop + videoHeight * (LAYOUT.rowFirstRatio + step * index));
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test` → Expected: 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.ts src/lib/timeline.test.ts
git commit -m "feat: timeline, rank palette and layout helpers"
```

---

### Task 4: Remotion 컴포지션 `<RankingVideo/>` + 픽스처 + Studio 육안 검증

**Files:**
- Create: `web/src/remotion/fonts.ts`, `web/src/remotion/StrokedText.tsx`, `web/src/remotion/TitleBand.tsx`, `web/src/remotion/NumberColumn.tsx`, `web/src/remotion/ClipLayer.tsx`, `web/src/remotion/RankingVideo.tsx`, `web/src/remotion/Root.tsx`, `web/src/remotion/index.ts`, `web/scripts/make-fixtures.mjs`, `web/src/remotion/preview-fixture.ts`, `web/src/remotion/metadata.test.ts`

**Interfaces:**
- Consumes: Task 2 타입, Task 3 헬퍼
- Produces:
  - 컴포지션 id `'RankingVideo'`, props `{ project: RenderProject }`, 1080×1920@30
  - `calculateRankingMetadata` (Root에서 사용, 테스트 대상)
  - `FONT_FAMILIES: Record<FontFamilyId, string>` (fonts.ts)
  - `fixturePreviewProject(): RenderProject` — static 픽스처 3클립(Studio/기본 props용)
  - `npm run fixtures` → `public/fixtures/clip-{a,b,c}.mp4` (6s/8s/5s)

- [ ] **Step 1: 픽스처 생성 스크립트 작성 + 실행**

`web/scripts/make-fixtures.mjs`:
```js
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('public/fixtures', { recursive: true });

const clips = [
  { name: 'clip-a', dur: 6, freq: 440, src: 'testsrc2' },
  { name: 'clip-b', dur: 8, freq: 660, src: 'smptebars' },
  { name: 'clip-c', dur: 5, freq: 880, src: 'testsrc' },
];

for (const { name, dur, freq, src } of clips) {
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `${src}=size=720x1280:rate=30:duration=${dur}`,
    '-f', 'lavfi', '-i', `sine=frequency=${freq}:duration=${dur}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    `public/fixtures/${name}.mp4`,
  ], { stdio: 'inherit' });
  console.log(`made ${name}.mp4 (${dur}s)`);
}
```
Run: `npm run fixtures` → Expected: `public/fixtures/clip-a.mp4`(6s), `clip-b.mp4`(8s), `clip-c.mp4`(5s) 생성. (ffmpeg가 PATH에 없다고 나오면 새 셸을 열거나 `winget install Gyan.FFmpeg` 후 재시도.)

- [ ] **Step 2: calculateMetadata 실패 테스트 작성**

`web/src/remotion/metadata.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { calculateRankingMetadata } from '@/remotion/Root';
import { fixturePreviewProject } from '@/remotion/preview-fixture';

describe('calculateRankingMetadata', () => {
  it('duration = sum of trimmed clip durations', async () => {
    const project = fixturePreviewProject(); // 3 clips: 4s + 5s + 3s = 12s
    const meta = await calculateRankingMetadata({ props: { project } } as never);
    expect(meta).toMatchObject({ durationInFrames: 360, fps: 30 });
  });
  it('empty project still returns >=1 frame', async () => {
    const project = { ...fixturePreviewProject(), clips: [] };
    const meta = await calculateRankingMetadata({ props: { project } } as never);
    expect((meta as { durationInFrames: number }).durationInFrames).toBeGreaterThanOrEqual(1);
  });
});
```
Run: `npm test` → Expected: FAIL.

- [ ] **Step 3: 컴포지션 구현**

`web/src/remotion/fonts.ts`:
```ts
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack';
import { loadFont as loadRubik } from '@remotion/google-fonts/Rubik';
import type { FontFamilyId } from '@/lib/project';

const archivo = loadArchivoBlack();
const rubik = loadRubik();

export const FONT_FAMILIES: Record<FontFamilyId, string> = {
  'archivo-black': `'${archivo.fontFamily}', 'Segoe UI Emoji', sans-serif`,
  rubik: `'${rubik.fontFamily}', 'Segoe UI Emoji', sans-serif`,
};
```

`web/src/remotion/StrokedText.tsx` (외곽선: 뒤 span에 2×폭 스트로크, 앞 span은 채움):
```tsx
import React from 'react';

export const StrokedText: React.FC<{
  text: string;
  fontFamily: string;
  fontSizePx: number;
  color: string;
  strokeWidthPx: number;
  strokeColor: string;
  bold?: boolean;
  italic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  shadow?: boolean;
}> = ({ text, fontFamily, fontSizePx, color, strokeWidthPx, strokeColor, bold, italic, textAlign = 'left', shadow }) => {
  const base: React.CSSProperties = {
    fontFamily,
    fontSize: fontSizePx,
    fontWeight: bold ? 800 : 700,
    fontStyle: italic ? 'italic' : 'normal',
    lineHeight: 1.25,
    whiteSpace: 'pre-wrap',
    textAlign,
    display: 'block',
  };
  return (
    <span style={{ position: 'relative', display: 'block' }}>
      <span
        aria-hidden
        style={{
          ...base,
          position: 'absolute',
          inset: 0,
          color: strokeColor,
          WebkitTextStroke: `${strokeWidthPx * 2}px ${strokeColor}`,
          textShadow: shadow ? '5px 7px 2px rgba(0,0,0,0.75)' : undefined,
        }}
      >
        {text}
      </span>
      <span style={{ ...base, position: 'relative', color }}>{text}</span>
    </span>
  );
};
```

`web/src/remotion/TitleBand.tsx`:
```tsx
import React from 'react';
import type { TitleStyle } from '@/lib/project';
import { LAYOUT } from '@/lib/timeline';
import { FONT_FAMILIES } from '@/remotion/fonts';
import { StrokedText } from '@/remotion/StrokedText';

export const TitleBand: React.FC<{ title: TitleStyle; bandHeight: number }> = ({ title, bandHeight }) => {
  const justify = { left: 'flex-start', center: 'center', right: 'flex-end' }[title.align];
  return (
    <div
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: bandHeight,
        display: 'flex', alignItems: 'center', justifyContent: justify,
        padding: `0 ${LAYOUT.titlePadX}px`,
      }}
    >
      <StrokedText
        text={title.text}
        fontFamily={FONT_FAMILIES[title.fontFamily]}
        fontSizePx={title.fontSizePx}
        color={title.color}
        strokeWidthPx={title.strokeWidthPx}
        strokeColor={title.strokeColor}
        bold={title.bold}
        italic={title.italic}
        textAlign={title.align}
      />
    </div>
  );
};
```

`web/src/remotion/NumberColumn.tsx` (숫자 항상 표시, 라벨은 reveal 프레임부터 페이드인):
```tsx
import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { RenderProject } from '@/lib/project';
import {
  LABEL_FADE_FRAMES, LAYOUT, numberRowCenterY, rankColor, revealFramesByRank, videoBox,
} from '@/lib/timeline';
import { FONT_FAMILIES } from '@/remotion/fonts';
import { StrokedText } from '@/remotion/StrokedText';

export const NumberColumn: React.FC<{ project: RenderProject }> = ({ project }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { top, height } = videoBox(project.general.videoHeightPct);
  const reveals = revealFramesByRank(project, fps);
  const byRank = [...project.clips].sort((a, b) => a.rank - b.rank);

  return (
    <>
      {byRank.map((clip, i) => {
        const y = numberRowCenterY(i, project.ranksTotal, top, height);
        const revealAt = reveals.get(clip.rank) ?? 0;
        const labelOpacity = interpolate(
          frame, [revealAt, revealAt + LABEL_FADE_FRAMES], [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
        return (
          <React.Fragment key={clip.id}>
            <div style={{ position: 'absolute', left: LAYOUT.numberX, top: y, transform: 'translateY(-50%)' }}>
              <StrokedText
                text={`${clip.rank}.`}
                fontFamily={FONT_FAMILIES['archivo-black']}
                fontSizePx={LAYOUT.numberFontPx}
                color={rankColor(clip.rank)}
                strokeWidthPx={LAYOUT.numberStrokePx}
                strokeColor="#000000"
                shadow
              />
            </div>
            <div
              style={{
                position: 'absolute', left: LAYOUT.labelX, top: y,
                transform: 'translateY(-50%)', opacity: labelOpacity, maxWidth: 700,
              }}
            >
              <StrokedText
                text={clip.label.text}
                fontFamily={FONT_FAMILIES.rubik}
                fontSizePx={clip.label.fontSizePx}
                color={clip.label.color}
                strokeWidthPx={clip.label.strokeWidthPx}
                strokeColor={clip.label.strokeColor}
                bold
              />
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
};
```

`web/src/remotion/ClipLayer.tsx` (cover 크롭 + 트림 + 볼륨; static/url 소스 해석):
```tsx
import React from 'react';
import { OffthreadVideo, staticFile, useVideoConfig } from 'remotion';
import type { RenderClip } from '@/lib/project';

export const ClipLayer: React.FC<{ clip: RenderClip; top: number; height: number }> = ({ clip, top, height }) => {
  const { fps } = useVideoConfig();
  const src = clip.src.kind === 'static' ? staticFile(clip.src.path) : clip.src.url;
  return (
    <div style={{ position: 'absolute', top, left: 0, width: '100%', height, overflow: 'hidden' }}>
      <OffthreadVideo
        src={src}
        trimBefore={Math.round(clip.trimStartSec * fps)}
        trimAfter={Math.round(clip.trimEndSec * fps)}
        volume={Math.max(0, Math.min(1, clip.volume))}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
};
```

`web/src/remotion/RankingVideo.tsx`:
```tsx
import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import type { RenderProject } from '@/lib/project';
import { computeTimeline, videoBox } from '@/lib/timeline';
import { ClipLayer } from '@/remotion/ClipLayer';
import { NumberColumn } from '@/remotion/NumberColumn';
import { TitleBand } from '@/remotion/TitleBand';

export const RankingVideo: React.FC<{ project: RenderProject }> = ({ project }) => {
  const { fps } = useVideoConfig();
  const { timings } = computeTimeline(project.clips, fps);
  const { top, height } = videoBox(project.general.videoHeightPct);

  return (
    <AbsoluteFill style={{ backgroundColor: project.general.backgroundColor }}>
      {project.clips.map((clip, i) => (
        <Sequence
          key={clip.id}
          from={timings[i].from}
          durationInFrames={timings[i].durationInFrames}
          premountFor={60}
        >
          <ClipLayer clip={clip} top={top} height={height} />
        </Sequence>
      ))}
      <TitleBand title={project.title} bandHeight={top} />
      <NumberColumn project={project} />
    </AbsoluteFill>
  );
};
```

`web/src/remotion/preview-fixture.ts` (Studio 기본 props · 테스트 공용):
```ts
import { defaultLabel, defaultTitle, type RenderProject } from '@/lib/project';

export function fixturePreviewProject(): RenderProject {
  const label = (text: string) => ({ ...defaultLabel(), text });
  return {
    title: { ...defaultTitle(), text: 'Ranking The Funniest\nBaby Reactions' },
    general: { videoHeightPct: 80, backgroundColor: '#2B2A2A' },
    ranksTotal: 3,
    clips: [
      { id: 'fx-2', rank: 2, src: { kind: 'static', path: 'fixtures/clip-b.mp4' }, trimStartSec: 0, trimEndSec: 4, volume: 1, label: label('Laugh') },
      { id: 'fx-3', rank: 3, src: { kind: 'static', path: 'fixtures/clip-c.mp4' }, trimStartSec: 0, trimEndSec: 5, volume: 1, label: label('Flower') },
      { id: 'fx-1', rank: 1, src: { kind: 'static', path: 'fixtures/clip-a.mp4' }, trimStartSec: 1, trimEndSec: 4, volume: 1, label: label('Medicine') },
    ],
  };
}
```

`web/src/remotion/Root.tsx`:
```tsx
import React from 'react';
import { Composition, type CalculateMetadataFunction } from 'remotion';
import { FPS, HEIGHT, WIDTH, type RenderProject } from '@/lib/project';
import { computeTimeline } from '@/lib/timeline';
import { fixturePreviewProject } from '@/remotion/preview-fixture';
import { RankingVideo } from '@/remotion/RankingVideo';

export const calculateRankingMetadata: CalculateMetadataFunction<{ project: RenderProject }> =
  ({ props }) => {
    const { totalFrames } = computeTimeline(props.project.clips, FPS);
    return { durationInFrames: Math.max(1, totalFrames), fps: FPS };
  };

export const RemotionRoot: React.FC = () => (
  <Composition
    id="RankingVideo"
    component={RankingVideo}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={1}
    defaultProps={{ project: fixturePreviewProject() }}
    calculateMetadata={calculateRankingMetadata}
  />
);
```

`web/src/remotion/index.ts`:
```ts
import { registerRoot } from 'remotion';
import { RemotionRoot } from '@/remotion/Root';

registerRoot(RemotionRoot);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test` → Expected: metadata.test.ts 포함 전부 PASS (12s×30fps=360프레임).

- [ ] **Step 5: Studio 육안 검증 (참고 프레임과 대조)**

Run: `npm run studio` → 브라우저에서:
1. 세로 1080×1920 캔버스, 배경 `#2B2A2A`, 중앙 80% 영역에서 클립 재생
2. 상단 밴드에 2줄 제목(흰색, 굵은 서체)
3. 좌측에 `1.`(빨강) `2.`(주황) `3.`(노랑) — 검은 외곽선, 처음부터 전부 표시
4. 재생 시: 0초에 "Laugh"(rank2 클립이 첫 재생) 페이드인 → 4초 하드컷+"Flower" 페이드인 → 9초 하드컷+"Medicine" 페이드인, 라벨 누적 유지
5. 참고 프레임(`C:\Users\User\AppData\Local\Temp\claude\...\scratchpad\frames\f_20.jpg` 등)과 숫자 크기·위치·제목 위치 비교, 어긋나면 `LAYOUT` 상수 조정

Expected: 위 5개 항목 모두 육안 확인.

- [ ] **Step 6: Commit**

```bash
git add src/remotion scripts/make-fixtures.mjs
git commit -m "feat: RankingVideo remotion composition with fixtures and studio verification"
```

---

### Task 5: CLI 렌더 스크립트 (엔진 검증)

**Files:**
- Create: `web/src/lib/renderer.ts`, `web/scripts/render.ts`, `web/scripts/fixture-project.json`

**Interfaces:**
- Consumes: 컴포지션 `'RankingVideo'`(Task 4), `RenderProject`(Task 2)
- Produces (Task 8이 재사용):
  - `getServeUrl(): Promise<string>` — bundle 1회 캐시(globalThis)
  - `renderProjectToFile(project: RenderProject, outputPath: string, onProgress: (p: number) => void): Promise<void>`

- [ ] **Step 1: renderer 구현**

`web/src/lib/renderer.ts`:
```ts
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { RenderProject } from '@/lib/project';

// dev 핫리로드에도 번들 캐시 유지
const g = globalThis as unknown as { __vibloBundle?: Promise<string> };

export function getServeUrl(): Promise<string> {
  g.__vibloBundle ??= bundle({
    entryPoint: path.join(process.cwd(), 'src', 'remotion', 'index.ts'),
    publicDir: path.join(process.cwd(), 'public'),
    webpackOverride: (c) => c,
  });
  return g.__vibloBundle;
}

export async function renderProjectToFile(
  project: RenderProject,
  outputPath: string,
  onProgress: (p: number) => void,
): Promise<void> {
  const serveUrl = await getServeUrl();
  const inputProps = { project };
  const composition = await selectComposition({ serveUrl, id: 'RankingVideo', inputProps });
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    timeoutInMilliseconds: 120_000, // 느린 소스 대비 delayRender 여유
    onProgress: ({ progress }) => onProgress(progress),
  });
}
```

`web/scripts/fixture-project.json` (static 소스 → 서버 없이 렌더 가능):
```json
{
  "title": {
    "text": "Ranking The Funniest\nBaby Reactions",
    "fontFamily": "archivo-black", "fontSizePx": 76,
    "bold": false, "italic": false, "align": "center",
    "color": "#FFFFFF", "strokeWidthPx": 4, "strokeColor": "#000000"
  },
  "general": { "videoHeightPct": 80, "backgroundColor": "#2B2A2A" },
  "ranksTotal": 3,
  "clips": [
    { "id": "fx-2", "rank": 2, "src": { "kind": "static", "path": "fixtures/clip-b.mp4" }, "trimStartSec": 0, "trimEndSec": 4, "volume": 1,
      "label": { "text": "Laugh", "fontSizePx": 52, "color": "#FFFFFF", "strokeWidthPx": 6, "strokeColor": "#000000" } },
    { "id": "fx-3", "rank": 3, "src": { "kind": "static", "path": "fixtures/clip-c.mp4" }, "trimStartSec": 0, "trimEndSec": 5, "volume": 1,
      "label": { "text": "Flower", "fontSizePx": 52, "color": "#FFFFFF", "strokeWidthPx": 6, "strokeColor": "#000000" } },
    { "id": "fx-1", "rank": 1, "src": { "kind": "static", "path": "fixtures/clip-a.mp4" }, "trimStartSec": 1, "trimEndSec": 4, "volume": 1,
      "label": { "text": "Medicine", "fontSizePx": 52, "color": "#FFFFFF", "strokeWidthPx": 6, "strokeColor": "#000000" } }
  ]
}
```

`web/scripts/render.ts`:
```ts
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { renderProjectToFile } from '../src/lib/renderer';
import type { RenderProject } from '../src/lib/project';

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('usage: tsx scripts/render.ts <render-project.json>');
  process.exit(1);
}
const project = JSON.parse(readFileSync(jsonPath, 'utf8')) as RenderProject;
mkdirSync('storage/renders', { recursive: true });
const out = path.join('storage', 'renders', 'cli-test.mp4');

renderProjectToFile(project, out, (p) => {
  process.stdout.write(`\rrendering ${(p * 100).toFixed(0)}%`);
}).then(() => console.log(`\ndone: ${out}`))
  .catch((e) => { console.error(e); process.exit(1); });
```

주의: `tsx`가 `@/` 별칭을 모르므로 `scripts/render.ts`는 **상대경로 import**를 사용한다(위 코드처럼). `src/lib/renderer.ts` 내부의 `@/lib/project`는 타입 전용 import라 런타임 영향 없음 — 만약 tsx 실행이 별칭 문제로 실패하면 `renderer.ts`의 import도 상대경로(`../lib/project` 등)로 바꾼다.

- [ ] **Step 2: 렌더 실행 (첫 실행은 Chrome Headless Shell 자동 다운로드로 수 분 소요)**

Run: `npm run render:cli`
Expected: `rendering 100%` 후 `done: storage\renders\cli-test.mp4`.

- [ ] **Step 3: 출력 검증 (ffprobe)**

Run:
```bash
ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height,r_frame_rate -of json storage/renders/cli-test.mp4
```
Expected: `h264` + `aac`, `1080×1920`, `30/1`, duration ≈ `12.0`(±0.2). 파일을 열어 육안 확인: Task 4 Step 5와 동일한 화면 + 톤 오디오(클립별 440/660/880Hz — 볼륨/트림이 오디오에도 적용됐는지 확인).

- [ ] **Step 4: Commit**

```bash
git add src/lib/renderer.ts scripts/render.ts scripts/fixture-project.json
git commit -m "feat: server-side render engine with CLI verification harness"
```

---

### Task 6: 미디어 저장 + ffprobe + Range 서빙 + 업로드 API

**Files:**
- Create: `web/src/lib/media.ts`, `web/src/lib/range.ts`, `web/src/lib/range.test.ts`, `web/src/lib/media.test.ts`, `web/src/app/api/media/[id]/route.ts`, `web/src/app/api/upload/route.ts`

**Interfaces:**
- Consumes: `MAX_UPLOAD_BYTES`(Task 2)
- Produces:
  - `media.ts`: `MEDIA_DIR`, `RENDERS_DIR`, `isUuid(s): boolean`, `mediaPath(id): string`, `rendersPath(name): string`, `ensureDirs(): Promise<void>`, `probeDurationSec(filePath): Promise<number>`, `saveUploadedFile(file: File): Promise<{ mediaId: string; durationSec: number }>`
  - `range.ts`: `parseRangeHeader(header: string | null, size: number): { start: number; end: number } | null | 'invalid'`
  - HTTP: `GET /api/media/:id`(206 Range 지원), `POST /api/upload`(multipart `file`) → `{ mediaId, durationSec }`

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/lib/range.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseRangeHeader } from '@/lib/range';

describe('parseRangeHeader', () => {
  it('null header → null (full body)', () => {
    expect(parseRangeHeader(null, 1000)).toBeNull();
  });
  it('bytes=0-499', () => {
    expect(parseRangeHeader('bytes=0-499', 1000)).toEqual({ start: 0, end: 499 });
  });
  it('open end bytes=500- → to EOF', () => {
    expect(parseRangeHeader('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
  });
  it('suffix bytes=-200 → last 200 bytes', () => {
    expect(parseRangeHeader('bytes=-200', 1000)).toEqual({ start: 800, end: 999 });
  });
  it('end clamped to size-1', () => {
    expect(parseRangeHeader('bytes=0-99999', 1000)).toEqual({ start: 0, end: 999 });
  });
  it('invalid: start beyond EOF / malformed / reversed', () => {
    expect(parseRangeHeader('bytes=1000-', 1000)).toBe('invalid');
    expect(parseRangeHeader('bytes=abc', 1000)).toBe('invalid');
    expect(parseRangeHeader('bytes=500-100', 1000)).toBe('invalid');
  });
});
```

`web/src/lib/media.test.ts` (ffprobe 통합 — Task 4 픽스처 사용):
```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { probeDurationSec, isUuid } from '@/lib/media';

describe('isUuid', () => {
  it('accepts uuid, rejects traversal', () => {
    expect(isUuid(crypto.randomUUID())).toBe(true);
    expect(isUuid('../../etc/passwd')).toBe(false);
    expect(isUuid('abc')).toBe(false);
  });
});

describe('probeDurationSec', () => {
  const fixture = path.join(process.cwd(), 'public', 'fixtures', 'clip-a.mp4');
  it.skipIf(!existsSync(fixture))('probes fixture duration ~6s', async () => {
    const d = await probeDurationSec(fixture);
    expect(d).toBeGreaterThan(5.5);
    expect(d).toBeLessThan(6.5);
  });
  it('throws on nonexistent file', async () => {
    await expect(probeDurationSec('C:/nope/missing.mp4')).rejects.toThrow();
  });
});
```
Run: `npm test` → Expected: FAIL (모듈 없음).

- [ ] **Step 2: 구현**

`web/src/lib/range.ts`:
```ts
export function parseRangeHeader(
  header: string | null,
  size: number,
): { start: number; end: number } | null | 'invalid' {
  if (header === null) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return 'invalid';
  const [, rawStart, rawEnd] = m;
  if (rawStart === '' && rawEnd === '') return 'invalid';

  if (rawStart === '') {
    // suffix: bytes=-N (마지막 N바이트)
    const suffix = Number(rawEnd);
    if (suffix <= 0) return 'invalid';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(rawStart);
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}
```

`web/src/lib/media.ts`:
```ts
import { execa } from 'execa';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MAX_UPLOAD_BYTES } from '@/lib/project';

export const MEDIA_DIR = path.join(process.cwd(), 'storage', 'media');
export const RENDERS_DIR = path.join(process.cwd(), 'storage', 'renders');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string): boolean => UUID.test(s);

export const mediaPath = (id: string): string => path.join(MEDIA_DIR, `${id}.mp4`);
export const rendersPath = (name: string): string => path.join(RENDERS_DIR, name);

export async function ensureDirs(): Promise<void> {
  await mkdir(MEDIA_DIR, { recursive: true });
  await mkdir(RENDERS_DIR, { recursive: true });
}

const FFPROBE = () => process.env.FFPROBE_PATH || 'ffprobe';

export async function probeDurationSec(filePath: string): Promise<number> {
  const { stdout } = await execa(
    FFPROBE(),
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', filePath],
    { timeout: 30_000 },
  );
  const duration = Number(JSON.parse(stdout)?.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`영상 길이를 읽을 수 없습니다: ${filePath}`);
  }
  return duration;
}

export async function saveUploadedFile(file: File): Promise<{ mediaId: string; durationSec: number }> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('파일이 500MB를 초과합니다.');
  const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
  if (!isMp4) throw new Error('MP4 파일만 업로드할 수 있습니다.');

  await ensureDirs();
  const mediaId = crypto.randomUUID();
  const dest = mediaPath(mediaId);
  await writeFile(dest, Buffer.from(await file.arrayBuffer()));
  const durationSec = await probeDurationSec(dest); // 손상 파일이면 여기서 throw
  return { mediaId, durationSec };
}
```

`web/src/app/api/media/[id]/route.ts`:
```ts
import { createReadStream, statSync, existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { NextRequest } from 'next/server';
import { isUuid, mediaPath } from '@/lib/media';
import { parseRangeHeader } from '@/lib/range';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return Response.json({ error: 'invalid id' }, { status: 400 });

  const filePath = mediaPath(id);
  if (!existsSync(filePath)) return Response.json({ error: 'not found' }, { status: 404 });
  const { size } = statSync(filePath);

  const range = parseRangeHeader(req.headers.get('range'), size);
  if (range === 'invalid') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }

  const common = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' };
  if (range === null) {
    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    return new Response(stream, { status: 200, headers: { ...common, 'Content-Length': String(size) } });
  }
  const { start, end } = range;
  const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
  return new Response(stream, {
    status: 206,
    headers: {
      ...common,
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
    },
  });
}
```

`web/src/app/api/upload/route.ts`:
```ts
import { NextRequest } from 'next/server';
import { saveUploadedFile } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'file 필드가 필요합니다.' }, { status: 400 });
    }
    const result = await saveUploadedFile(file);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : '업로드 실패' }, { status: 400 });
  }
}
```

- [ ] **Step 3: 테스트 통과 확인**

Run: `npm test` → Expected: range/media 테스트 전부 PASS.

- [ ] **Step 4: HTTP 수동 검증**

`npm run dev` 실행 상태에서 (PowerShell):
```powershell
# 픽스처를 업로드해 mediaId 획득
curl.exe -s -F "file=@public/fixtures/clip-a.mp4;type=video/mp4" http://localhost:3000/api/upload
# → {"mediaId":"<UUID>","durationSec":6.0...}

curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/api/media/<UUID>            # 200
curl.exe -s -o NUL -w "%{http_code}" -H "Range: bytes=0-99" http://localhost:3000/api/media/<UUID>  # 206
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/api/media/not-a-uuid        # 400
```
Expected: 순서대로 JSON/200… 아니라 `200`, `206`, `400`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/media.ts src/lib/range.ts src/lib/range.test.ts src/lib/media.test.ts src/app/api/media src/app/api/upload
git commit -m "feat: media storage, ffprobe, range-serving and upload API"
```

---

### Task 7: yt-dlp 인제스트 (다운로드 + 에러 분류 + 폴백)

**Files:**
- Create: `web/src/lib/ytdlp.ts`, `web/src/lib/ytdlp.test.ts`, `web/src/app/api/ingest/route.ts`

**Interfaces:**
- Consumes: `MEDIA_DIR`, `mediaPath`, `probeDurationSec`, `ensureDirs`(Task 6)
- Produces:
  - `type IngestErrorType = 'private' | 'unavailable' | 'geo_blocked' | 'rate_limited' | 'unsupported_url' | 'not_found' | 'network' | 'timeout' | 'unknown'`
  - `classifyYtDlpError(message: string): IngestErrorType`
  - `INGEST_MESSAGES_KO: Record<IngestErrorType, string>`
  - `isAllowedVideoUrl(url: string): boolean`
  - `class IngestError extends Error { type: IngestErrorType }`
  - `downloadFromUrl(url: string): Promise<{ mediaId: string; durationSec: number }>` — 타임아웃 180s, network/timeout/rate_limited 1회 재시도, mp4 아니면 remux
  - HTTP: `POST /api/ingest` body `{ url }` → 200 `{ mediaId, durationSec }` | 4xx/5xx `{ errorType, message }`

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/lib/ytdlp.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { classifyYtDlpError, isAllowedVideoUrl, INGEST_MESSAGES_KO } from '@/lib/ytdlp';

describe('classifyYtDlpError', () => {
  const cases: [string, string][] = [
    ['ERROR: [TikTok] 123: Private video. Log in', 'private'],
    ['ERROR: [youtube] abc: Video unavailable', 'unavailable'],
    ['This video has been removed', 'unavailable'],
    ['ERROR: The uploader has not made this video available in your country', 'geo_blocked'],
    ['HTTP Error 429: Too Many Requests', 'rate_limited'],
    ['ERROR: Unsupported URL: https://example.com', 'unsupported_url'],
    ['HTTP Error 404: Not Found', 'not_found'],
    ['getaddrinfo ENOTFOUND www.tiktok.com', 'network'],
    ['Command timed out after 180000 milliseconds', 'timeout'],
    ['???', 'unknown'],
  ];
  for (const [msg, expected] of cases) {
    it(`"${msg.slice(0, 40)}..." → ${expected}`, () => {
      expect(classifyYtDlpError(msg)).toBe(expected);
    });
  }
  it('every type has a Korean message', () => {
    for (const t of ['private','unavailable','geo_blocked','rate_limited','unsupported_url','not_found','network','timeout','unknown'] as const) {
      expect(INGEST_MESSAGES_KO[t].length).toBeGreaterThan(0);
    }
  });
});

describe('isAllowedVideoUrl', () => {
  it('accepts tiktok/instagram/youtube variants', () => {
    for (const u of [
      'https://www.tiktok.com/@user/video/123',
      'https://vm.tiktok.com/ZS123/',
      'https://www.instagram.com/reel/abc/',
      'https://www.youtube.com/shorts/abc',
      'https://youtu.be/abc',
    ]) expect(isAllowedVideoUrl(u)).toBe(true);
  });
  it('rejects other hosts and non-urls', () => {
    expect(isAllowedVideoUrl('https://evil.com/watch')).toBe(false);
    expect(isAllowedVideoUrl('https://nottiktok.com/x')).toBe(false);
    expect(isAllowedVideoUrl('notaurl')).toBe(false);
  });
});
```
Run: `npm test` → Expected: FAIL.

- [ ] **Step 2: 구현**

`web/src/lib/ytdlp.ts`:
```ts
import { execa } from 'execa';
import { readdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { MEDIA_DIR, ensureDirs, mediaPath, probeDurationSec } from '@/lib/media';

export type IngestErrorType =
  | 'private' | 'unavailable' | 'geo_blocked' | 'rate_limited'
  | 'unsupported_url' | 'not_found' | 'network' | 'timeout' | 'unknown';

export const INGEST_MESSAGES_KO: Record<IngestErrorType, string> = {
  private: '비공개 영상이라 가져올 수 없습니다.',
  unavailable: '삭제되었거나 볼 수 없는 영상입니다.',
  geo_blocked: '지역 제한으로 가져올 수 없는 영상입니다.',
  rate_limited: '요청이 너무 많아 잠시 차단되었습니다. 잠시 후 다시 시도해 주세요.',
  unsupported_url: '지원하지 않는 URL입니다. TikTok/Instagram/YouTube 링크를 사용해 주세요.',
  not_found: '영상을 찾을 수 없습니다. URL을 확인해 주세요.',
  network: '네트워크 오류로 다운로드에 실패했습니다.',
  timeout: '다운로드 시간이 초과되었습니다.',
  unknown: '알 수 없는 오류로 다운로드에 실패했습니다.',
};

export function classifyYtDlpError(message: string): IngestErrorType {
  const m = message.toLowerCase();
  if (/private video|login required|log in/.test(m)) return 'private';
  if (/unavailable|has been removed|isn'?t available|deleted/.test(m)) return 'unavailable';
  if (/not available in your country|geo.?(restrict|block)/.test(m)) return 'geo_blocked';
  if (/429|rate.?limit|too many requests/.test(m)) return 'rate_limited';
  if (/unsupported url/.test(m)) return 'unsupported_url';
  if (/404|not found(?!\S)/.test(m)) return 'not_found';
  if (/timed? ?out/.test(m)) return 'timeout';
  if (/network|getaddrinfo|enotfound|econnreset|etimedout|eai_again|unable to download/.test(m)) return 'network';
  return 'unknown';
}

export class IngestError extends Error {
  constructor(public type: IngestErrorType, message?: string) {
    super(message ?? INGEST_MESSAGES_KO[type]);
  }
}

const ALLOWED_DOMAINS = ['tiktok.com', 'instagram.com', 'youtube.com'];
export function isAllowedVideoUrl(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const h = u.hostname.toLowerCase();
  if (h === 'youtu.be') return true;
  return ALLOWED_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
}

const YTDLP = () => process.env.YT_DLP_PATH || 'yt-dlp';
const DOWNLOAD_TIMEOUT_MS = 180_000;
const RETRYABLE: IngestErrorType[] = ['network', 'timeout', 'rate_limited'];

async function findDownloaded(mediaId: string): Promise<string> {
  const files = (await readdir(MEDIA_DIR)).filter((f) => f.startsWith(mediaId));
  if (files.length === 0) throw new IngestError('unknown', '다운로드된 파일을 찾을 수 없습니다.');
  return path.join(MEDIA_DIR, files[0]);
}

async function remuxToMp4(src: string, dest: string): Promise<void> {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  try {
    await execa(ffmpeg, ['-y', '-i', src, '-c', 'copy', dest], { timeout: 120_000 });
  } catch {
    // 스트림 복사가 안 되는 컨테이너면 재인코딩(느리지만 확실)
    await execa(ffmpeg, ['-y', '-i', src, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', dest], { timeout: 600_000 });
  }
  await unlink(src);
}

async function attemptDownload(url: string, mediaId: string): Promise<void> {
  const outTemplate = path.join(MEDIA_DIR, `${mediaId}.%(ext)s`);
  try {
    await execa(YTDLP(), [
      '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b',
      '--merge-output-format', 'mp4',
      '--no-playlist', '--no-progress',
      '-o', outTemplate,
      url,
    ], { timeout: DOWNLOAD_TIMEOUT_MS });
  } catch (e) {
    const raw = e instanceof Error ? `${e.message}\n${(e as { stderr?: string }).stderr ?? ''}` : String(e);
    throw new IngestError(classifyYtDlpError(raw), undefined);
  }
  const produced = await findDownloaded(mediaId);
  if (!produced.endsWith('.mp4')) {
    await remuxToMp4(produced, mediaPath(mediaId));
  }
}

export async function downloadFromUrl(url: string): Promise<{ mediaId: string; durationSec: number }> {
  if (!isAllowedVideoUrl(url)) throw new IngestError('unsupported_url');
  await ensureDirs();
  const mediaId = crypto.randomUUID();

  try {
    await attemptDownload(url, mediaId);
  } catch (e) {
    const type = e instanceof IngestError ? e.type : 'unknown';
    if (!RETRYABLE.includes(type)) throw e;
    await new Promise((r) => setTimeout(r, type === 'rate_limited' ? 5_000 : 1_500));
    await attemptDownload(url, mediaId); // 재시도 1회, 또 실패하면 그대로 throw
  }

  const durationSec = await probeDurationSec(mediaPath(mediaId));
  return { mediaId, durationSec };
}
```

`web/src/app/api/ingest/route.ts`:
```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { IngestError, downloadFromUrl, INGEST_MESSAGES_KO } from '@/lib/ytdlp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

const Body = z.object({ url: z.string().min(1).max(2000) });

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { body = null; }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return Response.json({ errorType: 'unsupported_url', message: 'URL을 입력해 주세요.' }, { status: 400 });
  }
  try {
    const result = await downloadFromUrl(parsed.data.url.trim());
    return Response.json(result);
  } catch (e) {
    if (e instanceof IngestError) {
      const status = e.type === 'unsupported_url' || e.type === 'not_found' ? 400 : 502;
      return Response.json({ errorType: e.type, message: e.message }, { status });
    }
    return Response.json({ errorType: 'unknown', message: INGEST_MESSAGES_KO.unknown }, { status: 500 });
  }
}
```

- [ ] **Step 3: 테스트 통과 확인**

Run: `npm test` → Expected: ytdlp 분류/URL 테스트 전부 PASS.

- [ ] **Step 4: yt-dlp 설치 + 실통합 수동 검증**

```powershell
winget install yt-dlp.yt-dlp --accept-source-agreements --accept-package-agreements
yt-dlp --version   # 새 셸 필요할 수 있음
```
`npm run dev` 상태에서:
```powershell
curl.exe -s -X POST http://localhost:3000/api/ingest -H "Content-Type: application/json" -d "{\"url\":\"https://www.youtube.com/shorts/aqz-KE-bpKQ\"}"
```
Expected: `{"mediaId":"<uuid>","durationSec":<number>}` (안정적인 공개 YouTube 영상으로 검증; 실제 TikTok URL은 사용자가 최종 E2E에서 확인). 실패 URL 케이스:
```powershell
curl.exe -s -X POST http://localhost:3000/api/ingest -H "Content-Type: application/json" -d "{\"url\":\"https://example.com/x\"}"
```
Expected: `{"errorType":"unsupported_url",...}` + HTTP 400.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ytdlp.ts src/lib/ytdlp.test.ts src/app/api/ingest
git commit -m "feat: yt-dlp ingest with typed error classification and retry"
```

---

### Task 8: 렌더 잡 API (백그라운드 잡 + 폴링 + 다운로드)

**Files:**
- Create: `web/src/lib/jobs.ts`, `web/src/lib/jobs.test.ts`, `web/src/app/api/render/route.ts`, `web/src/app/api/render/[jobId]/route.ts`, `web/src/app/api/render/[jobId]/download/route.ts`

**Interfaces:**
- Consumes: `buildRenderProject`, `ProjectSchema`(Task 2), `renderProjectToFile`, `getServeUrl`(Task 5), `rendersPath`, `ensureDirs`, `isUuid`(Task 6)
- Produces:
  - `jobs.ts`: `type JobStatus = 'queued' | 'bundling' | 'rendering' | 'done' | 'error'`, `interface RenderJob { id: string; status: JobStatus; progress: number; outputPath: string | null; error: string | null; createdAt: number }`, `createJob(): RenderJob`, `getJob(id): RenderJob | undefined`, `updateJob(id, patch: Partial<RenderJob>): void`
  - HTTP: `POST /api/render` body=`Project` → 200 `{ jobId }` | 400 `{ problems: string[] }`; `GET /api/render/:jobId` → `{ status, progress, error }`; `GET /api/render/:jobId/download` → mp4 attachment

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/lib/jobs.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createJob, getJob, updateJob } from '@/lib/jobs';

describe('job registry', () => {
  it('creates queued job with uuid and finds it', () => {
    const job = createJob();
    expect(job.status).toBe('queued');
    expect(job.progress).toBe(0);
    expect(getJob(job.id)?.id).toBe(job.id);
  });
  it('updates status and progress', () => {
    const job = createJob();
    updateJob(job.id, { status: 'rendering', progress: 0.5 });
    expect(getJob(job.id)).toMatchObject({ status: 'rendering', progress: 0.5 });
  });
  it('returns undefined for unknown id', () => {
    expect(getJob('nope')).toBeUndefined();
  });
});
```
Run: `npm test` → Expected: FAIL.

- [ ] **Step 2: 구현**

`web/src/lib/jobs.ts`:
```ts
export type JobStatus = 'queued' | 'bundling' | 'rendering' | 'done' | 'error';

export interface RenderJob {
  id: string;
  status: JobStatus;
  progress: number; // 0..1
  outputPath: string | null;
  error: string | null;
  createdAt: number;
}

// dev 핫리로드/모듈 재평가에도 잡 유지
const g = globalThis as unknown as { __vibloJobs?: Map<string, RenderJob> };
const jobs = (g.__vibloJobs ??= new Map<string, RenderJob>());

export function createJob(): RenderJob {
  const job: RenderJob = {
    id: crypto.randomUUID(), status: 'queued', progress: 0,
    outputPath: null, error: null, createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<RenderJob>): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, patch);
}
```

`web/src/app/api/render/route.ts`:
```ts
import { NextRequest } from 'next/server';
import { ProjectSchema, buildRenderProject, type ResolvedSrc } from '@/lib/project';
import { createJob, updateJob } from '@/lib/jobs';
import { ensureDirs, rendersPath } from '@/lib/media';
import { getServeUrl, renderProjectToFile } from '@/lib/renderer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function origin(): string {
  return process.env.APP_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3000}`;
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try { raw = await req.json(); } catch { raw = null; }
  const parsed = ProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ problems: ['프로젝트 데이터가 올바르지 않습니다.'] }, { status: 400 });
  }

  const resolveSrc = (mediaId: string): ResolvedSrc =>
    ({ kind: 'url', url: `${origin()}/api/media/${mediaId}` });
  const built = buildRenderProject(parsed.data, resolveSrc);
  if (!built.ok) return Response.json({ problems: built.problems }, { status: 400 });

  await ensureDirs();
  const job = createJob();
  const outputPath = rendersPath(`${job.id}.mp4`);

  // 백그라운드 실행 — 응답을 붙잡지 않는다
  void (async () => {
    try {
      updateJob(job.id, { status: 'bundling' });
      await getServeUrl();
      updateJob(job.id, { status: 'rendering' });
      await renderProjectToFile(built.value, outputPath, (p) => updateJob(job.id, { progress: p }));
      updateJob(job.id, { status: 'done', progress: 1, outputPath });
    } catch (e) {
      updateJob(job.id, { status: 'error', error: e instanceof Error ? e.message : '렌더링 실패' });
    }
  })();

  return Response.json({ jobId: job.id });
}
```

`web/src/app/api/render/[jobId]/route.ts`:
```ts
import { getJob } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);
  if (!job) return Response.json({ error: 'job not found' }, { status: 404 });
  return Response.json({ status: job.status, progress: job.progress, error: job.error });
}
```

`web/src/app/api/render/[jobId]/download/route.ts`:
```ts
import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { getJob } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);
  if (!job || job.status !== 'done' || !job.outputPath || !existsSync(job.outputPath)) {
    return Response.json({ error: '완료된 렌더가 없습니다.' }, { status: 404 });
  }
  const { size } = statSync(job.outputPath);
  const stream = Readable.toWeb(createReadStream(job.outputPath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(size),
      'Content-Disposition': 'attachment; filename="video-ranking.mp4"',
    },
  });
}
```

- [ ] **Step 3: 테스트 통과 확인**

Run: `npm test` → Expected: jobs 테스트 PASS.

- [ ] **Step 4: 풀 사이클 수동 검증 (업로드→렌더→다운로드)**

`npm run dev` 상태에서 (PowerShell). 먼저 클립 2개 업로드해 mediaId 2개 확보:
```powershell
curl.exe -s -F "file=@public/fixtures/clip-a.mp4;type=video/mp4" http://localhost:3000/api/upload
curl.exe -s -F "file=@public/fixtures/clip-b.mp4;type=video/mp4" http://localhost:3000/api/upload
```
`scratch-render.json` 임시 파일 작성(두 UUID 대입):
```json
{
  "title": { "text": "Test", "fontFamily": "archivo-black", "fontSizePx": 76, "bold": false, "italic": false, "align": "center", "color": "#FFFFFF", "strokeWidthPx": 4, "strokeColor": "#000000" },
  "general": { "videoHeightPct": 80, "backgroundColor": "#2B2A2A" },
  "customOrder": null,
  "clips": [
    { "id": "c1", "source": { "type": "upload", "mediaId": "<UUID-A>" }, "durationSec": 6, "trim": { "startSec": 0, "endSec": 3 }, "volume": 1, "label": { "text": "One", "fontSizePx": 52, "color": "#FFFFFF", "strokeWidthPx": 6, "strokeColor": "#000000" } },
    { "id": "c2", "source": { "type": "upload", "mediaId": "<UUID-B>" }, "durationSec": 8, "trim": { "startSec": 0, "endSec": 3 }, "volume": 1, "label": { "text": "Two", "fontSizePx": 52, "color": "#FFFFFF", "strokeWidthPx": 6, "strokeColor": "#000000" } }
  ]
}
```
```powershell
curl.exe -s -X POST http://localhost:3000/api/render -H "Content-Type: application/json" -d "@scratch-render.json"
# → {"jobId":"<JOB>"} ; 반복 폴링:
curl.exe -s http://localhost:3000/api/render/<JOB>
# status: bundling → rendering(progress 증가) → done
curl.exe -s -o final.mp4 http://localhost:3000/api/render/<JOB>/download
ffprobe -v error -show_entries format=duration -of json final.mp4   # ≈ 6.0
```
검증 후 `scratch-render.json`, `final.mp4` 삭제. 빈 clips로 POST하면 400 + `problems` 배열 확인.

- [ ] **Step 5: Commit**

```bash
git add src/lib/jobs.ts src/lib/jobs.test.ts src/app/api/render
git commit -m "feat: background render job API with progress polling and download"
```

---

### Task 9: 에디터 스토어 (zustand, 동기 변이 전용)

**Files:**
- Create: `web/src/store/editor.ts`, `web/src/store/editor.test.ts`

**Interfaces:**
- Consumes: Task 2 타입/팩토리
- Produces (모든 UI 컴포넌트가 사용):
  - `useEditorStore` (zustand hook; 테스트에선 `useEditorStore.getState()`로 직접 호출)
  - 상태: `project: Project`, `ingest: Record<string, IngestUiState>` (`IngestUiState = { state: 'idle' | 'loading' | 'error'; message?: string }`)
  - 액션(전부 동기): `setTitle(patch: Partial<TitleStyle>)`, `setGeneral(patch: Partial<Project['general']>)`, `addClip()`, `removeClip(id)`, `moveClip(id, dir: -1 | 1)`, `setClipUrl(id, url)`, `attachMedia(id, info: { mediaId: string; durationSec: number; via: 'url' | 'upload' })`, `setTrim(id, trim: { startSec: number; endSec: number })`, `setVolume(id, v)`, `setLabel(id, patch: Partial<LabelStyle>)`, `setCustomOrderEnabled(on: boolean)`, `setCustomOrder(ids: string[])`, `setIngestState(id, s: IngestUiState)`, `resetEditor()`
  - fetch는 스토어에 두지 않는다(컴포넌트에서 수행) — 스토어는 100% 단위테스트 가능

- [ ] **Step 1: 실패하는 테스트 작성**

`web/src/store/editor.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '@/store/editor';

const S = () => useEditorStore.getState();

beforeEach(() => S().resetEditor());

describe('clip management', () => {
  it('addClip appends, removeClip deletes and prunes customOrder', () => {
    S().addClip();
    expect(S().project.clips.length).toBe(2);
    const [a, b] = S().project.clips;
    S().setCustomOrderEnabled(true);
    expect(S().project.customOrder).toEqual([a.id, b.id]);
    S().removeClip(a.id);
    expect(S().project.clips.map((c) => c.id)).toEqual([b.id]);
    expect(S().project.customOrder).toEqual([b.id]);
  });
  it('moveClip swaps rank order and clamps at edges', () => {
    S().addClip();
    const [a, b] = S().project.clips;
    S().moveClip(b.id, -1);
    expect(S().project.clips.map((c) => c.id)).toEqual([b.id, a.id]);
    S().moveClip(b.id, -1); // 맨 위에서 위로 → 변화 없음
    expect(S().project.clips[0].id).toBe(b.id);
  });
});

describe('media attach & trim', () => {
  it('attachMedia sets source/duration and full-range trim', () => {
    const clip = S().project.clips[0];
    S().attachMedia(clip.id, { mediaId: crypto.randomUUID(), durationSec: 30, via: 'url' });
    const c = S().project.clips[0];
    expect(c.durationSec).toBe(30);
    expect(c.trim).toEqual({ startSec: 0, endSec: 30 });
  });
  it('setTrim clamps into [0, duration] and start<end', () => {
    const clip = S().project.clips[0];
    S().attachMedia(clip.id, { mediaId: crypto.randomUUID(), durationSec: 10, via: 'upload' });
    S().setTrim(clip.id, { startSec: -5, endSec: 99 });
    expect(S().project.clips[0].trim).toEqual({ startSec: 0, endSec: 10 });
  });
});

describe('custom order', () => {
  it('disable resets to null', () => {
    S().setCustomOrderEnabled(true);
    S().setCustomOrderEnabled(false);
    expect(S().project.customOrder).toBeNull();
  });
});

describe('title & label', () => {
  it('patches title and label partially', () => {
    S().setTitle({ text: 'Hello\nWorld', color: '#FF0000' });
    expect(S().project.title.text).toBe('Hello\nWorld');
    const id = S().project.clips[0].id;
    S().setLabel(id, { text: 'Laugh' });
    expect(S().project.clips[0].label.text).toBe('Laugh');
  });
});
```
Run: `npm test` → Expected: FAIL.

- [ ] **Step 2: 구현**

`web/src/store/editor.ts`:
```ts
'use client';

import { create } from 'zustand';
import {
  defaultProject, newClip,
  type LabelStyle, type Project, type TitleStyle,
} from '@/lib/project';

export interface IngestUiState { state: 'idle' | 'loading' | 'error'; message?: string }

interface EditorState {
  project: Project;
  ingest: Record<string, IngestUiState>;
  setTitle: (patch: Partial<TitleStyle>) => void;
  setGeneral: (patch: Partial<Project['general']>) => void;
  addClip: () => void;
  removeClip: (id: string) => void;
  moveClip: (id: string, dir: -1 | 1) => void;
  setClipUrl: (id: string, url: string) => void;
  attachMedia: (id: string, info: { mediaId: string; durationSec: number; via: 'url' | 'upload' }) => void;
  setTrim: (id: string, trim: { startSec: number; endSec: number }) => void;
  setVolume: (id: string, v: number) => void;
  setLabel: (id: string, patch: Partial<LabelStyle>) => void;
  setCustomOrderEnabled: (on: boolean) => void;
  setCustomOrder: (ids: string[]) => void;
  setIngestState: (id: string, s: IngestUiState) => void;
  resetEditor: () => void;
}

function updateClip(project: Project, id: string, fn: (c: Project['clips'][number]) => void): Project {
  return {
    ...project,
    clips: project.clips.map((c) => {
      if (c.id !== id) return c;
      const copy = structuredClone(c);
      fn(copy);
      return copy;
    }),
  };
}

export const useEditorStore = create<EditorState>((set) => ({
  project: defaultProject(),
  ingest: {},

  setTitle: (patch) => set((s) => ({ project: { ...s.project, title: { ...s.project.title, ...patch } } })),
  setGeneral: (patch) => set((s) => ({ project: { ...s.project, general: { ...s.project.general, ...patch } } })),

  addClip: () => set((s) => {
    const clip = newClip();
    const customOrder = s.project.customOrder ? [...s.project.customOrder, clip.id] : null;
    return { project: { ...s.project, clips: [...s.project.clips, clip], customOrder } };
  }),

  removeClip: (id) => set((s) => ({
    project: {
      ...s.project,
      clips: s.project.clips.filter((c) => c.id !== id),
      customOrder: s.project.customOrder?.filter((x) => x !== id) ?? null,
    },
  })),

  moveClip: (id, dir) => set((s) => {
    const i = s.project.clips.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= s.project.clips.length) return s;
    const clips = [...s.project.clips];
    [clips[i], clips[j]] = [clips[j], clips[i]];
    return { project: { ...s.project, clips } };
  }),

  setClipUrl: (id, url) => set((s) => ({
    project: updateClip(s.project, id, (c) => { c.source = { type: 'url', url, mediaId: null }; }),
  })),

  attachMedia: (id, { mediaId, durationSec, via }) => set((s) => ({
    project: updateClip(s.project, id, (c) => {
      c.source = via === 'upload'
        ? { type: 'upload', mediaId }
        : { type: 'url', url: c.source?.type === 'url' ? c.source.url : '', mediaId };
      c.durationSec = durationSec;
      c.trim = { startSec: 0, endSec: durationSec };
    }),
  })),

  setTrim: (id, trim) => set((s) => ({
    project: updateClip(s.project, id, (c) => {
      const dur = c.durationSec ?? trim.endSec;
      const startSec = Math.max(0, Math.min(trim.startSec, dur));
      const endSec = Math.max(startSec, Math.min(trim.endSec, dur));
      c.trim = { startSec, endSec };
    }),
  })),

  setVolume: (id, v) => set((s) => ({
    project: updateClip(s.project, id, (c) => { c.volume = Math.max(0, Math.min(1, v)); }),
  })),

  setLabel: (id, patch) => set((s) => ({
    project: updateClip(s.project, id, (c) => { c.label = { ...c.label, ...patch }; }),
  })),

  setCustomOrderEnabled: (on) => set((s) => ({
    project: { ...s.project, customOrder: on ? s.project.clips.map((c) => c.id) : null },
  })),

  setCustomOrder: (ids) => set((s) => ({ project: { ...s.project, customOrder: ids } })),

  setIngestState: (id, st) => set((s) => ({ ingest: { ...s.ingest, [id]: st } })),

  resetEditor: () => set({ project: defaultProject(), ingest: {} }),
}));
```

- [ ] **Step 3: 통과 확인**

Run: `npm test` → Expected: editor 스토어 테스트 전부 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/store/editor.ts src/store/editor.test.ts
git commit -m "feat: editor zustand store with fully unit-tested sync mutations"
```

---

### Task 10: UI — 제목 편집기 + General 설정 + 컬러 팝오버

**Files:**
- Create: `web/src/components/ColorPopover.tsx`, `web/src/components/TitleEditor.tsx`, `web/src/components/GeneralSettings.tsx`
- Modify: `web/src/app/page.tsx`(임시 조립), `web/src/app/globals.css`(기본 배경 정리 필요시)

**Interfaces:**
- Consumes: `useEditorStore`(Task 9)
- Produces: `<ColorPopover value onChange/>`(이후 태스크 재사용), `<TitleEditor/>`, `<GeneralSettings/>`

- [ ] **Step 1: 구현**

`web/src/components/ColorPopover.tsx`:
```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';

export function ColorPopover({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="색상 선택"
        className="h-8 w-8 rounded-full border border-gray-300"
        style={{ backgroundColor: value }}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="absolute z-20 mt-2 rounded-lg bg-white p-3 shadow-xl">
          <HexColorPicker color={value} onChange={(c) => onChange(c.toUpperCase())} />
          <div className="mt-2 text-center font-mono text-xs">{value}</div>
        </div>
      )}
    </div>
  );
}
```

`web/src/components/TitleEditor.tsx`:
```tsx
'use client';

import { useEditorStore } from '@/store/editor';
import { ColorPopover } from '@/components/ColorPopover';
import type { Align, FontFamilyId } from '@/lib/project';

export function TitleEditor() {
  const title = useEditorStore((s) => s.project.title);
  const setTitle = useEditorStore((s) => s.setTitle);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">Video Ranking Title</h2>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          className="rounded border px-2 py-1"
          value={title.fontFamily}
          onChange={(e) => setTitle({ fontFamily: e.target.value as FontFamilyId })}
        >
          <option value="archivo-black">Archivo Black</option>
          <option value="rubik">Rubik</option>
        </select>
        <input
          type="number" min={20} max={200}
          className="w-20 rounded border px-2 py-1"
          value={title.fontSizePx}
          onChange={(e) => setTitle({ fontSizePx: Number(e.target.value) })}
        />
        <button type="button" onClick={() => setTitle({ bold: !title.bold })}
          className={`rounded border px-3 py-1 font-bold ${title.bold ? 'bg-black text-white' : ''}`}>B</button>
        <button type="button" onClick={() => setTitle({ italic: !title.italic })}
          className={`rounded border px-3 py-1 italic ${title.italic ? 'bg-black text-white' : ''}`}>I</button>
        {(['left', 'center', 'right'] as Align[]).map((a) => (
          <button key={a} type="button" onClick={() => setTitle({ align: a })}
            className={`rounded border px-2 py-1 text-xs ${title.align === a ? 'bg-black text-white' : ''}`}>
            {a === 'left' ? '⟸' : a === 'center' ? '≡' : '⟹'}
          </button>
        ))}
        <ColorPopover value={title.color} onChange={(color) => setTitle({ color })} />
      </div>
      <textarea
        rows={2}
        placeholder={'Enter ranking title...\n(줄바꿈 가능, 이모지는 Win+. 로 입력)'}
        className="w-full rounded-lg bg-gray-100 p-3 text-xl font-bold"
        value={title.text}
        onChange={(e) => setTitle({ text: e.target.value })}
      />
      <div className="mt-3 flex items-center gap-3">
        <span className="text-sm text-gray-500">Title Stroke</span>
        <ColorPopover value={title.strokeColor} onChange={(strokeColor) => setTitle({ strokeColor })} />
        <input
          type="range" min={0} max={20} step={1}
          value={title.strokeWidthPx}
          onChange={(e) => setTitle({ strokeWidthPx: Number(e.target.value) })}
        />
        <span className="w-8 text-sm">{title.strokeWidthPx}px</span>
      </div>
    </section>
  );
}
```

`web/src/components/GeneralSettings.tsx`:
```tsx
'use client';

import { useEditorStore } from '@/store/editor';
import { ColorPopover } from '@/components/ColorPopover';

export function GeneralSettings() {
  const general = useEditorStore((s) => s.project.general);
  const setGeneral = useEditorStore((s) => s.setGeneral);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">General Setting</h2>
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          Video height
          <input
            type="number" min={50} max={100}
            className="w-20 rounded border px-2 py-1"
            value={general.videoHeightPct}
            onChange={(e) => setGeneral({ videoHeightPct: Number(e.target.value) })}
          />
          %
        </label>
        <label className="flex items-center gap-2 text-sm">
          Background
          <ColorPopover value={general.backgroundColor} onChange={(backgroundColor) => setGeneral({ backgroundColor })} />
          <span className="font-mono text-xs">{general.backgroundColor}</span>
        </label>
      </div>
    </section>
  );
}
```

`web/src/app/page.tsx` 전체 교체(임시 조립 — 이후 태스크에서 확장):
```tsx
import { TitleEditor } from '@/components/TitleEditor';
import { GeneralSettings } from '@/components/GeneralSettings';

export default function Home() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 bg-gray-50 p-6">
      <TitleEditor />
      <GeneralSettings />
    </main>
  );
}
```

- [ ] **Step 2: 브라우저 수동 검증**

Run: `npm run dev` → http://localhost:3000 에서:
1. 제목 textarea에 두 줄 입력(Enter) → 값 유지
2. B/I/정렬 토글 시 버튼 활성 표시
3. 색상 원 클릭 → 픽커 팝업 → 색 선택 → 원 색 변경, 바깥 클릭 시 닫힘
4. stroke 슬라이더 0~20 동작, Video height 숫자 입력, Background 색 변경
Expected: 콘솔 에러 0건.

- [ ] **Step 3: Commit**

```bash
git add src/components/ColorPopover.tsx src/components/TitleEditor.tsx src/components/GeneralSettings.tsx src/app/page.tsx
git commit -m "feat: title editor and general settings UI"
```

---

### Task 11: UI — 클립 카드 (URL 인제스트 / 업로드 / 트림 / 볼륨 / 라벨)

**Files:**
- Create: `web/src/components/TrimSlider.tsx`, `web/src/components/ClipCard.tsx`
- Modify: `web/src/app/page.tsx`, `web/src/app/globals.css`(듀얼 슬라이더 CSS)

**Interfaces:**
- Consumes: 스토어 액션(Task 9), `POST /api/ingest`(Task 7), `POST /api/upload`(Task 6), `INGEST_MESSAGES_KO` 메시지는 서버 응답 `message` 사용
- Produces: `<ClipCard clipId index count/>`, `<TrimSlider durationSec value onChange/>`

- [ ] **Step 1: 듀얼 트림 슬라이더 구현**

`web/src/app/globals.css` 하단에 추가:
```css
/* 듀얼 레인지 슬라이더: 두 input을 겹치고 썸만 이벤트를 받게 함 */
.trim-slider input[type='range'] {
  position: absolute; inset: 0; width: 100%;
  -webkit-appearance: none; appearance: none;
  background: none; pointer-events: none;
}
.trim-slider input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 18px; height: 28px; border-radius: 4px;
  background: #2563eb; border: 2px solid white;
  pointer-events: auto; cursor: ew-resize;
}
```

`web/src/components/TrimSlider.tsx`:
```tsx
'use client';

import { MIN_TRIM_SEC } from '@/lib/project';

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

export function TrimSlider({
  durationSec, value, onChange,
}: {
  durationSec: number;
  value: { startSec: number; endSec: number };
  onChange: (v: { startSec: number; endSec: number }) => void;
}) {
  const pct = (s: number) => (s / durationSec) * 100;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span>Start at <b>{fmt(value.startSec)}</b></span>
        <span>End at <b>{fmt(value.endSec)}</b></span>
      </div>
      <div className="trim-slider relative h-8 rounded bg-gray-200">
        <div
          className="absolute inset-y-0 rounded bg-blue-200"
          style={{ left: `${pct(value.startSec)}%`, width: `${pct(value.endSec - value.startSec)}%` }}
        />
        <input
          type="range" min={0} max={durationSec} step={0.1} value={value.startSec}
          onChange={(e) => {
            const startSec = Math.min(Number(e.target.value), value.endSec - MIN_TRIM_SEC);
            onChange({ startSec: Math.max(0, startSec), endSec: value.endSec });
          }}
        />
        <input
          type="range" min={0} max={durationSec} step={0.1} value={value.endSec}
          onChange={(e) => {
            const endSec = Math.max(Number(e.target.value), value.startSec + MIN_TRIM_SEC);
            onChange({ startSec: value.startSec, endSec: Math.min(durationSec, endSec) });
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 클립 카드 구현**

`web/src/components/ClipCard.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useEditorStore } from '@/store/editor';
import { ColorPopover } from '@/components/ColorPopover';
import { TrimSlider } from '@/components/TrimSlider';

export function ClipCard({ clipId, index, count }: { clipId: string; index: number; count: number }) {
  const clip = useEditorStore((s) => s.project.clips.find((c) => c.id === clipId));
  const ingest = useEditorStore((s) => s.ingest[clipId] ?? { state: 'idle' as const });
  const { removeClip, moveClip, attachMedia, setTrim, setVolume, setLabel, setIngestState, setClipUrl } =
    useEditorStore();
  const [url, setUrl] = useState('');

  if (!clip) return null;
  const ready = clip.source?.mediaId != null && clip.trim != null;

  async function ingestUrl() {
    if (!url.trim()) return;
    setClipUrl(clipId, url.trim());
    setIngestState(clipId, { state: 'loading' });
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? '가져오기 실패');
      attachMedia(clipId, { mediaId: data.mediaId, durationSec: data.durationSec, via: 'url' });
      setIngestState(clipId, { state: 'idle' });
    } catch (e) {
      setIngestState(clipId, {
        state: 'error',
        message: `${e instanceof Error ? e.message : '가져오기 실패'} — 아래에서 MP4를 직접 업로드할 수도 있어요.`,
      });
    }
  }

  async function uploadFile(file: File) {
    setIngestState(clipId, { state: 'loading' });
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '업로드 실패');
      attachMedia(clipId, { mediaId: data.mediaId, durationSec: data.durationSec, via: 'upload' });
      setIngestState(clipId, { state: 'idle' });
    } catch (e) {
      setIngestState(clipId, { state: 'error', message: e instanceof Error ? e.message : '업로드 실패' });
    }
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Video Rank {index + 1}</h3>
        <div className="flex gap-1">
          <button type="button" aria-label="위로" disabled={index === 0}
            className="rounded border px-2 disabled:opacity-30" onClick={() => moveClip(clipId, -1)}>↑</button>
          <button type="button" aria-label="아래로" disabled={index === count - 1}
            className="rounded border px-2 disabled:opacity-30" onClick={() => moveClip(clipId, 1)}>↓</button>
          <button type="button" aria-label="삭제" disabled={count === 1}
            className="rounded border px-2 text-red-500 disabled:opacity-30" onClick={() => removeClip(clipId)}>🗑</button>
        </div>
      </div>

      {!ready && (
        <>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="TikTok, Instagram, or YouTube video link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ingestUrl()}
              disabled={ingest.state === 'loading'}
            />
            <button type="button" onClick={ingestUrl} disabled={ingest.state === 'loading'}
              className="rounded bg-blue-500 px-4 py-2 text-white disabled:opacity-50">
              {ingest.state === 'loading' ? '가져오는 중…' : '→'}
            </button>
          </div>
          <div className="my-2 text-center text-xs text-gray-400">OR</div>
          <label className="block cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-sm text-gray-500 hover:bg-gray-50">
            MP4 업로드 (최대 500MB)
            <input type="file" accept="video/mp4" className="hidden" disabled={ingest.state === 'loading'}
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
          </label>
          {ingest.state === 'error' && (
            <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-600">{ingest.message}</p>
          )}
        </>
      )}

      {ready && clip.durationSec != null && clip.trim != null && (
        <div className="flex flex-col gap-3">
          <TrimSlider durationSec={clip.durationSec} value={clip.trim} onChange={(t) => setTrim(clipId, t)} />
          <label className="flex items-center gap-2 text-sm">
            🔊 Volume
            <input type="range" min={0} max={1} step={0.05} value={clip.volume}
              onChange={(e) => setVolume(clipId, Number(e.target.value))} />
            <span className="w-10 text-xs">{Math.round(clip.volume * 100)}%</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Video Title (예: Laugh)"
              value={clip.label.text}
              onChange={(e) => setLabel(clipId, { text: e.target.value })}
            />
            <input type="number" min={20} max={150} className="w-20 rounded border px-2 py-2 text-sm"
              value={clip.label.fontSizePx}
              onChange={(e) => setLabel(clipId, { fontSizePx: Number(e.target.value) })} />
            <ColorPopover value={clip.label.color} onChange={(color) => setLabel(clipId, { color })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Stroke
            <ColorPopover value={clip.label.strokeColor} onChange={(strokeColor) => setLabel(clipId, { strokeColor })} />
            <input type="range" min={0} max={20} step={1} value={clip.label.strokeWidthPx}
              onChange={(e) => setLabel(clipId, { strokeWidthPx: Number(e.target.value) })} />
            <span className="w-8 text-xs">{clip.label.strokeWidthPx}px</span>
          </label>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: 페이지에 카드 목록 + Add More Video 조립**

`web/src/app/page.tsx` 전체 교체:
```tsx
'use client';

import { useEditorStore } from '@/store/editor';
import { TitleEditor } from '@/components/TitleEditor';
import { GeneralSettings } from '@/components/GeneralSettings';
import { ClipCard } from '@/components/ClipCard';

export default function Home() {
  const clipIds = useEditorStore((s) => s.project.clips.map((c) => c.id));
  const addClip = useEditorStore((s) => s.addClip);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 bg-gray-50 p-6">
      <TitleEditor />
      <GeneralSettings />
      {clipIds.map((id, i) => (
        <ClipCard key={id} clipId={id} index={i} count={clipIds.length} />
      ))}
      <button
        type="button"
        onClick={addClip}
        className="rounded-xl border-2 border-dashed border-blue-300 p-4 text-blue-500 hover:bg-blue-50"
      >
        + Add More Video
      </button>
    </main>
  );
}
```

- [ ] **Step 4: 브라우저 수동 검증**

`npm run dev` 상태에서:
1. `+ Add More Video` → 카드 추가, ↑↓로 순서 변경(=rank 변경), 🗑 삭제(카드 1개일 땐 비활성)
2. 카드에서 `public/fixtures/clip-a.mp4` 업로드 → 트림/볼륨/라벨 편집기로 전환
3. 트림 양쪽 핸들 드래그 → Start/End 표시 갱신, 핸들 교차 불가(최소 0.5s 유지)
4. 잘못된 URL(`https://example.com/x`) 인제스트 → 빨간 에러 + "업로드로 대체" 안내 노출
5. YouTube Shorts URL 인제스트 → 로딩 → 편집기 전환
Expected: 콘솔 에러 0건.

- [ ] **Step 5: Commit**

```bash
git add src/components/TrimSlider.tsx src/components/ClipCard.tsx src/app/page.tsx src/app/globals.css
git commit -m "feat: clip cards with url ingest, upload fallback, trim and label editing"
```

---

### Task 12: UI — Custom Playback Order(dnd) + 실시간 미리보기(Player)

**Files:**
- Create: `web/src/components/OrderPanel.tsx`, `web/src/components/PreviewPane.tsx`
- Modify: `web/src/app/page.tsx`(2컬럼 레이아웃)

**Interfaces:**
- Consumes: 스토어(Task 9), `buildRenderProject`(Task 2), `computeTimeline`(Task 3), 컴포지션(Task 4)
- Produces: `<OrderPanel/>`, `<PreviewPane/>`

- [ ] **Step 1: OrderPanel 구현 (@dnd-kit sortable)**

`web/src/components/OrderPanel.tsx`:
```tsx
'use client';

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditorStore } from '@/store/editor';

function SortableRow({ id, text }: { id: string; text: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex cursor-grab items-center gap-2 rounded border bg-white px-3 py-2 text-sm"
      {...attributes}
      {...listeners}
    >
      <span className="text-gray-400">⠿</span> {text}
    </li>
  );
}

export function OrderPanel() {
  const clips = useEditorStore((s) => s.project.clips);
  const customOrder = useEditorStore((s) => s.project.customOrder);
  const setCustomOrderEnabled = useEditorStore((s) => s.setCustomOrderEnabled);
  const setCustomOrder = useEditorStore((s) => s.setCustomOrder);

  const enabled = customOrder !== null;
  const order = customOrder ?? clips.map((c) => c.id);
  const nameOf = (id: string) => {
    const i = clips.findIndex((c) => c.id === id);
    const label = clips[i]?.label.text;
    return `Rank ${i + 1}${label ? ` — ${label}` : ''}`;
  };

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setCustomOrder(arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))));
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Playback Order</h2>
        <label className="flex items-center gap-2 text-sm">
          Custom Playback Order
          <input type="checkbox" checked={enabled} onChange={(e) => setCustomOrderEnabled(e.target.checked)} />
        </label>
      </div>
      {enabled && (
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="mt-3 flex flex-col gap-2">
              {order.map((id) => <SortableRow key={id} id={id} text={nameOf(id)} />)}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {!enabled && <p className="mt-2 text-xs text-gray-400">기본: Rank 1 → N 순서로 재생됩니다.</p>}
    </section>
  );
}
```

- [ ] **Step 2: PreviewPane 구현**

`web/src/components/PreviewPane.tsx`:
```tsx
'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useEditorStore } from '@/store/editor';
import { FPS, HEIGHT, WIDTH, buildRenderProject } from '@/lib/project';
import { computeTimeline } from '@/lib/timeline';
import { RankingVideo } from '@/remotion/RankingVideo';

const Player = dynamic(() => import('@remotion/player').then((m) => m.Player), { ssr: false });

export function PreviewPane() {
  const project = useEditorStore((s) => s.project);

  const built = useMemo(
    () => buildRenderProject(project, (mediaId) => ({ kind: 'url', url: `/api/media/${mediaId}` })),
    [project],
  );

  if (!built.ok) {
    return (
      <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-1 rounded-xl bg-gray-900 p-6 text-center text-xs text-gray-400">
        <p className="mb-2 text-sm text-gray-300">미리보기를 보려면 클립을 준비해 주세요</p>
        {built.problems.map((p) => <p key={p}>{p}</p>)}
      </div>
    );
  }

  const { totalFrames } = computeTimeline(built.value.clips, FPS);
  return (
    <Player
      component={RankingVideo}
      inputProps={{ project: built.value }}
      durationInFrames={Math.max(1, totalFrames)}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      fps={FPS}
      controls
      style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden' }}
    />
  );
}
```

- [ ] **Step 3: 2컬럼 레이아웃 조립**

`web/src/app/page.tsx` 전체 교체:
```tsx
'use client';

import { useEditorStore } from '@/store/editor';
import { TitleEditor } from '@/components/TitleEditor';
import { GeneralSettings } from '@/components/GeneralSettings';
import { ClipCard } from '@/components/ClipCard';
import { OrderPanel } from '@/components/OrderPanel';
import { PreviewPane } from '@/components/PreviewPane';

export default function Home() {
  const clipIds = useEditorStore((s) => s.project.clips.map((c) => c.id));
  const addClip = useEditorStore((s) => s.addClip);

  return (
    <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 bg-gray-50 p-6 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-4">
        <TitleEditor />
        <GeneralSettings />
        <OrderPanel />
        {clipIds.map((id, i) => (
          <ClipCard key={id} clipId={id} index={i} count={clipIds.length} />
        ))}
        <button
          type="button"
          onClick={addClip}
          className="rounded-xl border-2 border-dashed border-blue-300 p-4 text-blue-500 hover:bg-blue-50"
        >
          + Add More Video
        </button>
      </div>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <PreviewPane />
      </aside>
    </main>
  );
}
```

- [ ] **Step 4: 브라우저 수동 검증**

`npm run dev` 상태에서:
1. 클립 2개 준비(픽스처 업로드) + 라벨 입력 → 우측에 Player 등장
2. 재생 → 상단 제목/좌측 숫자/라벨 페이드인/하드컷이 Studio(Task 4)와 동일
3. 트림 변경 → Player 길이 즉시 갱신 / 제목·색 변경 → 즉시 반영
4. Custom Playback Order 토글 on → 드래그로 순서 바꾸면 미리보기 재생 순서 변경(숫자·라벨은 rank 유지)
5. 클립 미준비 상태에선 문제 목록이 안내되는 placeholder 표시
Expected: 콘솔 에러 0건, seek(스크럽)이 부드럽게 동작(Range 서빙 확인).

- [ ] **Step 5: Commit**

```bash
git add src/components/OrderPanel.tsx src/components/PreviewPane.tsx src/app/page.tsx
git commit -m "feat: custom playback order dnd and live remotion player preview"
```

---

### Task 13: UI — Generate 흐름(검증→렌더→진행률→다운로드) + 전체 E2E

**Files:**
- Create: `web/src/components/GeneratePanel.tsx`
- Modify: `web/src/app/page.tsx`

**Interfaces:**
- Consumes: `POST /api/render`, `GET /api/render/:jobId`, `GET /api/render/:jobId/download`(Task 8), `buildRenderProject`(Task 2)
- Produces: `<GeneratePanel/>` — 완성.

- [ ] **Step 1: GeneratePanel 구현**

`web/src/components/GeneratePanel.tsx`:
```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor';
import { buildRenderProject } from '@/lib/project';

type Phase =
  | { name: 'idle' }
  | { name: 'submitting' }
  | { name: 'rendering'; jobId: string; status: string; progress: number }
  | { name: 'done'; jobId: string }
  | { name: 'error'; message: string };

export function GeneratePanel() {
  const project = useEditorStore((s) => s.project);
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = buildRenderProject(project, () => ({ kind: 'url', url: 'placeholder' }));
  const canGenerate = check.ok && (phase.name === 'idle' || phase.name === 'done' || phase.name === 'error');

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function poll(jobId: string) {
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/render/${jobId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? '상태 조회 실패');
        if (data.status === 'done') {
          if (timer.current) clearInterval(timer.current);
          setPhase({ name: 'done', jobId });
        } else if (data.status === 'error') {
          if (timer.current) clearInterval(timer.current);
          setPhase({ name: 'error', message: data.error ?? '렌더링 실패' });
        } else {
          setPhase({ name: 'rendering', jobId, status: data.status, progress: data.progress ?? 0 });
        }
      } catch (e) {
        if (timer.current) clearInterval(timer.current);
        setPhase({ name: 'error', message: e instanceof Error ? e.message : '상태 조회 실패' });
      }
    }, 1000);
  }

  async function generate() {
    setPhase({ name: 'submitting' });
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data.problems as string[])?.join('\n') ?? '렌더 요청 실패');
      setPhase({ name: 'rendering', jobId: data.jobId, status: 'queued', progress: 0 });
      poll(data.jobId);
    } catch (e) {
      setPhase({ name: 'error', message: e instanceof Error ? e.message : '렌더 요청 실패' });
    }
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      {!check.ok && (
        <ul className="mb-3 list-disc pl-5 text-sm text-amber-600">
          {check.problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      {phase.name === 'rendering' && (
        <div className="mb-3">
          <div className="mb-1 text-sm text-gray-600">
            {phase.status === 'bundling' ? '준비 중…' : `렌더링 중 ${(phase.progress * 100).toFixed(0)}%`}
          </div>
          <div className="h-2 rounded bg-gray-200">
            <div className="h-2 rounded bg-blue-500 transition-all" style={{ width: `${phase.progress * 100}%` }} />
          </div>
        </div>
      )}
      {phase.name === 'error' && (
        <p className="mb-3 whitespace-pre-wrap rounded bg-red-50 p-2 text-sm text-red-600">{phase.message}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={!canGenerate}
          className="rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white disabled:opacity-40"
        >
          ✦ Generate Video Ranking
        </button>
        {phase.name === 'done' && (
          <a
            href={`/api/render/${phase.jobId}/download`}
            className="rounded-lg bg-green-500 px-6 py-3 font-semibold text-white"
          >
            ⬇ 완성본 다운로드
          </a>
        )}
      </div>
    </section>
  );
}
```

`web/src/app/page.tsx` — `<PreviewPane />` 아래(aside 내부)에 추가:
```tsx
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <PreviewPane />
        <GeneratePanel />
      </aside>
```
(상단 import에 `import { GeneratePanel } from '@/components/GeneratePanel';` 추가.)

- [ ] **Step 2: 전체 E2E 수동 검증 (체크리스트)**

`npm run dev` 상태에서 처음부터 끝까지:
1. 제목 입력: `Ranking The Funniest` ⏎ `Baby Reactions`
2. 클립 3개: 픽스처 2개 업로드 + YouTube Shorts URL 1개 인제스트, 라벨 각각 입력
3. 각 클립 트림을 3~4초로 조정, 1개는 볼륨 50%
4. Custom Playback Order on → 순서 뒤집기
5. 미리보기 재생으로 최종 확인
6. Generate → 진행률 표시 → 완료 → 다운로드
7. 다운로드 파일 검증:
```powershell
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate -show_entries format=duration -of json "$env:USERPROFILE\Downloads\video-ranking.mp4"
```
Expected: h264+aac, 1080×1920, 30/1, duration = 트림 합계(±0.3s). 영상을 열어 미리보기와 동일한지, 참고 `output.mp4` 스타일과 일치하는지 육안 확인.
8. 실패 경로: 클립 미준비 상태에서 Generate 버튼 비활성 + 문제 목록 표시 확인.

- [ ] **Step 3: 프로덕션 모드 확인**

```bash
npm run build && npm run start
```
http://localhost:3000 에서 2번(업로드 1개) + 6번(Generate) 축약 재실행 → 동일 동작. (`next build`가 타입 에러 0으로 통과하는 것 자체가 검증.)

- [ ] **Step 4: Commit**

```bash
git add src/components/GeneratePanel.tsx src/app/page.tsx
git commit -m "feat: generate flow with progress polling and download"
```

---

### Task 14: README + 마무리

**Files:**
- Create: `web/README.md` (기존 create-next-app README 교체)

- [ ] **Step 1: README 작성**

`web/README.md` 전체 교체:
```markdown
# Video Ranking Maker

TikTok / Instagram / YouTube 클립을 모아 랭킹 숏폼(9:16, 1080×1920) 영상을 만드는 로컬 웹앱.

## 요구 사항 (Windows)

- Node.js 20+
- ffmpeg / ffprobe: `winget install Gyan.FFmpeg`
- yt-dlp: `winget install yt-dlp.yt-dlp` (자주 업데이트할 것: `yt-dlp -U`)
- 첫 렌더 시 Remotion이 Chrome Headless Shell을 자동 다운로드(인터넷 필요)

## 실행

```bash
npm install
npm run fixtures   # 테스트용 샘플 클립 생성(선택)
npm run dev        # http://localhost:3000
```

프로덕션: `npm run build && npm run start` (⚠ Vercel 등 서버리스 배포 불가 — 로컬 Node 서버 전용)

## 사용법

1. 상단 제목 입력(줄바꿈 가능), 색·외곽선 조정
2. 카드마다 영상 URL 입력(→) 또는 MP4 업로드 — URL 실패 시 업로드로 대체
3. 트림 핸들로 구간 자르기, 볼륨·라벨(Video Title) 설정
4. 필요하면 Custom Playback Order로 재생 순서 드래그 변경 (숫자 rank는 카드 순서)
5. 우측 미리보기 확인 → Generate → 완료 후 다운로드

## 개발

- `npm test` — vitest (스키마·타임라인·에러분류·잡·스토어)
- `npm run studio` — Remotion Studio에서 컴포지션만 열기
- `npm run render:cli` — UI 없이 픽스처 렌더(엔진 검증)

## 주의

- 다운로드한 타 플랫폼 영상의 저작권·약관 책임은 사용자에게 있습니다(개인용 전제).
- yt-dlp는 플랫폼 변경에 취약 — 인제스트가 갑자기 실패하면 먼저 `yt-dlp -U`.
```

- [ ] **Step 2: 전체 테스트 + 빌드 최종 확인**

```bash
npm test && npm run build
```
Expected: 테스트 전부 PASS, 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: usage and setup README"
```
