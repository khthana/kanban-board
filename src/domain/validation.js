function validateName(name, label, maxLen) {
  if (!name || name.trim().length === 0) return `${label} is required`;
  if (name.length > maxLen) return `${label} must be ${maxLen} characters or fewer`;
  return null;
}

export const validateBoardName  = (name) => validateName(name, 'Board name',  100);
export const validateColumnName = (name) => validateName(name, 'Column name', 100);
export const validateCardTitle  = (title) => validateName(title, 'Card title', 255);

export function validateCardDescription(desc) {
  if (desc && desc.length > 5000) return 'Description must be 5000 characters or fewer';
  return null;
}

export function validateLabelColor(color) {
  if (!color || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    return 'Label color must be a valid hex color (e.g. #f00 or #ff0000)';
  }
  return null;
}

export function validateInviteEmail(email, users) {
  if (!users.some(u => u.email === email)) return 'No user with that email exists';
  return null;
}
