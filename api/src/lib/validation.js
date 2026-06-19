const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isValidHex(color) {
  return HEX_COLOR_RE.test(color);
}

export { isValidHex };
