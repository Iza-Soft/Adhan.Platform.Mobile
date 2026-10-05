import { pickName, resolveLang } from '@/i18n';
import { bg, en } from '@/i18n/strings';
import { tr } from '@/i18n/tr';
import { PHASE_GRADIENTS } from '@/theme/gradients';

import { BUILTIN_SOUNDS } from '../sounds';
import { defaultPlace, getPlace, placeToLocation, searchPlaces } from '../places';
import { locationFromCoords } from '../resolve';
import { widgetEntryAt } from '../widget';

/** Всички листа (текстове и функции) на обекта с текстовете – с пътя им. */
function leaves(o: unknown, path = ''): string[] {
  if (typeof o === 'string' || typeof o === 'function') return [path];
  if (Array.isArray(o)) return o.flatMap((x, i) => leaves(x, `${path}[${i}]`));
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [path];
}

describe('турски език – кой език', () => {
  it('телефонът на турски → турски; български → български; другите → английски', () => {
    expect(resolveLang('tr')).toBe('tr');
    expect(resolveLang('TR')).toBe('tr');
    expect(resolveLang('bg')).toBe('bg');
    expect(resolveLang('de')).toBe('en');
    expect(resolveLang(undefined)).toBe('en');
  });

  it('име без турски вариант → английското', () => {
    expect(pickName({ bg: 'София', en: 'Sofia', tr: 'Sofya' }, 'tr')).toBe('Sofya');
    expect(pickName({ bg: 'Чепинци', en: 'Chepintsi' }, 'tr')).toBe('Chepintsi');
    expect(pickName({ bg: 'Чепинци', en: 'Chepintsi' }, 'bg')).toBe('Чепинци');
  });
});

describe('турски език – текстовете', () => {
  it('има същите ключове като българския и английския', () => {
    expect(leaves(tr).sort()).toEqual(leaves(bg).sort());
    expect(leaves(tr).sort()).toEqual(leaves(en).sort());
  });

  it('имената на молитвите и месеците – както в календара на Диянет', () => {
    expect(Object.values(tr.prayers)).toEqual(['İmsak', 'Güneş', 'Öğle', 'İkindi', 'Akşam', 'Yatsı']);
    expect(tr.hijriMonths[8]).toBe('Ramazan');
    expect(tr.date.weekdaysShort[5]).toBe('Cum');
  });

  it('изреченията с името на молитвата не искат турски наставки', () => {
    expect(tr.alarm.title(tr.prayers.asr)).toBe('İkindi vakti');
    expect(tr.widget.until(tr.prayers.maghrib)).toBe('Akşam vaktine kalan');
    expect(tr.notifications.reminderTitle(tr.prayers.isha, 10, '20:32')).toBe('Yatsı vaktine 10 dk – 20:32');
  });

  it('всички вградени звуци имат турско име', () => {
    for (const s of BUILTIN_SOUNDS) expect(s.names.tr).toBeTruthy();
  });
});

describe('турски език – местата', () => {
  it('градовете в България – с традиционното турско име', () => {
    const kardzhali = searchPlaces('Кърджали')[0];
    const loc = placeToLocation(kardzhali);
    expect(loc.names.tr).toBe('Kırcaali');
    expect(loc.detail?.tr).toBe('Kırcaali ili');
    expect(placeToLocation(defaultPlace()).names.tr).toBe('Sofya');
  });

  it('село – латиницата и турско уточнение за общината и областта', () => {
    const loc = locationFromCoords(41.4352, 24.869); // Чепинци
    expect(loc.names.tr).toBeUndefined();
    expect(loc.detail?.tr).toMatch(/ili$/);
  });

  it('търсенето намира града и по турското име – със и без турските букви', () => {
    expect(searchPlaces('Kırcaali')[0].name).toBe('Кърджали');
    expect(searchPlaces('kircaali')[0].name).toBe('Кърджали');
    expect(searchPlaces('Şumnu')[0].name).toBe('Шумен');
    expect(searchPlaces('islimiye')[0].name).toBe('Сливен');
    expect(searchPlaces('Filibe')[0].name).toBe('Пловдив');
  });

  it('widget-ът на турски', () => {
    const now = new Date(2026, 9, 5, 15, 20, 15);
    const e = widgetEntryAt(now, {
      options: { location: locationFromCoords(42.6977, 23.3219), method: 'Turkey', madhab: 'shafi' },
      placeName: 'Sofya',
      texts: { prayers: tr.prayers, ...tr.hero, ...tr.widget },
      gradients: PHASE_GRADIENTS,
    });
    expect(e.place).toBe('SOFYA');
    expect(e.nextName).toBe('İkindi');
    expect(e.atText).toBe('saat 16:33');
    expect(e.untilText).toBe('İkindi vaktine kalan');
  });

  it('getPlace връща същото място по индекс (за миграцията на запазените места)', () => {
    const p = defaultPlace();
    expect(getPlace(p.index).name).toBe('София');
  });
});
