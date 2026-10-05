import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { useAlertPrefs } from '@/store/alertPrefs';
import { useSettings } from '@/store/settings';
import { useSounds } from '@/store/sounds';

import { rescheduleNotifications } from './notifications';
import { updateWidgets } from './widgets';

/**
 * Фонова задача: веднъж на няколко часа допланира известията (и кадрите на widget-ите)
 * за следващите дни,
 * дори ако приложението не се отваря. Android – WorkManager (работи и без Google услуги),
 * iPhone – BGTaskScheduler (системата решава кога; обикновено нощем, на зарядно).
 */
export const RESCHEDULE_TASK = 'ezan-reschedule-notifications';

// Задачата трябва да е дефинирана при зареждане на кода (не в компонент) –
// системата може да пусне приложението само за нея, без да показва екран.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(RESCHEDULE_TASK, async () => {
    try {
      // при пускане само за задачата настройките още не са прочетени от паметта
      await Promise.all([
        useSettings.persist.rehydrate(),
        useAlertPrefs.persist.rehydrate(),
        useSounds.persist.rehydrate(),
      ]);
      // widget-ите – кадрите се изместват напред (винаги 7 дни)
      updateWidgets();
      await rescheduleNotifications();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundReschedule(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(RESCHEDULE_TASK))) {
      await BackgroundTask.registerTaskAsync(RESCHEDULE_TASK, { minimumInterval: 6 * 60 }); // минути
    }
  } catch (e) {
    console.warn('[background-task]', e);
  }
}
