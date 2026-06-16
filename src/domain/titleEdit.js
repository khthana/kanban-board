import { validateCardTitle } from './validation';

// Decides what a card-title commit attempt should do, given the trigger
// ('enter' or 'blur'), the typed value, and the current title. Pure so the
// save/revert/error branching stays out of the component and is unit-testable.
//   enter + invalid          -> { action: 'error', message }
//   blur  + invalid          -> { action: 'revert' }
//   valid + unchanged (trim) -> { action: 'revert' }  (no-op)
//   valid + changed          -> { action: 'save', title }
export function resolveTitleCommit({ trigger, value, current }) {
  const error = validateCardTitle(value);
  if (error) {
    return trigger === 'enter'
      ? { action: 'error', message: error }
      : { action: 'revert' };
  }
  const title = value.trim();
  if (title === current) {
    return { action: 'revert' };
  }
  return { action: 'save', title };
}
