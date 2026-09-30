import { nameFromAddress } from '../abroadName';

const lines = (a: Parameters<typeof nameFromAddress>[0]) => {
  const n = nameFromAddress(a);
  return n ? [n.names.bg, n.detail?.bg ?? ''] : null;
};

describe('име на мястото извън България', () => {
  it('Истанбул (Android връща района като град) → İstanbul / Fatih, Türkiye', () => {
    expect(
      lines({ city: 'Fatih', district: 'Sultanahmet', subregion: 'Fatih', region: 'İstanbul', country: 'Türkiye', isoCountryCode: 'TR' }),
    ).toEqual(['İstanbul', 'Fatih, Türkiye']);
  });

  it('Истанбул (iOS връща града) → İstanbul / Kadıköy, Türkiye', () => {
    expect(
      lines({ city: 'Istanbul', district: 'Moda', subregion: 'Kadıköy', region: 'İstanbul', country: 'Türkiye', isoCountryCode: 'TR' }),
    ).toEqual(['İstanbul', 'Kadıköy, Türkiye']);
  });

  it('Одрин – централният район „Merkez“ не се показва → Edirne / Türkiye', () => {
    expect(
      lines({ city: 'Edirne', subregion: 'Merkez', region: 'Edirne', country: 'Türkiye', isoCountryCode: 'TR' }),
    ).toEqual(['Edirne', 'Türkiye']);
    expect(lines({ city: 'Edirne', region: 'Edirne', country: 'Türkiye', isoCountryCode: 'TR' })).toEqual([
      'Edirne',
      'Türkiye',
    ]);
  });

  it('Единбург – районът е кварталът; „City of Edinburgh“ не се повтаря', () => {
    expect(
      lines({ city: 'Edinburgh', district: 'Leith', subregion: 'City of Edinburgh', region: 'Scotland', country: 'United Kingdom', isoCountryCode: 'GB' }),
    ).toEqual(['Edinburgh', 'Leith, United Kingdom']);
    expect(
      lines({ city: 'Edinburgh', subregion: 'City of Edinburgh', region: 'Scotland', country: 'United Kingdom', isoCountryCode: 'GB' }),
    ).toEqual(['Edinburgh', 'United Kingdom']);
  });

  it('без град (извън населено място) → окръгът, после областта', () => {
    expect(lines({ subregion: 'Highland', region: 'Scotland', country: 'United Kingdom', isoCountryCode: 'GB' })).toEqual([
      'Highland',
      'United Kingdom',
    ]);
    expect(lines({ region: 'Scotland', country: 'United Kingdom' })).toEqual(['Scotland', 'United Kingdom']);
  });

  it('празен отговор → null (показват се координатите)', () => {
    expect(nameFromAddress(null)).toBeNull();
    expect(nameFromAddress({ country: 'Türkiye' })).toBeNull();
  });
});
