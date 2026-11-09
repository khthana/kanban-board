// Card completion (ADR-0003): a per-card "done" state stored as `completedAt`
// (a YYYY-MM-DD date, or null when not done). The boolean is always derived
// here — never stored separately.

import { toYMD } from './dates';

export function isDone(card) {
  return !!card?.completedAt;
}

// The patch sent through the generic patchCard to mark/un-mark a card done.
// The client stamps the local day; un-marking clears it.
export function completionPatch(done) {
  return { completedAt: done ? toYMD(new Date()) : null };
}
