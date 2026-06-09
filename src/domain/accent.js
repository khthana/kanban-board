// Card accent (ADR-0002): the dot, category text, and progress fill all derive
// from a single base color. Darker `text` shade uses CSS color-mix, matching the
// column-accent approach (ADR-0001) — derived in the browser, not in JS.

// Neutral fallback for a card with no category color.
const NEUTRAL_SOLID = '#cbd5e1';
const NEUTRAL_TEXT = '#64748b';

// Resolve a card's Category — the label flagged by categoryLabelId among the
// card's labels. Returns null when unset, or when that label is gone
// (deleted / detached), so the card falls back to a neutral accent.
export function categoryLabel(categoryLabelId, labels = []) {
  return labels.find(l => l.id === categoryLabelId) ?? null;
}

export function cardAccent(baseColor) {
  if (!baseColor) {
    return { solid: NEUTRAL_SOLID, text: NEUTRAL_TEXT, neutral: true };
  }
  return {
    solid: baseColor,
    text: `color-mix(in oklab, ${baseColor}, black 35%)`,
    neutral: false,
  };
}
