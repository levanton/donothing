import { loadDbModules, resetDbState } from './helpers';

afterEach(resetDbState);

describe('milestones-db', () => {
  it('starts empty', () => {
    const { milestones } = loadDbModules();
    expect(milestones.getAchievedMilestones().size).toBe(0);
    expect(milestones.isMilestoneAchieved('first_session')).toBe(false);
  });

  it('insertMilestone persists with achieved_at = now', () => {
    const { milestones } = loadDbModules();
    const before = Date.now();
    milestones.insertMilestone('first_session');
    const after = Date.now();

    const map = milestones.getAchievedMilestones();
    expect(map.has('first_session')).toBe(true);
    const ts = map.get('first_session')!;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
    expect(milestones.isMilestoneAchieved('first_session')).toBe(true);
  });

  it('insertMilestone is idempotent (ON CONFLICT DO NOTHING)', () => {
    const { milestones } = loadDbModules();
    milestones.insertMilestone('streak_3');
    const firstTs = milestones.getAchievedMilestones().get('streak_3');
    milestones.insertMilestone('streak_3');
    const secondTs = milestones.getAchievedMilestones().get('streak_3');
    expect(secondTs).toBe(firstTs);
    expect(milestones.getAchievedMilestones().size).toBe(1);
  });
});
