// Category auto-promotion rules (ADR-0002).
// A card's Category is the label flagged by categoryLabelId.
// These pure functions compute the new categoryLabelId after label attach/detach.

// Returns the new categoryLabelId after attaching a label.
// Auto-sets to the attached label when no category is currently set.
export function resolveAttach(currentCategoryId, attachedId) {
  return currentCategoryId ?? attachedId;
}

// Returns the new categoryLabelId after detaching a label.
// Promotes the next remaining label when the detached label was the category.
export function resolveDetach(attachedIds, detachedId, currentCategoryId) {
  if (detachedId !== currentCategoryId) return currentCategoryId;
  const remaining = [...attachedIds].filter(id => id !== detachedId);
  return remaining[0] ?? null;
}
