import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { probeDurationSec, isUuid, saveUploadedFile, MediaError, missingMediaProblems, ensureDirs } from '@/lib/media';

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

describe('missingMediaProblems', () => {
  it('reports clips whose media file is missing, keeps existing ones silent', async () => {
    await ensureDirs();
    const missing = crypto.randomUUID();
    const problems = missingMediaProblems([{ rank: 2, mediaId: missing }]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/2번/);
    expect(missingMediaProblems([])).toEqual([]);
  });
});

describe('saveUploadedFile failure handling', () => {
  it('rejects corrupt mp4 with MediaError (no filesystem path in message) and removes the orphan file', async () => {
    mkdirSync(path.join(process.cwd(), 'storage', 'media'), { recursive: true });
    const before = new Set(readdirSync(path.join(process.cwd(), 'storage', 'media')));
    const bad = new File([new Uint8Array([0, 1, 2, 3])], 'bad.mp4', { type: 'video/mp4' });
    await expect(saveUploadedFile(bad)).rejects.toSatisfy((e: unknown) => {
      return e instanceof MediaError && !/[\\/]/.test((e as Error).message);
    });
    const after = readdirSync(path.join(process.cwd(), 'storage', 'media'));
    expect(after.filter((f) => !before.has(f))).toEqual([]); // no orphan left behind
  });
});
