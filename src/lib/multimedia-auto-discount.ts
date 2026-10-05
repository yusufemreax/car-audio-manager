/** Round down to a 500 TL price; within the first 100 TL, use one step lower. */
export function calculateMultimediaAutoDiscount(grossTotalTry: number): number {
  if (!Number.isFinite(grossTotalTry) || grossTotalTry <= 0) return 0;
  const grossCents = Math.round(grossTotalTry * 100);
  const stepCents = 50000;
  const remainder = grossCents % stepCents;
  const targetCents = Math.max(
    0,
    grossCents - remainder - (remainder <= 10000 ? stepCents : 0)
  );
  return (grossCents - targetCents) / 100;
}
