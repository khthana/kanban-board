import { resolveTitleCommit } from './titleEdit';

describe('resolveTitleCommit', () => {
  test('pressing Enter on an empty title is an error, keeping the editor open', () => {
    const result = resolveTitleCommit({ trigger: 'enter', value: '   ', current: 'Old title' });
    expect(result.action).toBe('error');
    expect(result.message).toBeTruthy();
  });

  test('blurring with an empty title reverts to the original instead of erroring', () => {
    const result = resolveTitleCommit({ trigger: 'blur', value: '   ', current: 'Old title' });
    expect(result).toEqual({ action: 'revert' });
  });

  test('a valid changed title saves the trimmed value (on Enter or blur)', () => {
    expect(resolveTitleCommit({ trigger: 'enter', value: '  New title  ', current: 'Old title' }))
      .toEqual({ action: 'save', title: 'New title' });
    expect(resolveTitleCommit({ trigger: 'blur', value: 'New title', current: 'Old title' }))
      .toEqual({ action: 'save', title: 'New title' });
  });

  test('committing an unchanged title (after trim) reverts without saving', () => {
    expect(resolveTitleCommit({ trigger: 'enter', value: '  Old title  ', current: 'Old title' }))
      .toEqual({ action: 'revert' });
  });

  test('pressing Enter on a title longer than 255 chars is an error', () => {
    const result = resolveTitleCommit({ trigger: 'enter', value: 'a'.repeat(256), current: 'Old title' });
    expect(result.action).toBe('error');
    expect(result.message).toBeTruthy();
  });
});
