import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { probeDurationSec, isUuid, saveUploadedFile, MediaError } from '@/lib/media';

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

describe('saveUploadedFile failure handling', () => {
  it('rejects corrupt mp4 with MediaError (no filesystem path in message) and removes the orphan file', async () => {
    const before = new Set(readdirSync(path.join(process.cwd(), 'storage', 'media')));
    const bad = new File([new Uint8Array([0, 1, 2, 3])], 'bad.mp4', { type: 'video/mp4' });
    await expect(saveUploadedFile(bad)).rejects.toSatisfy((e: unknown) => {
      return e instanceof MediaError && !/[\\/]/.test((e as Error).message);
    });
    const after = readdirSync(path.join(process.cwd(), 'storage', 'media'));
    expect(after.filter((f) => !before.has(f))).toEqual([]); // no orphan left behind
  });
});
