import type { AsrMadhab, CalculationMethodId } from '@/domain/calc';
import type { AppLocation } from '@/domain/location';
import { findTown, townToLocation } from '@/domain/mufti';

/**
 * Стойности по подразбиране, докато няма екран за настройки и GPS (етап 3 от плана).
 */

/** София от календара на Мюфтийството. */
export const DEFAULT_LOCATION: AppLocation = townToLocation(findTown('sofia')!);

/**
 * За места извън България (source 'calc'): метод Диянет и „първият“ Аср (Шафии),
 * както в календарите на Диянет и на Мюфтийството. Ханафи дава Аср около час по-късно.
 */
export const DEFAULT_METHOD: CalculationMethodId = 'Turkey';
export const DEFAULT_MADHAB: AsrMadhab = 'shafi';
