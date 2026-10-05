import type { NearMosque } from '@/domain/mosques';

export interface MosqueMapProps {
  /** Точката на търсенето (ти или избраното място). */
  center: { lat: number; lon: number };
  /** Синята точка – само ако позицията е от GPS. */
  me: { lat: number; lon: number } | null;
  /** Подредени по разстояние. */
  mosques: NearMosque[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Брояч – при промяна камерата се връща към теб и най-близките джамии. */
  recenter: number;
  /** Височината на картата (за уеб прегледа). */
  height: number;
  /** Колко отдолу е покрито от листа със списъка. */
  bottomInset: number;
  /** „OpenFreeMap © OpenMapTiles © OpenStreetMap“ – задължително видимо. */
  attribution: string;
  /** За екранния четец: „Карта с 8 джамии“. */
  label: string;
}
