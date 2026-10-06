import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DIYANET_OFFICIAL_UNTIL } from '@/domain/hijriTable';
import { HOLIDAYS, reminderDayOf, type Holiday, type HolidaySource } from '@/domain/holidays';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';
import { colors } from '@/theme/colors';
import { fonts, tabularNums } from '@/theme/typography';

import { fullDate, hijriText, shortDate } from './holidayFormat';

const dayBefore = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12);

/** Празникът – докосване в списъка (етап 13): датите, кратко обяснение, напомняне. */
export function HolidaySheet({ holiday: x, source, onClose }: { holiday: Holiday; source: HolidaySource; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const h = t.holidays;
  const meta = HOLIDAYS[x.id];
  const on = useSettings((s) => !!s.holidayReminders[x.id]);
  const setReminder = useSettings((s) => s.setHolidayReminder);
  const computed =
    source !== 'ummalqura' &&
    (x.hijri.year > DIYANET_OFFICIAL_UNTIL.year ||
      (x.hijri.year === DIYANET_OFFICIAL_UNTIL.year && x.hijri.month > DIYANET_OFFICIAL_UNTIL.month));
  const eve = x.id === 'fitr' || x.id === 'adha' ? dayBefore(x.date) : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={h.close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.title} accessibilityRole="header">
                {h.names[x.id]}
              </Text>
              <Text style={styles.arabic} importantForAccessibility="no" accessibilityElementsHidden>
                {meta.arabic}
              </Text>
            </View>
            {meta.days > 1 && <Text style={styles.chip}>{h.daysCount(meta.days)}</Text>}
          </View>

          <View style={styles.box}>
            <View style={styles.boxRow}>
              <Text style={styles.boxLabel}>{meta.days > 1 ? h.dates : h.date}</Text>
              <Text style={[styles.boxValue, styles.bold, x.expected && styles.warn]}>
                {x.expected ? '≈ ' : ''}
                {fullDate(x, t)}
                {x.night ? ` · ${h.evening}` : ''}
              </Text>
            </View>
            <View style={[styles.boxRow, styles.border]}>
              <Text style={styles.boxLabel}>{h.hijri}</Text>
              <Text style={styles.boxValue}>{hijriText(x, t)}</Text>
            </View>
            {eve && (
              <View style={[styles.boxRow, styles.border]}>
                <Text style={styles.boxLabel}>{h.arefe}</Text>
                <Text style={styles.boxValue}>{shortDate(eve, t)}</Text>
              </View>
            )}
          </View>

          {x.expected && <Text style={styles.noteWarn}>{h.expectedNote}</Text>}
          {computed && <Text style={styles.note}>{h.computedNote}</Text>}

          <Text style={styles.about}>{h.about[x.id]}</Text>

          <View style={styles.remind}>
            <View style={styles.remindText}>
              <Text style={styles.remindLabel}>{x.night ? h.remindNight : h.remindDay}</Text>
              <Text style={styles.remindSub}>{h.remindAt(shortDate(reminderDayOf(x), t))}</Text>
            </View>
            <Switch
              value={on}
              onValueChange={(v) => setReminder(x.id, v)}
              trackColor={{ false: 'rgba(255,255,255,0.18)', true: colors.gold }}
              thumbColor="#FFFFFF"
              accessibilityLabel={x.night ? h.remindNight : h.remindDay}
            />
          </View>

          <Text style={styles.source}>{h.source[source]}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3,6,12,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: '#16243A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headText: { flex: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 30, color: colors.text },
  arabic: { fontFamily: fonts.arabic, fontSize: 22, lineHeight: 32, color: colors.gold, textAlign: 'left' },
  chip: {
    fontFamily: fonts.extrabold,
    fontSize: 11.5,
    color: colors.muted,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  box: { marginTop: 14, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  boxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  boxLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  boxValue: { flexShrink: 1, textAlign: 'right', fontFamily: fonts.bold, fontSize: 14, color: colors.text, ...tabularNums },
  bold: { fontFamily: fonts.extrabold },
  warn: { color: colors.warn },
  noteWarn: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.warn, marginTop: 10 },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 10 },
  about: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textDim, marginTop: 14 },
  remind: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  remindText: { flex: 1 },
  remindLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  remindSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, ...tabularNums },
  source: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted, textAlign: 'center', marginTop: 12 },
});
