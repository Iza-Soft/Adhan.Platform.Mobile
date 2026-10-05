import type { TextStyle } from 'react-native';

/**
 * Имената съвпадат с ключовете, с които шрифтовете се зареждат в src/app/_layout.tsx.
 * В React Native всяка дебелина е отделно семейство, затова не ползваме fontWeight.
 */
export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  arabic: 'Amiri_400Regular',
  arabicBold: 'Amiri_700Bold',
} as const;

/** Цифри с еднаква ширина, за да не „подскача“ обратното броене. */
export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Докъде растат текстовете при голям шрифт в настройките на телефона (достъпност, етап 10).
 * Навсякъде другаде текстът расте без ограничение; тук редовете са с точна височина
 * (таблицата за месеца, списъкът за деня, кръгът с обратното броене, долната лента).
 */
export const FONT_SCALE = { dense: 1.2, row: 1.35 } as const;
