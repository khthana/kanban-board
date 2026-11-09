const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidHex(color) {
  return HEX_COLOR_RE.test(color);
}

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export { isValidHex, isUuid };
