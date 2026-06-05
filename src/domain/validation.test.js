import { validateBoardName, validateColumnName, validateCardTitle, validateCardDescription, validateLabelColor, validateInviteEmail, validateEmail, validatePassword, validateDisplayName, validatePasswordChange, validateSubtaskTitle, validateSubtaskCount } from './validation';

describe('validateBoardName', () => {
  test('rejects empty string', () => {
    expect(validateBoardName('')).not.toBeNull();
  });

  test('rejects name longer than 100 characters', () => {
    expect(validateBoardName('a'.repeat(101))).not.toBeNull();
  });

  test('accepts valid name', () => {
    expect(validateBoardName('Project Phoenix')).toBeNull();
  });

  test('accepts name of exactly 100 characters', () => {
    expect(validateBoardName('a'.repeat(100))).toBeNull();
  });
});

describe('validateColumnName', () => {
  test('rejects empty string', () => {
    expect(validateColumnName('')).not.toBeNull();
  });

  test('rejects name longer than 100 characters', () => {
    expect(validateColumnName('a'.repeat(101))).not.toBeNull();
  });

  test('accepts valid name', () => {
    expect(validateColumnName('In Progress')).toBeNull();
  });
});

describe('validateCardTitle', () => {
  test('rejects empty string', () => {
    expect(validateCardTitle('')).not.toBeNull();
  });

  test('rejects title longer than 255 characters', () => {
    expect(validateCardTitle('a'.repeat(256))).not.toBeNull();
  });

  test('accepts valid title', () => {
    expect(validateCardTitle('Fix login bug')).toBeNull();
  });
});

describe('validateCardDescription', () => {
  test('accepts empty string', () => {
    expect(validateCardDescription('')).toBeNull();
  });

  test('accepts undefined', () => {
    expect(validateCardDescription(undefined)).toBeNull();
  });

  test('rejects description longer than 5000 characters', () => {
    expect(validateCardDescription('a'.repeat(5001))).not.toBeNull();
  });

  test('accepts description of exactly 5000 characters', () => {
    expect(validateCardDescription('a'.repeat(5000))).toBeNull();
  });
});

describe('validateLabelColor', () => {
  test('rejects non-hex string', () => {
    expect(validateLabelColor('red')).not.toBeNull();
  });

  test('rejects hex without # prefix', () => {
    expect(validateLabelColor('ff0000')).not.toBeNull();
  });

  test('accepts 6-digit hex color', () => {
    expect(validateLabelColor('#ff0000')).toBeNull();
  });

  test('accepts 3-digit hex color', () => {
    expect(validateLabelColor('#f00')).toBeNull();
  });
});

describe('validateInviteEmail', () => {
  const users = [
    { email: 'alice@example.com' },
    { email: 'bob@example.com' },
  ];

  test('rejects email not in users list', () => {
    expect(validateInviteEmail('stranger@example.com', users)).not.toBeNull();
  });

  test('accepts email that matches an existing user', () => {
    expect(validateInviteEmail('alice@example.com', users)).toBeNull();
  });
});

describe('validateEmail', () => {
  test('rejects empty string', () => {
    expect(validateEmail('')).not.toBeNull();
  });

  test('rejects string without @', () => {
    expect(validateEmail('notanemail')).not.toBeNull();
  });

  test('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });
});

describe('validatePassword', () => {
  test('rejects empty string', () => {
    expect(validatePassword('')).not.toBeNull();
  });

  test('rejects password shorter than 8 characters', () => {
    expect(validatePassword('abc123')).not.toBeNull();
  });

  test('accepts password with 8 or more characters', () => {
    expect(validatePassword('password1')).toBeNull();
  });
});

describe('validatePasswordChange', () => {
  test('accepts valid newPassword and matching confirmPassword', () => {
    expect(validatePasswordChange({ newPassword: 'newpass456', confirmPassword: 'newpass456' })).toBeNull();
  });

  test('rejects newPassword shorter than 8 characters', () => {
    const result = validatePasswordChange({ newPassword: 'short', confirmPassword: 'short' });
    expect(result).not.toBeNull();
    expect(result.field).toBe('newPassword');
  });

  test('rejects confirmPassword that does not match newPassword', () => {
    const result = validatePasswordChange({ newPassword: 'newpass456', confirmPassword: 'different' });
    expect(result).not.toBeNull();
    expect(result.field).toBe('confirmPassword');
  });
});

describe('validateSubtaskTitle', () => {
  test('rejects empty string', () => {
    expect(validateSubtaskTitle('')).not.toBeNull();
  });

  test('rejects title longer than 100 characters', () => {
    expect(validateSubtaskTitle('a'.repeat(101))).not.toBeNull();
  });

  test('accepts title of exactly 100 characters', () => {
    expect(validateSubtaskTitle('a'.repeat(100))).toBeNull();
  });

  test('accepts valid title', () => {
    expect(validateSubtaskTitle('Fix login bug')).toBeNull();
  });
});

describe('validateSubtaskCount', () => {
  test('accepts count of 0', () => {
    expect(validateSubtaskCount(0)).toBeNull();
  });

  test('accepts count of 19', () => {
    expect(validateSubtaskCount(19)).toBeNull();
  });

  test('rejects count of 20 (at limit)', () => {
    expect(validateSubtaskCount(20)).not.toBeNull();
  });
});

describe('validateDisplayName', () => {
  test('rejects empty string', () => {
    expect(validateDisplayName('')).not.toBeNull();
  });

  test('rejects name longer than 100 characters', () => {
    expect(validateDisplayName('a'.repeat(101))).not.toBeNull();
  });

  test('accepts valid display name', () => {
    expect(validateDisplayName('Alice')).toBeNull();
  });
});
