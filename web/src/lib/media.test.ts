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
