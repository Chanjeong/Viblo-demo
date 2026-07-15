import { describe, it, expect } from 'vitest';
import { clampNum } from '@/lib/num';

describe('clampNum', () => {
  it('clamps into range', () => {
    expect(clampNum('300', 20, 200, 76)).toBe(200);
    expect(clampNum('5', 20, 200, 76)).toBe(20);
    expect(clampNum('90', 50, 100, 80)).toBe(90);
  });
  it('falls back on empty/NaN', () => {
    expect(clampNum('', 20, 200, 76)).toBe(76);
    expect(clampNum('abc', 20, 200, 76)).toBe(76);
  });
});
