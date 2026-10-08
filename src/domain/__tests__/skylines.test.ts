import { DEFAULT_SKYLINE, SKYLINE_IDS, SKYLINE_PATHS, skylineOf } from '../skylines';

describe('силуетите зад часовника', () => {
  it('по подразбиране е куполът с две минарета и е първи в списъка', () => {
    expect(DEFAULT_SKYLINE).toBe('dome');
    expect(SKYLINE_IDS[0]).toBe('dome');
  });

  it('всеки силует е затворен път в 360×80, със земята отдолу', () => {
    for (const id of SKYLINE_IDS) {
      const d = SKYLINE_PATHS[id];
      expect(d.startsWith('M0 80')).toBe(true);
      expect(d.endsWith('Z')).toBe(true);
      const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...nums)).toBeLessThanOrEqual(360);
    }
  });

  it('непозната или стара стойност (напр. махнатата Кааба) → по подразбиране', () => {
    expect(skylineOf('kaaba')).toBe('dome');
    expect(skylineOf(undefined)).toBe('dome');
    expect(skylineOf('aqsa')).toBe('aqsa');
  });
});
