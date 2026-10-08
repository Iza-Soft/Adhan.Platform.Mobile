import AsyncStorage from '@react-native-async-storage/async-storage';

import { cacheCovers, overpassQuery, parseOverpass, privacyArea, type Mosque } from '@/domain/mosques';

/**
 * Джамиите наблизо (етап 12) – мрежата и кешът.
 *
 * - Overpass API (OpenStreetMap): overpass.private.coffee и overpass-api.de (претоварен от 2026 г.).
 *   Пита първия; ако до 5 сек. няма отговор (или веднага даде грешка) – пита и втория,
 *   и взима който отговори пръв.
 * - „Няма интернет“ само когато наистина няма връзка; бавен или претоварен сървър е „Сървърът не отговаря“.
 * - До сървъра отива само закръглено място (~1 км) – виж privacyArea.
 * - Кеш в паметта на телефона: последните търсения за 24 ч. Без интернет се показва
 *   последното търсене за района, колкото и старо да е (с часа му).
 * - Пазят се само нужните тагове (име, арабско име, адрес) – в Истанбул до 10 км са стотици джамии.
 */

// без ограничение на заявките (wiki.openstreetmap.org/wiki/Overpass_API) – затова е първи
const ENDPOINTS = ['https://overpass.private.coffee/api/interpreter', 'https://overpass-api.de/api/interpreter'];
const CACHE_KEY = 'ezan.mosques.v1';
/** Колко чакаме един сървър (заявката е с [timeout:15]). */
const TIMEOUT_MS = 18_000;
/** След толкова без отговор питаме и следващия сървър, без да спираме първия. */
const HEDGE_MS = 5_000;
const MAX_ENTRIES = 3;
/** По-често от това не питаме сървъра за същия район (Overpass е безплатен – да не го натоварваме). */
const MIN_INTERVAL_MS = 60_000;
const USER_AGENT = 'Hayya/1.0 (com.ilkoadamov.hayya; prayer times app)';

const KEEP_TAGS = /^(name(:(bg|en|tr|ar))?|addr:(street|housenumber|suburb|district|city|place))$/;

interface RawElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface CacheEntry {
  /** Закръгленият център и радиусът на заявката (с +1,5 км). */
  lat: number;
  lon: number;
  radiusM: number;
  at: number;
  elements: RawElement[];
}

export interface MosquesResult {
  mosques: Mosque[];
  /** Кога са взети данните от сървъра. */
  at: number;
  /** Без връзка – показва се старо търсене. */
  offline: boolean;
}

export type MosquesError = 'offline' | 'server';

export class MosquesFetchError extends Error {
  constructor(public reason: MosquesError) {
    super(reason);
  }
}

let memory: CacheEntry[] | null = null;
let lastRequest = 0;
const inFlight = new Map<string, Promise<CacheEntry>>();

async function readCache(): Promise<CacheEntry[]> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CacheEntry[]) : [];
    memory = Array.isArray(parsed) ? parsed : [];
  } catch {
    memory = [];
  }
  return memory;
}

async function writeCache(entry: CacheEntry): Promise<void> {
  const list = await readCache();
  // по-новото търсене за същия район замества старото
  const rest = list.filter((e) => !(e.lat === entry.lat && e.lon === entry.lon && e.radiusM <= entry.radiusM));
  memory = [entry, ...rest].slice(0, MAX_ENTRIES);
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(memory));
  } catch {
    // паметта е пълна – остава само в RAM до затваряне на приложението
  }
}

function slim(elements: RawElement[]): RawElement[] {
  return elements.map((e) => {
    const tags: Record<string, string> = {};
    for (const [k, v] of Object.entries(e.tags ?? {})) if (KEEP_TAGS.test(k)) tags[k] = v;
    const out: RawElement = { type: e.type, id: e.id, tags };
    if (typeof e.lat === 'number') {
      out.lat = e.lat;
      out.lon = e.lon;
    } else if (e.center) out.center = e.center;
    return out;
  });
}

/**
 * Една заявка към един сървър. `cancel` – друг сървър вече е отговорил.
 * Грешки: 'offline' – заявката изобщо не стигна (няма връзка); 'server' – сървърът
 * отговори с грешка, с нещо различно от JSON или не отговори навреме.
 */
async function post(url: string, query: string, cancel: AbortSignal): Promise<RawElement[]> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  const onCancel = () => controller.abort();
  cancel.addEventListener('abort', onCancel);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!res.ok) throw new MosquesFetchError('server');
    let json: { elements?: RawElement[]; remark?: string };
    try {
      json = (await res.json()) as typeof json;
    } catch {
      // претоварен сървър връща HTML страница вместо JSON
      throw new MosquesFetchError('server');
    }
    // „runtime error: Query timed out“ идва с код 200 и празен списък – това е грешка, не „няма джамии“
    if (!Array.isArray(json.elements) || (json.remark && json.elements.length === 0)) {
      throw new MosquesFetchError('server');
    }
    return json.elements;
  } catch (e) {
    if (e instanceof MosquesFetchError) throw e;
    // изтеклото време е бавен сървър, не липса на интернет; „Network request failed“ – няма връзка
    throw new MosquesFetchError(timedOut ? 'server' : 'offline');
  } finally {
    clearTimeout(timer);
    cancel.removeEventListener('abort', onCancel);
  }
}

/**
 * Пита сървърите „на стълба“: първия веднага, следващия – след HEDGE_MS или щом предишният
 * даде грешка. Първият успешен отговор печели, останалите заявки се спират.
 * Ако всички се провалят: 'server', ако поне един е отговорил (значи има интернет), иначе 'offline'.
 */
function fetchFirst(query: string): Promise<RawElement[]> {
  return new Promise((resolve, reject) => {
    const cancel = new AbortController();
    const errors: MosquesError[] = [];
    let started = 0;
    let done = false;
    let hedge: ReturnType<typeof setTimeout> | undefined;

    const startNext = () => {
      if (done || started >= ENDPOINTS.length) return;
      const url = ENDPOINTS[started++];
      clearTimeout(hedge);
      if (started < ENDPOINTS.length) hedge = setTimeout(startNext, HEDGE_MS);
      post(url, query, cancel.signal).then(
        (elements) => {
          if (done) return;
          done = true;
          clearTimeout(hedge);
          cancel.abort();
          resolve(elements);
        },
        (e: unknown) => {
          if (done) return;
          errors.push(e instanceof MosquesFetchError ? e.reason : 'offline');
          if (errors.length === ENDPOINTS.length) {
            done = true;
            clearTimeout(hedge);
            reject(new MosquesFetchError(errors.includes('server') ? 'server' : 'offline'));
          } else if (started === errors.length) {
            startNext();
          }
        },
      );
    };
    startNext();
  });
}

async function download(lat: number, lon: number, radiusM: number): Promise<CacheEntry> {
  const area = privacyArea(lat, lon, radiusM);
  const query = overpassQuery(lat, lon, radiusM);
  lastRequest = Date.now();
  const elements = await fetchFirst(query);
  const entry: CacheEntry = { ...area, at: Date.now(), elements: slim(elements) };
  await writeCache(entry);
  return entry;
}

function toResult(entry: CacheEntry, lang: string, offline: boolean): MosquesResult {
  return { mosques: parseOverpass(entry, lang), at: entry.at, offline };
}

/**
 * Джамиите около точката до `radiusM`.
 * 1. Пресен кеш (до 24 ч.) за района → от него, без мрежа.
 * 2. Иначе – от Overpass (и в кеша).
 * 3. Без връзка / грешка на сървъра → последното търсене за района, колкото и старо да е.
 * 4. Няма и такова → MosquesFetchError ('offline' или 'server').
 * `force` – „Опитай пак“: пропуска кеша (но не по-често от веднъж на минута).
 */
export async function loadMosques(
  lat: number,
  lon: number,
  radiusM: number,
  lang: string,
  force = false,
): Promise<MosquesResult> {
  const now = Date.now();
  const cache = await readCache();
  const fresh = cache.find((e) => cacheCovers(e, lat, lon, radiusM, now));
  const tooSoon = now - lastRequest < MIN_INTERVAL_MS;
  if (fresh && (!force || tooSoon)) return toResult(fresh, lang, false);

  const area = privacyArea(lat, lon, radiusM);
  const key = `${area.lat},${area.lon},${area.radiusM}`;
  let job = inFlight.get(key);
  if (!job) {
    job = download(lat, lon, radiusM).finally(() => inFlight.delete(key));
    inFlight.set(key, job);
  }
  try {
    return toResult(await job, lang, false);
  } catch (e) {
    const old = cache.find((x) => cacheCovers(x, lat, lon, radiusM, now, Infinity));
    if (old) return toResult(old, lang, true);
    throw e;
  }
}

/** Последното търсене около точката (за мигновено показване, докато се зарежда новото). */
export async function cachedMosques(lat: number, lon: number, radiusM: number, lang: string): Promise<MosquesResult | null> {
  const cache = await readCache();
  const old = cache.find((x) => cacheCovers(x, lat, lon, radiusM, Date.now(), Infinity));
  return old ? toResult(old, lang, false) : null;
}
