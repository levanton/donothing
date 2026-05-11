import {
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  WEEKDAY_VALUES,
  ALL_DAYS,
} from '@/lib/weekdays';

describe('weekdays', () => {
  it('labels and short labels are aligned 1:1 in Mon→Sun order', () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
    expect(WEEKDAY_SHORT).toHaveLength(7);
    expect(WEEKDAY_LABELS[0]).toBe('Mon');
    expect(WEEKDAY_SHORT[0]).toBe('Mo');
    expect(WEEKDAY_LABELS[6]).toBe('Sun');
    expect(WEEKDAY_SHORT[6]).toBe('Su');
  });

  it('values map Mon→Sun to Expo weekday numbers (1=Sun..7=Sat)', () => {
    expect(WEEKDAY_VALUES).toEqual([2, 3, 4, 5, 6, 7, 1]);
  });

  it('ALL_DAYS covers every weekday number exactly once', () => {
    expect([...ALL_DAYS].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
