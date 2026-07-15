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
