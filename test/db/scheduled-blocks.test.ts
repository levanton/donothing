import { loadDbModules, resetDbState } from './helpers';

afterEach(resetDbState);

describe('insertScheduledBlock', () => {
  it('persists the canonical fields and defaults enabled=true', () => {
    const { blocks } = loadDbModules();
    const b = blocks.insertScheduledBlock(9, 30, 30, [2, 3, 4, 5, 6], 5);
    expect(b.hour).toBe(9);
    expect(b.minute).toBe(30);
    expect(b.durationMinutes).toBe(30);
    expect(b.weekdays).toEqual([2, 3, 4, 5, 6]);
    expect(b.enabled).toBe(true);
    expect(b.unlockGoalMinutes).toBe(5);
  });

  it('normalises an empty weekdays array to every day', () => {
    const { blocks } = loadDbModules();
    const b = blocks.insertScheduledBlock(9, 0, 30, [], 5);
    expect(b.weekdays).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('dedupes and clamps weekdays', () => {
    const { blocks } = loadDbModules();
    const b = blocks.insertScheduledBlock(9, 0, 30, [1, 1, 9, 5, 0], 5);
    expect(b.weekdays).toEqual([1, 5]);
  });

  it('rejects out-of-range time', () => {
    const { blocks } = loadDbModules();
    expect(() => blocks.insertScheduledBlock(24, 0, 30, [1], 5)).toThrow();
  });
});

describe('getAllScheduledBlocks', () => {
  it('returns blocks sorted by (hour, minute)', () => {
    const { blocks } = loadDbModules();
    blocks.insertScheduledBlock(21, 0, 30, [1], 5);
    blocks.insertScheduledBlock(8, 30, 30, [1], 5);
    blocks.insertScheduledBlock(8, 15, 30, [1], 5);
    const all = blocks.getAllScheduledBlocks();
    expect(all.map((b) => [b.hour, b.minute])).toEqual([
      [8, 15],
      [8, 30],
      [21, 0],
    ]);
  });

  it('returns an empty list when there are none', () => {
    const { blocks } = loadDbModules();
    expect(blocks.getAllScheduledBlocks()).toEqual([]);
  });
});

describe('getScheduledBlockById', () => {
  it('returns null for an unknown id', () => {
    const { blocks } = loadDbModules();
    expect(blocks.getScheduledBlockById('does-not-exist')).toBeNull();
  });

  it('returns the inserted row', () => {
    const { blocks } = loadDbModules();
    const inserted = blocks.insertScheduledBlock(7, 0, 60, [2, 3], 5);
    const found = blocks.getScheduledBlockById(inserted.id);
    expect(found?.hour).toBe(7);
    expect(found?.durationMinutes).toBe(60);
  });
});

describe('updateScheduledBlock', () => {
  it('overwrites fields on an existing row', () => {
    const { blocks } = loadDbModules();
    const b = blocks.insertScheduledBlock(9, 0, 30, [1], 5);
    blocks.updateScheduledBlock(b.id, 10, 15, 45, [2, 3], 10);
    const got = blocks.getScheduledBlockById(b.id)!;
    expect(got.hour).toBe(10);
    expect(got.minute).toBe(15);
    expect(got.durationMinutes).toBe(45);
    expect(got.weekdays).toEqual([2, 3]);
    expect(got.unlockGoalMinutes).toBe(10);
  });

  it('throws on invalid input (does not silently drop)', () => {
    const { blocks } = loadDbModules();
    const b = blocks.insertScheduledBlock(9, 0, 30, [1], 5);
    expect(() => blocks.updateScheduledBlock(b.id, 9, 99, 30, [1], 5)).toThrow();
  });
});

describe('toggleScheduledBlock', () => {
  it('flips enabled and returns the new value', () => {
    const { blocks } = loadDbModules();
    const b = blocks.insertScheduledBlock(9, 0, 30, [1], 5);
    expect(b.enabled).toBe(true);
    expect(blocks.toggleScheduledBlock(b.id)).toBe(false);
    expect(blocks.toggleScheduledBlock(b.id)).toBe(true);
  });
});

describe('deleteScheduledBlock', () => {
  it('removes the row', () => {
    const { blocks } = loadDbModules();
    const a = blocks.insertScheduledBlock(9, 0, 30, [1], 5);
    blocks.insertScheduledBlock(12, 0, 30, [1], 5);
    blocks.deleteScheduledBlock(a.id);
    const all = blocks.getAllScheduledBlocks();
    expect(all).toHaveLength(1);
    expect(all[0].hour).toBe(12);
  });
});
