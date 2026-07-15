/** 문자열 입력을 [min,max]로 클램프. 비어있거나 숫자가 아니면 fallback 반환 */
export function clampNum(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (raw.trim() === '' || Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
