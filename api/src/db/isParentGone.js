// A foreign-key violation (23503) on an INSERT whose only FK parent was just
// resolved by requireAccess means that parent was deleted in the meantime —
// the route answers 404 for it (#65). Only use it where the FK can point at
// nothing else, so a vanished target (e.g. a move's column) isn't misreported.
export default function isParentGone(err) {
  return err?.code === '23503';
}
