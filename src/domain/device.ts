/**
 * Марката на телефона – за инструкциите „Работа на заден план“.
 * Всяка марка крие настройките за батерията на различно място.
 */
export type BatteryBrand = 'samsung' | 'xiaomi' | 'huawei' | 'oppo' | 'other';

export const BATTERY_BRANDS: readonly BatteryBrand[] = ['samsung', 'xiaomi', 'huawei', 'oppo', 'other'];

/** По производителя и марката от Android (Build.MANUFACTURER / Build.BRAND). */
export function batteryBrand(manufacturer?: string | null, brand?: string | null): BatteryBrand {
  const m = `${manufacturer ?? ''} ${brand ?? ''}`.toLowerCase();
  if (m.includes('samsung')) return 'samsung';
  if (m.includes('xiaomi') || m.includes('redmi') || m.includes('poco')) return 'xiaomi';
  if (m.includes('huawei') || m.includes('honor')) return 'huawei';
  if (m.includes('oppo') || m.includes('realme') || m.includes('oneplus')) return 'oppo';
  return 'other';
}
