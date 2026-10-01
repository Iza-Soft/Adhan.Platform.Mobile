import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatGregorianShort, formatHM } from '@/domain/format';
import { useI18n } from '@/i18n';
import { openFullScreenIntentSettings } from '../../../modules/adhan-native';

import { openExactAlarmSettings, requestPermission, useNotificationStatus } from '@/services/notifications';
import { REMINDER_CHOICES, useSettings } from '@/store/settings';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

import { Choice, Group, NavRow, Row, SwitchRow, settingsStyles } from './controls';

/** Групата „Известия“ в „Настройки“: разрешение, точни известия, напомняне, вибрация, проба. */
export function NotificationsGroup() {
  const { t } = useI18n();
  const n = t.notifications;
  const status = useNotificationStatus();
  const reminderMinutes = useSettings((s) => s.reminderMinutes);
  const setReminderMinutes = useSettings((s) => s.setReminderMinutes);
  const vibrate = useSettings((s) => s.vibrate);
  const setVibrate = useSettings((s) => s.setVibrate);
  const [open, setOpen] = useState(false);

  if (status.permission === 'unavailable') {
    return (
      <Group label={n.group}>
        <Row first>
          <Text style={styles.text}>{n.webNote}</Text>
        </Row>
      </Group>
    );
  }

  const granted = status.permission === 'granted';
  const permissionText = granted ? n.granted : status.permission === 'denied' ? n.denied : n.undetermined;

  const scheduledNote = !granted
    ? n.deniedNote
    : status.count === 0
      ? n.scheduledNone
      : n.scheduled(
          status.count,
          status.until ? `${formatGregorianShort(status.until, t.date)}, ${formatHM(status.until)}` : '',
        );

  const reminderLabel = (m: number) => (m === 0 ? n.reminderOff : n.reminderValue(m));

  return (
    <Group label={n.group} note={scheduledNote}>
      <Row first>
        <Text style={settingsStyles.label}>{n.status}</Text>
        <Text style={[styles.value, !granted && styles.warn]}>{permissionText}</Text>
      </Row>
      {!granted && (
        <Pressable onPress={requestPermission} accessibilityRole="button" style={styles.linkRow}>
          <Text style={styles.link}>{n.allow}</Text>
        </Pressable>
      )}

      {granted && status.exact !== null && (
        <StatusRow
          label={n.exact}
          ok={status.exact}
          okText={n.exactOn}
          badText={n.exactOff}
          note={n.exactNote}
          action={{ label: n.exactAllow, onPress: openExactAlarmSettings }}
        />
      )}

      {/* Android, етап 5: алармата на цял екран и работата на заден план */}
      {granted && status.fullScreen !== null && (
        <StatusRow
          label={n.fullScreen}
          ok={status.fullScreen}
          okText={n.fullScreenOn}
          badText={n.fullScreenOff}
          note={n.fullScreenNote}
          action={{ label: n.fullScreenAllow, onPress: openFullScreenIntentSettings }}
        />
      )}
      {granted && status.battery !== null && (
        <NavRow
          label={n.background}
          value={status.battery ? n.backgroundOk : n.backgroundBad}
          warn={!status.battery}
          onPress={() => router.push('/battery')}
        />
      )}

      {granted && (
        <>
          <NavRow label={n.reminder} value={reminderLabel(reminderMinutes)} onPress={() => setOpen((o) => !o)} />
          {open && (
            <Choice
              options={REMINDER_CHOICES.map((m) => ({ value: String(m), label: reminderLabel(m) }))}
              value={String(reminderMinutes)}
              onChange={(v) => {
                setReminderMinutes(Number(v));
                setOpen(false);
              }}
            />
          )}
          {/* на iPhone вибрацията се определя от настройките на телефона */}
          {Platform.OS === 'android' && <SwitchRow label={n.vibrate} value={vibrate} onChange={setVibrate} />}
          <NavRow label={n.diagnostics} onPress={() => router.push('/diagnostics')} />
        </>
      )}
    </Group>
  );
}

/** Ред със състояние: „Разрешени“ или (в оранжево) „Изключени“ + обяснение и връзка. */
function StatusRow({
  label,
  ok,
  okText,
  badText,
  note,
  action,
}: {
  label: string;
  ok: boolean;
  okText: string;
  badText: string;
  note: string;
  action: { label: string; onPress: () => void };
}) {
  if (ok) {
    return (
      <Row>
        <Text style={settingsStyles.label}>{label}</Text>
        <Text style={styles.value}>{okText}</Text>
      </Row>
    );
  }
  return (
    <>
      <Row>
        <View style={styles.exactText}>
          <View style={styles.exactHead}>
            <Text style={settingsStyles.label}>{label}</Text>
            <Text style={[styles.value, styles.warn]}>{badText}</Text>
          </View>
          <Text style={styles.small}>{note}</Text>
        </View>
      </Row>
      <Pressable onPress={action.onPress} accessibilityRole="button" style={styles.linkRow}>
        <Text style={styles.link}>{action.label}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  text: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textDim },
  value: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textDim },
  warn: { color: colors.warn },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  exactText: { flex: 1, gap: 4 },
  exactHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.gold },
});
