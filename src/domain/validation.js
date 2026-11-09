function validateName(name, label, maxLen) {
  if (!name || name.trim().length === 0) return `${label} is required`;
  if (name.length > maxLen) return `${label} must be ${maxLen} characters or fewer`;
  return null;
}

// Length limits, shared with the API routes (#65) so the client check and the
// authoritative server check can't disagree.
export const MAX_NAME_LENGTH = 100;              // board, column, label, display name
export const MAX_CARD_TITLE_LENGTH = 255;
export const MAX_CARD_DESCRIPTION_LENGTH = 5000;

export const validateBoardName  = (name) => validateName(name, 'Board name',  MAX_NAME_LENGTH);
export const validateColumnName = (name) => validateName(name, 'Column name', MAX_NAME_LENGTH);
export const validateLabelName  = (name) => validateName(name, 'Label name',  MAX_NAME_LENGTH);
export const validateCardTitle  = (title) => validateName(title, 'Card title', MAX_CARD_TITLE_LENGTH);

export function validateCardDescription(desc) {
  if (desc && desc.length > MAX_CARD_DESCRIPTION_LENGTH) return `Description must be ${MAX_CARD_DESCRIPTION_LENGTH} characters or fewer`;
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

export const MAX_SUBTASK_TITLE_LENGTH = 100;
export const validateSubtaskTitle = (title) => validateName(title, 'Subtask title', MAX_SUBTASK_TITLE_LENGTH);

// Shared with the API (imported by its subtask routes), so the client check and
// the authoritative server check can't disagree.
export const MAX_SUBTASKS_PER_CARD = 50;

export function validateSubtaskCount(count) {
  if (count >= MAX_SUBTASKS_PER_CARD) return `Maximum ${MAX_SUBTASKS_PER_CARD} subtasks per card`;
  return null;
}

export function validateDisplayName(name) {
  if (!name || name.trim().length === 0) return 'Display name is required';
  if (name.length > MAX_NAME_LENGTH) return `Display name must be ${MAX_NAME_LENGTH} characters or fewer`;
  return null;
}

export function validatePasswordChange({ newPassword, confirmPassword }) {
  const err = validatePassword(newPassword);
  if (err) return { field: 'newPassword', message: err };
  if (newPassword !== confirmPassword) return { field: 'confirmPassword', message: 'รหัสผ่านไม่ตรงกัน' };
  return null;
}
