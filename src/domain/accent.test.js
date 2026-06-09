import { cardAccent } from './accent';

describe('cardAccent', () => {
  test('falls back to a neutral accent when the card has no color', () => {
    const a = cardAccent(null);
    expect(a.neutral).toBe(true);
  });

  test('uses the given hex as the solid color and is not neutral', () => {
    const a = cardAccent('#93c5fd');
    expect(a.neutral).toBe(false);
    expect(a.solid).toBe('#93c5fd');
  });

  test('derives a darker text shade from the base via color-mix', () => {
    const a = cardAccent('#93c5fd');
    expect(a.text).toContain('color-mix');
    expect(a.text).toContain('#93c5fd');
  });
});
