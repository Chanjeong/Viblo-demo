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
