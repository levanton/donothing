// react-native Settings.get is forced to 24h in test/jest.setup.ts so
// formatClockTime is locale-independent.
import {
  pad2,
  timerDisplay,
  formatTimeShort,
  formatHeroDuration,
  formatTimeStat,
  clockParts,
  formatClockTime,
  uses24HourClock,
} from '@/lib/format';

describe('pad2', () => {
  it('zero-pads single digits', () => {
    expect(pad2(0)).toBe('00');
    expect(pad2(5)).toBe('05');
  });
  it('keeps two-digit values intact', () => {
    expect(pad2(23)).toBe('23');
  });
});

describe('uses24HourClock', () => {
  it('honours the force-24h setting', () => {
    expect(uses24HourClock()).toBe(true);
  });
});

describe('timerDisplay', () => {
  it('renders zero as 00:00', () => {
    expect(timerDisplay(0)).toBe('00:00');
  });
  it('renders sub-minute values', () => {
    expect(timerDisplay(7)).toBe('00:07');
  });
  it('renders minutes + seconds', () => {
    expect(timerDisplay(125)).toBe('02:05');
  });
  it('renders the cap (60 minutes) cleanly', () => {
    expect(timerDisplay(3600)).toBe('60:00');
  });
});

describe('formatTimeShort', () => {
  it('uses seconds suffix under a minute', () => {
    expect(formatTimeShort(45)).toBe('45s');
  });
  it('drops seconds when they are zero', () => {
    expect(formatTimeShort(120)).toBe('2m');
  });
  it('shows minutes and seconds', () => {
    expect(formatTimeShort(125)).toBe('2m 5s');
  });
  it('shows hours with minutes', () => {
    expect(formatTimeShort(3 * 3600 + 25 * 60)).toBe('3h 25m');
  });
  it('drops minutes when zero hour value', () => {
    expect(formatTimeShort(3600)).toBe('1h');
  });
});

describe('formatHeroDuration', () => {
  it('returns minutes only when below an hour', () => {
    expect(formatHeroDuration(15 * 60)).toEqual([{ value: '15', unit: 'min' }]);
  });
  it('returns hours and minutes', () => {
    expect(formatHeroDuration(2 * 3600 + 49 * 60)).toEqual([
      { value: '2', unit: 'hr' },
      { value: '49', unit: 'min' },
    ]);
  });
  it('returns hr-only when minutes are zero', () => {
    expect(formatHeroDuration(3600)).toEqual([{ value: '1', unit: 'hr' }]);
  });
  it('pluralizes days correctly', () => {
    expect(formatHeroDuration(86400)).toEqual([{ value: '1', unit: 'day' }]);
    expect(formatHeroDuration(2 * 86400)).toEqual([{ value: '2', unit: 'days' }]);
  });
  it('shows day + leftover hours', () => {
    expect(formatHeroDuration(86400 + 5 * 3600)).toEqual([
      { value: '1', unit: 'day' },
      { value: '5', unit: 'hr' },
    ]);
  });
});

describe('formatTimeStat', () => {
  it('renders sub-hour as minutes', () => {
    expect(formatTimeStat(30 * 60)).toEqual({ value: '30', unit: 'min' });
  });
  it('renders whole hours', () => {
    expect(formatTimeStat(3600)).toEqual({ value: '1', unit: 'hr' });
  });
  it('renders hours:minutes for partial hours', () => {
    expect(formatTimeStat(3600 + 5 * 60)).toEqual({ value: '1:05', unit: 'hr' });
  });
  it('renders one day plainly', () => {
    expect(formatTimeStat(86400)).toEqual({ value: '1', unit: 'day' });
  });
  it('renders multi-day with day + hr suffix', () => {
    expect(formatTimeStat(2 * 86400 + 3 * 3600)).toEqual({ value: '2d 3h', unit: '' });
  });
});

describe('clockParts (24h mode)', () => {
  it('zero-pads both hour and minute', () => {
    expect(clockParts(7, 5)).toEqual({ hour: '07', minute: '05', ampm: null });
  });
  it('formats afternoon hours as-is', () => {
    expect(clockParts(14, 30)).toEqual({ hour: '14', minute: '30', ampm: null });
  });
});

describe('formatClockTime (24h mode)', () => {
  it('renders without AM/PM suffix', () => {
    expect(formatClockTime(9, 0)).toBe('09:00');
    expect(formatClockTime(23, 59)).toBe('23:59');
  });
});
