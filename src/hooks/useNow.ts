import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Текущото време, обновявано точно на границата на всяка секунда.
 * Когато приложението се върне от фона, часът се обновява веднага.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, intervalMs - (Date.now() % intervalMs));
    };
    schedule();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });

    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [intervalMs]);

  return now;
}
