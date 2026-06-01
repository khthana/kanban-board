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
  if (users.length > 0 && !users.some(u => u.email === email)) return 'No user with that email exists';
  return null;
}

export function validateEmail(email) {
  if (!email || email.trim().length === 0) return 'Email is required';
  if (!email.includes('@')) return 'Email must be a valid email address';
  return null;
}

export function validatePassword(password) {
  if (!password || password.length === 0) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  return null;
}

export function validateDisplayName(name) {
  if (!name || name.trim().length === 0) return 'Display name is required';
  if (name.length > 100) return 'Display name must be 100 characters or fewer';
  return null;
}
