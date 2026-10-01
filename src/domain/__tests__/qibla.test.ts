import {
  angleDelta,
  distanceToKaabaKm,
  headingFromSensors,
  magneticInfo,
  qiblaBearing,
  qualityFromAccuracy,
  qualityFromField,
  smoothHeading,
  turnInstruction,
} from '../qibla';

describe('посока към Кааба', () => {
  it.each([
    ['София', 42.6977, 23.3217, 141.9],
    ['Истанбул', 41.0082, 28.9784, 151.6],
    ['Единбург', 55.9533, -3.1883, 119.5],
    ['Ню Йорк', 40.7128, -74.006, 58.5],
    ['Джакарта', -6.2, 106.85, 295.1],
  ])('%s', (_, lat, lon, expected) => {
    expect(qiblaBearing(lat, lon)).toBeCloseTo(expected, 1);
  });

  it('София – Мека: ~2 820 км', () => {
    expect(Math.round(distanceToKaabaKm(42.6977, 23.3217))).toBeGreaterThan(2810);
    expect(Math.round(distanceToKaabaKm(42.6977, 23.3217))).toBeLessThan(2830);
  });
});

describe('накъде да се завърти', () => {
  it('най-късата посока, и през 0°/360°', () => {
    expect(angleDelta(350, 10)).toBe(20);
    expect(angleDelta(10, 350)).toBe(-20);
    expect(angleDelta(108, 141.9)).toBeCloseTo(33.9);
  });

  it('„Завърти се надясно · 34°“ и „обърнат“ до ±3°', () => {
    expect(turnInstruction(141.9, 108)).toEqual({ degrees: 34, direction: 'right', aligned: false });
    expect(turnInstruction(141.9, 170)).toEqual({ degrees: 28, direction: 'left', aligned: false });
    expect(turnInstruction(141.9, 140).aligned).toBe(true);
    expect(turnInstruction(141.9, 144.5).aligned).toBe(true);
    expect(turnInstruction(141.9, 146).aligned).toBe(false);
  });
});

describe('магнитно поле', () => {
  it('София, 2026: деклинация ~+5,7° (изток), поле ~48 µT', () => {
    const m = magneticInfo(42.6977, 23.3217, new Date(2026, 9, 1));
    expect(m.declination).toBeGreaterThan(5);
    expect(m.declination).toBeLessThan(6.5);
    expect(m.fieldUT).toBeGreaterThan(45);
    expect(m.fieldUT).toBeLessThan(51);
  });

  it('точност по силата на полето', () => {
    expect(qualityFromField(48, 48)).toBe('high');
    expect(qualityFromField(62, 48)).toBe('medium');
    expect(qualityFromField(110, 48)).toBe('low');
    expect(qualityFromField(20, 48)).toBe('low');
  });

  it('точност на iPhone в градуси', () => {
    expect(qualityFromAccuracy(10)).toBe('high');
    expect(qualityFromAccuracy(25)).toBe('medium');
    expect(qualityFromAccuracy(45)).toBe('low');
    expect(qualityFromAccuracy(-1)).toBe('low');
  });
});

describe('посока от сензорите (оси на Android)', () => {
  // Северното полукълбо: полето сочи на север и надолу (z на Земята).
  // Телефонът лежи по гръб: акселерометърът показва +g по z.
  const flat = { x: 0, y: 0, z: 1 };
  const field = (headingDeg: number) => {
    // полето в осите на телефона, когато горният край сочи headingDeg от магнитния север
    const r = (headingDeg * Math.PI) / 180;
    const north = 20; // хоризонтална съставка, µT
    return { x: -north * Math.sin(r), y: north * Math.cos(r), z: -44 };
  };

  it.each([0, 45, 90, 141.9, 180, 270, 359])('телефонът гледа на %f° – същата посока от сензорите', (h) => {
    const got = headingFromSensors(flat, field(h))!;
    expect(Math.abs(angleDelta(got, h))).toBeLessThan(0.01);
  });

  it('наклонен телефон (25° напред) – посоката остава същата', () => {
    const t = (25 * Math.PI) / 180;
    // завъртане около x: гравитацията и полето се завъртат заедно
    const rot = (v: { x: number; y: number; z: number }) => ({
      x: v.x,
      y: v.y * Math.cos(t) - v.z * Math.sin(t),
      z: v.y * Math.sin(t) + v.z * Math.cos(t),
    });
    const got = headingFromSensors(rot(flat), rot(field(141.9)))!;
    expect(Math.abs(angleDelta(got, 141.9))).toBeLessThan(0.01);
  });

  it('без гравитация (свободно падане) – няма посока', () => {
    expect(headingFromSensors({ x: 0, y: 0, z: 0 }, field(90))).toBeNull();
  });

  it('изглаждането минава през 0°/360° по късия път', () => {
    expect(smoothHeading(355, 5, 0.5)).toBeCloseTo(0, 5);
    expect(smoothHeading(null, 123)).toBe(123);
  });
});
