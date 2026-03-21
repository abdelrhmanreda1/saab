export type ScheduledTask = {
  cancel: () => void;
};

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function scheduleNonCriticalTask(
  task: () => void,
  timeout = 150
): ScheduledTask {
  if (typeof window === 'undefined') {
    return { cancel: () => undefined };
  }

  const idleWindow = window as IdleWindow;

  if (typeof idleWindow.requestIdleCallback === 'function') {
    const handle = idleWindow.requestIdleCallback(() => task(), { timeout });
    return {
      cancel: () => idleWindow.cancelIdleCallback?.(handle),
    };
  }

  const handle = window.setTimeout(task, timeout);
  return {
    cancel: () => window.clearTimeout(handle),
  };
}
