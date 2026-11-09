import { splitSubtaskLines, checkSubtaskBatch, describeSubtaskBatchError } from './subtaskBatch';

const items = (n, title = 'x') => Array.from({ length: n }, (_, i) => ({ line: i + 1, title }));

describe('checkSubtaskBatch', () => {
  test('a valid batch has no error', () => {
    expect(checkSubtaskBatch(items(3), 0)).toBeNull();
  });

  test('nothing to add is an error', () => {
    expect(checkSubtaskBatch([], 0)).toEqual({ reason: 'empty' });
  });

  test('a 100-character title is fine, 101 names the offending line', () => {
    const ok = [{ line: 1, title: 'a'.repeat(100) }];
    expect(checkSubtaskBatch(ok, 0)).toBeNull();

    const bad = [{ line: 1, title: 'ok' }, { line: 4, title: 'a'.repeat(101) }];
    expect(checkSubtaskBatch(bad, 0)).toEqual({ reason: 'tooLong', line: 4 });
  });

  test('a blank title names its line', () => {
    expect(checkSubtaskBatch([{ line: 1, title: 'ok' }, { line: 2, title: '  ' }], 0))
      .toEqual({ reason: 'blank', line: 2 });
  });

  test('filling the card to exactly 50 is allowed', () => {
    expect(checkSubtaskBatch(items(36), 14)).toBeNull();
    expect(checkSubtaskBatch(items(50), 0)).toBeNull();
  });

  test('one past 50 is rejected with how many still fit', () => {
    expect(checkSubtaskBatch(items(37), 14)).toEqual({ reason: 'overLimit', count: 37, room: 36 });
  });

  test('a full card has no room at all', () => {
    expect(checkSubtaskBatch(items(1), 50)).toEqual({ reason: 'overLimit', count: 1, room: 0 });
  });
});

describe('describeSubtaskBatchError', () => {
  test('explains each reason in Thai', () => {
    expect(describeSubtaskBatchError({ reason: 'tooLong', line: 4 })).toBe('บรรทัดที่ 4 ยาวเกิน 100 ตัวอักษร');
    expect(describeSubtaskBatchError({ reason: 'blank', line: 2 })).toBe('บรรทัดที่ 2 ว่าง');
    expect(describeSubtaskBatchError({ reason: 'overLimit', count: 37, room: 36 }))
      .toBe('วาง 37 รายการจะเกินลิมิต 50 (เพิ่มได้อีก 36)');
    expect(describeSubtaskBatchError({ reason: 'empty' })).toBe('ไม่มีรายการให้เพิ่ม');
  });
});

describe('splitSubtaskLines', () => {
  test('one item per line, numbered by the line it came from in the pasted text', () => {
    expect(splitSubtaskLines('ครั้งที่ 1 แนะนำวิชา\nครั้งที่ 2 ตัวแปร')).toEqual([
      { line: 1, title: 'ครั้งที่ 1 แนะนำวิชา' },
      { line: 2, title: 'ครั้งที่ 2 ตัวแปร' },
    ]);
  });

  test('skips blank / whitespace-only lines but keeps original line numbers', () => {
    expect(splitSubtaskLines('A\n\n   \nB\n')).toEqual([
      { line: 1, title: 'A' },
      { line: 4, title: 'B' },
    ]);
  });

  test('trims indentation and trailing spaces/tabs', () => {
    expect(splitSubtaskLines('  \tslide  \n- note\t')).toEqual([
      { line: 1, title: 'slide' },
      { line: 2, title: '- note' },
    ]);
  });

  test('handles Windows line endings', () => {
    expect(splitSubtaskLines('A\r\nB\r\n')).toEqual([
      { line: 1, title: 'A' },
      { line: 2, title: 'B' },
    ]);
  });

  test('empty text yields nothing', () => {
    expect(splitSubtaskLines('')).toEqual([]);
  });
});
