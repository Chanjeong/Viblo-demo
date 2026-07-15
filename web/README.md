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
