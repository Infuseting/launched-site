import { useSyncExternalStore } from 'react';

export type OS = 'windows' | 'macos' | 'linux' | 'unknown';

const subscribe = () => () => {};

const getSnapshot = (): OS => {
  if (typeof window === 'undefined') return 'unknown';
  const platform = window.navigator.platform.toLowerCase();
  const userAgent = window.navigator.userAgent.toLowerCase();

  if (platform.includes('win') || userAgent.includes('win')) return 'windows';
  if (platform.includes('mac') || userAgent.includes('mac')) return 'macos';
  if (platform.includes('linux') || userAgent.includes('linux')) return 'linux';

  return 'unknown';
};

const getServerSnapshot = (): OS => 'unknown';

export function useOSDetection() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
