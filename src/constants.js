// App-wide tunables kept in one place rather than scattered as magic numbers.

// How often usePolling reconciles the active board with the server.
export const POLLING_INTERVAL_MS = 10_000;

// How long a Toast stays visible before auto-dismissing.
export const TOAST_DURATION_MS = 3000;

// dnd-kit PointerSensor: pixels the pointer must travel before a drag starts
// (lets plain clicks through). See e2e/helpers.js pointerDrag().
export const DND_ACTIVATION_DISTANCE = 8;
