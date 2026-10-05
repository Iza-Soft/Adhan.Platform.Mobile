import {
  bearingDeg,
  cacheCovers,
  FAR_RADIUS_M,
  formatDistance,
  NEAR_RADIUS_M,
  nearMosques,
  overpassQuery,
  parseOverpass,
  privacyArea,
  travelMinutes,
} from '../mosques';
import { modeFor, navApp, navAppsFor, navUrl, storeUrl } from '../navApps';

// Еминьоню, Истанбул – като в mockup-а
const ME = { lat: 41.0165, lon: 28.9749 };

const overpass = {
  elements: [
    { type: 'way', id: 1, center: { lat: 41.0171, lon: 28.9715 }, tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'Yeni Cami', 'name:ar': 'الجامع الجديد', 'addr:street': 'Yeni Cami Cd.', 'addr:housenumber': '3', 'addr:district': 'Fatih' } },
    { type: 'way', id: 2, center: { lat: 41.0161, lon: 28.9640 }, tags: { name: 'Süleymaniye Camii', 'name:bg': 'Сюлеймание' } },
    { type: 'node', id: 3, lat: 41.0054, lon: 28.9768, tags: { name: 'Sultanahmet Camii', 'name:ar': 'Sultanahmet Camii' } },
    { type: 'node', id: 4, lat: 41.04, lon: 28.99, tags: {} },
    { type: 'node', id: 5, tags: { name: 'без координати' } },
    { type: 'way', id: 1, center: { lat: 41.0171, lon: 28.9715 }, tags: { name: 'Yeni Cami' } },
  ],
};

describe('джамии – заявката и поверителността', () => {
  it('до Overpass отива закръглено място (~1 км) и по-голям радиус', () => {
    const a = privacyArea(41.016512, 28.974931, NEAR_RADIUS_M);
    expect(a).toEqual({ lat: 41.02, lon: 28.97, radiusM: 3500 });
    const q = overpassQuery(41.016512, 28.974931, NEAR_RADIUS_M);
    expect(q).toContain('(around:3500,41.02,28.97)');
    expect(q).toContain('["amenity"="place_of_worship"]["religion"="muslim"]');
    expect(q).not.toContain('41.0165');
  });
});

describe('джамии – отговорът на Overpass', () => {
  const list = parseOverpass(overpass, 'bg');

  it('име на езика на приложението, иначе местното; без име – null', () => {
    expect(list.map((m) => m.name)).toEqual(['Yeni Cami', 'Сюлеймание', 'Sultanahmet Camii', null]);
  });

  it('арабското име, адресът, точката на сградата; без дублирани и без координати', () => {
    expect(list).toHaveLength(4);
    expect(list[0]).toMatchObject({ id: 'way/1', arabic: 'الجامع الجديد', address: 'Yeni Cami Cd. 3, Fatih', lat: 41.0171 });
    expect(list[2].arabic).toBeNull(); // същото като името – не се повтаря
    expect(list[3].address).toBeNull();
  });

  it('счупен отговор → празен списък', () => {
    expect(parseOverpass(null, 'bg')).toEqual([]);
    expect(parseOverpass({ remark: 'timeout' }, 'en')).toEqual([]);
  });
});

describe('джамии – разстояние, посока, време', () => {
  const all = parseOverpass(overpass, 'en');

  it('подредени по разстояние, само до радиуса', () => {
    const near = nearMosques(all, ME.lat, ME.lon, NEAR_RADIUS_M);
    expect(near.map((m) => m.name)).toEqual(['Yeni Cami', 'Süleymaniye Camii', 'Sultanahmet Camii']);
    expect(near[0].distanceM).toBeGreaterThan(250);
    expect(near[0].distanceM).toBeLessThan(350);
    expect(nearMosques(all, ME.lat, ME.lon, FAR_RADIUS_M)).toHaveLength(4);
  });

  it('пеша до 2,5 км, с кола над това', () => {
    const far = nearMosques(all, ME.lat, ME.lon, FAR_RADIUS_M);
    expect(far[0].mode).toBe('walk');
    expect(far[3].mode).toBe('drive');
    expect(travelMinutes(350, 'walk')).toBe(6);
    expect(travelMinutes(6000, 'drive')).toBe(16);
  });

  it('посоката от север', () => {
    expect(Math.round(bearingDeg(41, 29, 42, 29))).toBe(0);
    expect(Math.round(bearingDeg(41, 29, 41, 30))).toBe(90);
    expect(Math.round(bearingDeg(41, 29, 40, 29))).toBe(180);
  });

  it('разстоянието на трите езика', () => {
    expect(formatDistance(347, 'bg')).toBe('350 м');
    expect(formatDistance(1420, 'bg')).toBe('1,4 км');
    expect(formatDistance(1420, 'en')).toBe('1.4 km');
    expect(formatDistance(1420, 'tr')).toBe('1,4 km');
    expect(formatDistance(12400, 'bg')).toBe('12 км');
  });

  it('кешът важи за същия район, радиус и до 24 ч.', () => {
    const area = privacyArea(ME.lat, ME.lon, NEAR_RADIUS_M);
    const cache = { ...area, at: 0 };
    expect(cacheCovers(cache, ME.lat, ME.lon, NEAR_RADIUS_M, 3600_000)).toBe(true);
    expect(cacheCovers(cache, ME.lat, ME.lon, FAR_RADIUS_M, 3600_000)).toBe(false);
    expect(cacheCovers(cache, 41.2, 29.1, NEAR_RADIUS_M, 3600_000)).toBe(false);
    expect(cacheCovers(cache, ME.lat, ME.lon, NEAR_RADIUS_M, 25 * 3600_000)).toBe(false);
  });
});

describe('навигация – приложенията и връзките', () => {
  const to = { lat: 41.0171, lon: 28.9715, name: 'Yeni Cami' };
  const from = { lat: ME.lat, lon: ME.lon, name: 'My location' };

  it('списъкът според телефона', () => {
    expect(navAppsFor('android').map((a) => a.id)).toEqual(['auto', 'google', 'waze', 'here', 'petal', 'organic']);
    expect(navAppsFor('ios').map((a) => a.id)).toEqual(['auto', 'google', 'waze', 'here', 'organic']);
  });

  it('Waze – винаги с кола', () => {
    expect(modeFor('waze', 'walk')).toBe('drive');
    expect(modeFor('google', 'walk')).toBe('walk');
    expect(navApp('waze').walking).toBe(false);
  });

  it('връзките', () => {
    expect(navUrl('google', 'android', to, 'walk')).toBe('google.navigation:q=41.017100,28.971500&mode=w');
    expect(navUrl('google', 'ios', to, 'drive')).toBe('comgooglemaps://?daddr=41.017100,28.971500&directionsmode=driving');
    expect(navUrl('waze', 'android', to, 'drive')).toBe('https://waze.com/ul?ll=41.017100,28.971500&navigate=yes&utm_source=ezan');
    expect(navUrl('here', 'android', to, 'walk')).toBe('https://share.here.com/r/mylocation/41.017100,28.971500,Yeni%20Cami?m=w');
    expect(navUrl('petal', 'android', to, 'walk')).toContain('petalmaps://route?daddr=41.017100,28.971500&type=walk&coordinateType=0');
    expect(navUrl('organic', 'android', to, 'walk', from)).toBe(
      'om://route?sll=41.016500,28.974900&saddr=My%20location&dll=41.017100,28.971500&daddr=Yeni%20Cami&type=pedestrian',
    );
    expect(navUrl('auto', 'android', to, 'walk')).toBe('geo:0,0?q=41.017100,28.971500(Yeni%20Cami)');
    expect(navUrl('auto', 'ios', to, 'walk')).toBe('https://maps.apple.com/directions?destination=41.017100,28.971500&mode=walking');
  });

  it('магазините', () => {
    expect(storeUrl(navApp('waze'), 'android')).toBe('market://details?id=com.waze');
    expect(storeUrl(navApp('organic'), 'ios')).toBe('https://apps.apple.com/app/id1567437057');
    expect(storeUrl(navApp('auto'), 'android')).toBeNull();
  });
});
