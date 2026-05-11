import { loadDbModules, resetDbState } from './helpers';

afterEach(resetDbState);

describe('wipeUserData', () => {
  it('deletes everything in user-data tables but preserves the schema', () => {
    const { core, sessions, blocks, milestones, settings } = loadDbModules();
    sessions.addSession(120);
    blocks.insertScheduledBlock(9, 0, 30, [1], 5);
    milestones.insertMilestone('first_session');
    settings.setSetting('onboardingComplete', '1');
    settings.setDeviceState('lastSync', '123');

    core.wipeUserData();

    expect(sessions.getSessionCount()).toBe(0);
    expect(blocks.getAllScheduledBlocks()).toEqual([]);
    expect(milestones.getAchievedMilestones().size).toBe(0);
    expect(settings.getSetting('onboardingComplete')).toBeNull();
    expect(settings.getDeviceState('lastSync')).toBeNull();
  });

  it('does not drop the migration history (next session-write still uses the schema)', () => {
    const { core } = loadDbModules();
    const db = core.getDb();
    core.wipeUserData();
    const rows = db.getAllSync<{ version: number }>('SELECT version FROM _migrations');
    expect(rows.length).toBe(8);
  });
});
