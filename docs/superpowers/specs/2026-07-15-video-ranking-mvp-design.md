# Video Ranking (Viblo 클론) — v1 MVP 설계

**작성일:** 2026-07-15
**상태:** 승인됨 (구현 계획 대기)

## 1. 목적

TikTok/Instagram/YouTube URL(또는 MP4 업로드)로 받은 여러 클립을
"랭킹 숏폼" 스타일 하나의 세로 영상(9:16)으로 합성해 내보내는 웹앱.
Viblo의 "Video Ranking" 기능을 참고하되, v1은 참고 영상
(`output.mp4`)을 정확히 재현하는 핵심 기능에 집중한다.

### 최우선 원칙
**신뢰성 우선.** 기능 수보다 "무조건 안정적으로 동작"이 우선한다.
엣지케이스·에러 경로를 최소화하기 위해 v1 범위를 의도적으로 좁게 잡는다.

## 2. 참고 영상(`output.mp4`) 실측 분석

- 포맷: 1080×1920 (9:16), 30fps, ~77초, H.264/AAC
- 구성: 클립 5개(각 ~15.4초)를 이어붙임, 원본(틱톡) 오디오만 사용
- 레이아웃(위→아래):
  - 상단 레터박스(~10%, 짙은 회색 `#2B2A2A`): 전체 제목
    "Ranking The Funniest Baby Reactions" — 굵은 압축서체(Archivo Black),
    흰색, 특정 단어("Baby")만 빨강, 외곽선(stroke) 있음
  - 중앙(~80%): 클립이 폭에 꽉 차게(cover) 재생
  - 하단 레터박스(~10%): 빈 회색 바
- 좌측 숫자 리스트(영상 위 오버레이, 세로 고정):
  `1.`🔴 `2.`🟠 `3.`🟡 `4.`⚪ `5.`⚪ — 굵은 숫자+마침표+검은 외곽/그림자
- 라벨(각 숫자 옆): 클립별 "Video Title" 텍스트(흰색+검은 외곽)
  예) 1.Medicine 2.Laugh 3.Flower 4.Cake 5.😐
- 전환: 클립 간 **하드컷**(크로스페이드 없음). 클립 시작 시 해당 라벨이
  **페이드인**(~0.2–0.4초) 되어 이후 계속 표시 → 진행될수록 라벨 누적
  (마지막 클립에서 1~5 전부 표시). 숫자는 처음부터 끝까지 고정.

## 3. v1 범위

### 포함
- **전체 제목(Video Ranking Title)**: 텍스트, 폰트, 크기, Bold/Italic,
  정렬, 색상 픽커(RGB), stroke 슬라이더, 이모지, **줄바꿈**
- **클립 카드 N개**(가변, 추가/삭제): 입력은 URL(틱톡/IG/유튜브) 또는
  MP4 업로드(≤500MB)
- **클립별 Video Title(랭킹 라벨)**: 텍스트 + 스타일(색상, stroke 등)
- **클립별 트림**: 타임라인에서 Start/End 드래그, + 클립별 볼륨
- **재생 순서**: 드래그앤드롭 (Custom Playback Order 토글)
- **General 설정**: Video height(%), 배경색
- **숫자 외형**: 기본 팔레트 재현(rank1=빨강, 2=주황, 3=노랑, 4·5+=흰색;
  굵은 숫자+마침표+검은 외곽)
- **렌더 규칙**: 9:16 1080×1920, 상/하 레터박스, 좌측 숫자 리스트,
  하드컷 + 라벨 페이드인 누적, 원본 오디오 연결

### 제외 (차기 버전)
- Voiceover, Sound Effect
- 클립별 애니메이션/트랜지션 커스텀 (v1은 하드컷 고정)
- Enable Caption (음성 자동 자막)
- Number Appearance 세부 커스텀 (v1은 기본 팔레트 고정)

## 4. 아키텍처

전 구간 TypeScript(연결 지점 최소화 → 버그·엣지케이스 감소).

```
Frontend (React + TS, Vite)
  - 에디터 UI: dnd 정렬, 트림 슬라이더, 컬러픽커
  - Remotion <Player> 실시간 WYSIWYG 미리보기
        │  project JSON
Backend (Node)
  - POST /ingest : URL → yt-dlp 다운로드 (실패 시 유형별 에러)
  - POST /render : project JSON → Remotion 렌더 → mp4
        │
shared 패키지
  - <RankingVideo/> (Remotion 컴포지션)
  - 미리보기와 최종 렌더가 **동일한 React 코드**를 사용 →
    "미리보기 ≠ 결과물" 문제 원천 차단
```

- 저장소: 로컬 파일시스템(다운로드 클립 + 렌더 결과물). 개인/로컬 도구 전제.
- 최종 산출물: 1080×1920 9:16 mp4 (유튜브 쇼츠/틱톡/릴스 규격),
  브라우저에서 다운로드.

## 5. 데이터 모델 (project JSON)

```
{
  title: {
    text, font, size, bold, italic, align, color, stroke
  },
  general: { videoHeightPct, backgroundColor },
  order: 'default' | [clipId, ...],
  clips: [
    {
      id,
      rank,                              // 숫자/색상 결정
      source: { type: 'url' | 'upload', url?, filePath },
      duration,                          // 원본 길이(초)
      trim: { start, end },              // 사용할 구간(초)
      volume,                            // 0..1
      label: { text, color, stroke, ... }  // = Video Title
    }
  ]
}
```

## 6. 신뢰성 설계 (최우선 요구)

- **다운로드(인제스트)**: 신뢰성 리스크가 렌더링이 아니라 이 단계에 집중됨.
  - yt-dlp 래퍼에 타임아웃·재시도
  - 실패 유형 구분: 비공개 / 지역차단 / 레이트리밋 / 미지원 / 네트워크
  - 실패 시 UI에 명확한 사유 표시 + **"수동 MP4 업로드로 대체"** 폴백
- **검증**: URL 형식, 파일 타입/용량, 트림 범위(start<end, duration 이내),
  렌더 전 클립 ≥ 1개
- **렌더 결정성**: 고정 1080×1920/30fps. 해상도 제각각인 소스는 cover
  크롭으로 중앙 정렬해 꽉 채움
- **원자적 실패**: 어느 클립 하나라도 준비 안 되면 렌더 시작 전 차단하고
  어떤 클립이 문제인지 명시

## 7. 빌드 순서 (리스크 최소화)

1. **핵심 렌더 엔진** — `<RankingVideo/>` 컴포지션 + `project JSON → mp4`
   스크립트. **먼저 `output.mp4`와 동일하게 나오는지 육안 검증**
   (프레임 비교). 이 단계에서 레이아웃/숫자/라벨/전환/오디오 확정.
2. **백엔드 인제스트** — yt-dlp 다운로드 + 유형별 에러 + 수동 업로드 폴백
3. **에디터 UI + 라이브 미리보기** — Remotion Player로 project JSON을
   실시간 렌더, 각 편집 컨트롤 연결

## 8. 미해결/향후 확인 사항

- yt-dlp의 TikTok/IG/YT 지원은 사이트 변경에 취약 → 정기 업데이트 필요.
  배포/상업용 시 각 플랫폼 약관·저작권 재검토 필요(v1은 개인/로컬 전제).
- 숫자 리스트의 정확한 세로 간격·시작 위치는 구현 시 참고 프레임과 대조해 확정.
- 라벨 폰트(참고 영상은 Rubik류로 추정) 정확 매칭은 렌더 엔진 단계에서 확정.
