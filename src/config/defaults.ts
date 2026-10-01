import type { AsrMadhab, HighLatRuleId, MethodChoice } from '@/domain/calc';
import type { AppLocation } from '@/domain/location';
import { defaultPlace, placeToLocation } from '@/domain/places';

/**
 * Стойности по подразбиране. Потребителят ги сменя от „Настройки“ (src/store/settings.ts).
 */

/** София-град – докато няма GPS или избрано място. */
export const DEFAULT_LOCATION: AppLocation = placeToLocation(defaultPlace());

/**
 * За места извън България (source 'calc'): методът според държавата („Автоматично“,
 * виж methodForCountry – в Турция и Европа Диянет) и „първият“ Аср (Шафии),
 * както в календарите на Диянет и на Мюфтийството. Ханафи дава Аср около час по-късно.
 */
export const DEFAULT_METHOD: MethodChoice = 'auto';
export const DEFAULT_MADHAB: AsrMadhab = 'shafi';

/** Над 48° ширина: „една седма от нощта“ – най-често ползваното правило в Европа. */
export const DEFAULT_HIGH_LAT_RULE: HighLatRuleId = 'seventhofthenight';
