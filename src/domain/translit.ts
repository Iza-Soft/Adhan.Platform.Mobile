/**
 * Официалната транслитерация на български (Закон за транслитерацията, 2009):
 * „Чепинци“ → „Chepintsi“, „Кърджали“ → „Kardzhali“, „-ия“ в края на думата → „-ia“.
 * Ползва се за имената на градовете на английски и за търсене с латиница.
 */
const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: 'y', ю: 'yu', я: 'ya',
};

/** Имена с утвърдено английско изписване, различно от правилото. */
const EXCEPTIONS: Record<string, string> = { София: 'Sofia' };

function word(w: string): string {
  const lower = w.toLowerCase();
  let out = '';
  for (const ch of lower) out += MAP[ch] ?? ch;
  if (lower.endsWith('ия')) out = out.slice(0, -3) + 'ia';
  // главна буква, ако оригиналът започва с главна
  return w[0] && w[0] !== w[0].toLowerCase() ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

export function transliterate(text: string): string {
  if (EXCEPTIONS[text]) return EXCEPTIONS[text];
  return text.split(/(\s+|-)/).map((part) => (/^[\s-]+$/.test(part) ? part : word(part))).join('');
}

/** За търсене: малки букви, без точки и двойни интервали, „ѝ“ → „и“. */
export function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/ѝ/g, 'и').replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}
