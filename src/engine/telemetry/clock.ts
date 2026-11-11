/**
 * Безопасные часы ядра.
 * ZERO-DOM: использует только globalThis.performance (если есть) и Date.
 */

interface PerformanceLike {
  now?: () => number;
}

/** Монотонное время в миллисекундах (performance.now() либо Date.now()) */
export function nowMs(): number {
  try {
    const perf = (globalThis as { performance?: PerformanceLike }).performance;
    if (perf && typeof perf.now === 'function') {
      return perf.now();
    }
  } catch {
    // окружение без performance — используем Date
  }
  return Date.now();
}

/** Текущее время в ISO-8601 */
export function nowIso(): string {
  return new Date().toISOString();
}
