import {
  TUTORIAL_STEPS,
  TUTORIAL_TOTAL_STEPS,
  getStepDef,
} from '@/lib/tutorial/steps';

describe('TUTORIAL_STEPS', () => {
  it('has every step on a distinct sequential order starting at 1', () => {
    const orders = TUTORIAL_STEPS.map((s) => s.order).sort((a, b) => a - b);
    expect(orders).toEqual([1, 2, 3]);
  });

  it('TUTORIAL_TOTAL_STEPS matches the array length', () => {
    expect(TUTORIAL_TOTAL_STEPS).toBe(TUTORIAL_STEPS.length);
  });

  it('every step has a unique name and non-empty text', () => {
    const names = TUTORIAL_STEPS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of TUTORIAL_STEPS) {
      expect(s.text.length).toBeGreaterThan(0);
    }
  });
});

describe('getStepDef', () => {
  it('returns the matching step by name', () => {
    expect(getStepDef('home.timer')?.order).toBe(1);
    expect(getStepDef('home.journey')?.screen).toBe('home');
  });

  it('returns undefined for unknown or empty names', () => {
    expect(getStepDef('does-not-exist')).toBeUndefined();
    expect(getStepDef(undefined)).toBeUndefined();
  });
});
