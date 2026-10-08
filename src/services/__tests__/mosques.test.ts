/* eslint-disable @typescript-eslint/no-require-imports */
import AsyncStorage from '@react-native-async-storage/async-storage';

// jest.mock се изпълнява преди import-ите (babel-jest го премества най-отгоре)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

type Service = typeof import('../mosques');

const ME = { lat: 41.0165, lon: 28.9749 };
const BODY = {
  elements: [
    {
      type: 'way',
      id: 1,
      center: { lat: 41.0171, lon: 28.9715 },
      tags: { name: 'Yeni Cami', 'name:ar': 'الجامع الجديد', 'addr:street': 'Yeni Cami Cd.', wikidata: 'Q1', building: 'mosque' },
    },
  ],
};

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const status = (code: number) => Promise.resolve({ ok: false, status: code, json: () => Promise.resolve({}) });
const offline = () => Promise.reject(new TypeError('Network request failed'));
const html = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('Unexpected token <')) });
/** Сървър, който мълчи, докато заявката не бъде спряна (AbortController). */
const silent = (_url: string, init: { signal: AbortSignal }) =>
  new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('Aborted'))));

let fetchMock: jest.Mock;
let service: Service;

beforeEach(async () => {
  await AsyncStorage.clear();
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  // кешът в паметта и броячът на заявките – наново за всеки тест
  jest.isolateModules(() => {
    service = require('../mosques');
  });
});

afterEach(() => jest.useRealTimers());

describe('джамии – мрежата и кешът', () => {
  it('сваля, пази в кеша и втория път не ходи до сървъра', async () => {
    fetchMock.mockImplementation(() => ok(BODY));
    const a = await service.loadMosques(ME.lat, ME.lon, 2000, 'bg');
    expect(a.mosques[0]).toMatchObject({ name: 'Yeni Cami', arabic: 'الجامع الجديد' });
    expect(a.offline).toBe(false);
    const b = await service.loadMosques(ME.lat, ME.lon, 2000, 'en');
    expect(b.mosques).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('до сървъра отиват само закръглени координати', async () => {
    fetchMock.mockImplementation(() => ok(BODY));
    await service.loadMosques(ME.lat, ME.lon, 2000, 'bg');
    const body = decodeURIComponent(fetchMock.mock.calls[0][1].body);
    expect(body).toContain('[bbox:40.9886,28.9283,41.0514,29.0117]');
    expect(body).not.toContain('41.0165');
  });

  it('в кеша остават само нужните тагове', async () => {
    fetchMock.mockImplementation(() => ok(BODY));
    await service.loadMosques(ME.lat, ME.lon, 2000, 'bg');
    const saved = await AsyncStorage.getItem('ezan.mosques.v1');
    expect(saved).toContain('Yeni Cami Cd.');
    expect(saved).not.toContain('wikidata');
  });

  it('претоварен първи сървър → вторият', async () => {
    fetchMock.mockImplementationOnce(() => status(504)).mockImplementationOnce(() => ok(BODY));
    const r = await service.loadMosques(ME.lat, ME.lon, 2000, 'bg');
    expect(r.mosques).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toContain('private.coffee');
    expect(fetchMock.mock.calls[1][0]).toContain('overpass-api.de');
  });

  it('бавен първи сървър → след 5 сек. пита и втория и взима неговия отговор', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementationOnce(silent).mockImplementationOnce(() => ok(BODY));
    const job = service.loadMosques(ME.lat, ME.lon, 2000, 'bg');
    await jest.advanceTimersByTimeAsync(4_900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(200);
    const r = await job;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.mosques).toHaveLength(1);
    // първата заявка е спряна
    expect((fetchMock.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
  });

  it('и двата сървъра мълчат → „Сървърът не отговаря“, а не „Няма интернет“', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(silent);
    const job = service.loadMosques(ME.lat, ME.lon, 2000, 'bg');
    const check = expect(job).rejects.toMatchObject({ reason: 'server' });
    await jest.advanceTimersByTimeAsync(30_000);
    await check;
  });

  it('HTML вместо JSON (претоварен сървър) → „server“', async () => {
    fetchMock.mockImplementation(html);
    await expect(service.loadMosques(ME.lat, ME.lon, 2000, 'bg')).rejects.toMatchObject({ reason: 'server' });
  });

  it('единият без връзка, другият с грешка → „server“ (интернет има)', async () => {
    fetchMock.mockImplementationOnce(offline).mockImplementationOnce(() => status(429));
    await expect(service.loadMosques(ME.lat, ME.lon, 2000, 'bg')).rejects.toMatchObject({ reason: 'server' });
  });

  it('„Query timed out“ с код 200 е грешка, а не „няма джамии“', async () => {
    fetchMock.mockImplementation(() => ok({ elements: [], remark: 'runtime error: Query timed out' }));
    await expect(service.loadMosques(ME.lat, ME.lon, 2000, 'bg')).rejects.toMatchObject({ reason: 'server' });
  });

  it('без интернет и без кеш → грешка „offline“', async () => {
    fetchMock.mockImplementation(offline);
    await expect(service.loadMosques(ME.lat, ME.lon, 2000, 'bg')).rejects.toMatchObject({ reason: 'offline' });
  });

  it('без интернет – старото търсене (и по-старо от 24 ч.) с отметка offline', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-01T12:00:00Z'), doNotFake: ['setTimeout', 'clearTimeout'] });
    fetchMock.mockImplementation(() => ok(BODY));
    await service.loadMosques(ME.lat, ME.lon, 2000, 'bg');

    jest.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    fetchMock.mockImplementation(offline);
    const r = await service.loadMosques(ME.lat, ME.lon, 2000, 'bg');
    expect(r.offline).toBe(true);
    expect(r.mosques).toHaveLength(1);
    expect(new Date(r.at).toISOString()).toBe('2026-10-01T12:00:00.000Z');
  });

  it('кешът за 2 км не важи за 10 км', async () => {
    fetchMock.mockImplementation(() => ok(BODY));
    await service.loadMosques(ME.lat, ME.lon, 2000, 'bg');
    await service.loadMosques(ME.lat, ME.lon, 10000, 'bg');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 10 + 1,5 км около 41.02 → ± 0,1033°
    expect(decodeURIComponent(fetchMock.mock.calls[1][1].body)).toContain('[bbox:40.9167,');
  });
});
