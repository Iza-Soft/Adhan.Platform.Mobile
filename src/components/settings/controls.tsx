import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { fonts, tabularNums } from '@/theme/typography';

import { ChevronIcon } from '../icons';

/* Градивните елементи на екрана „Настройки“ – по mockup-а: група с етикет и полупрозрачна карта. */

export function Group({ label, children, note }: { label: string; children: ReactNode; note?: string }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label.toUpperCase()}</Text>
      <View style={styles.card}>{children}</View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

export function Row({ children, first }: { children: ReactNode; first?: boolean }) {
  return <View style={[styles.row, !first && styles.rowBorder]}>{children}</View>;
}

export function NavRow({
  label,
  value,
  onPress,
  first,
  warn,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  first?: boolean;
  /** Стойността в оранжево – нещо не е наред. */
  warn?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !first && styles.rowBorder, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
      {value ? (
        <Text style={[styles.value, warn && { color: colors.warn }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <ChevronIcon direction="right" size={16} color={colors.muted} />
    </Pressable>
  );
}

export function SwitchRow({
  label,
  value,
  onChange,
  first,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  first?: boolean;
}) {
  return (
    <Row first={first}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: 'rgba(255,255,255,0.18)', true: colors.gold }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
      />
    </Row>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.seg} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.segBtn, on && styles.segOn]}
          >
            <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Ред с „−  стойност  +“. */
export function StepperRow({
  label,
  valueText,
  onMinus,
  onPlus,
  minusLabel,
  plusLabel,
  highlighted,
  first,
}: {
  label: string;
  valueText: string;
  onMinus: () => void;
  onPlus: () => void;
  minusLabel: string;
  plusLabel: string;
  highlighted?: boolean;
  first?: boolean;
}) {
  return (
    <Row first={first}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={onMinus} hitSlop={6} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={minusLabel}>
          <Text style={styles.stepSign}>−</Text>
        </Pressable>
        <Text style={[styles.stepValue, highlighted && styles.gold]}>{valueText}</Text>
        <Pressable onPress={onPlus} hitSlop={6} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={plusLabel}>
          <Text style={styles.stepSign}>+</Text>
        </Pressable>
      </View>
    </Row>
  );
}

/** Списък с избор на една стойност (радио бутони) – за метод и правило за северни ширини. */
export function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; desc?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}
          >
            <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
            <View style={styles.choiceText}>
              <Text style={[styles.choiceLabel, on && styles.labelOn]}>{o.label}</Text>
              {o.desc ? <Text style={styles.desc}>{o.desc}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export const settingsStyles = StyleSheet.create({
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  value: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted, maxWidth: '55%' },
});

const styles = StyleSheet.create({
  group: { gap: 7 },
  groupLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.muted,
    paddingLeft: 6,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    overflow: 'hidden',
  },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, paddingHorizontal: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  pressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  label: settingsStyles.label,
  labelOn: { color: colors.gold },
  value: settingsStyles.value,
  desc: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  segBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  segOn: { backgroundColor: colors.text },
  segText: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  segTextOn: { color: colors.base },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSign: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 20, color: colors.text },
  stepValue: {
    minWidth: 62,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: colors.text,
    ...tabularNums,
  },
  gold: { color: colors.gold },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.gold },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  // Без flex:1 и без допълнителния отстъп на шрифта в Android – иначе текстът стои
  // по-високо от радио бутона.
  choiceText: { flex: 1, justifyContent: 'center' },
  choiceLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
