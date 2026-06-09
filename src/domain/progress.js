// Adaptive checklist-progress view model for the Editorial card (ADR-0002, spec §3.4).

export const SEG_MAX = 8;

export function progressView(done, total) {
  const complete = total > 0 && done === total;
  if (total > SEG_MAX) {
    return {
      mode: 'minibar',
      pct: Math.round((done / total) * 100),
      complete,
    };
  }
  return {
    mode: 'segments',
    segments: Array.from({ length: total }, (_, i) => i < done),
    complete,
  };
}
