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
