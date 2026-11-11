/**
 * Хранилище трасс пайплайна (кольцевой буфер).
 * Совместимо с React.useSyncExternalStore: subscribe / getSnapshot.
 * ZERO-DOM: браузерное зеркало пишется только через globalThis.
 */
import { ENGINE_VERSION } from '../catalog';
import type { PipelineTrace } from '../contracts';
import { nowIso } from './clock';

export const MAX_TRACE_HISTORY = 20;

export interface DebugBundle {
  engineVersion: string;
  exportedAtIso: string;
  maxTraces: number;
  count: number;
  latest: PipelineTrace | null;
  history: PipelineTrace[];
}

type Listener = () => void;

const EMPTY: readonly PipelineTrace[] = Object.freeze([]);

let history: readonly PipelineTrace[] = EMPTY;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {
      // ошибки подписчиков не должны ломать ядро
    }
  }
}

function mirrorToGlobal(trace: PipelineTrace | null): void {
  try {
    (globalThis as unknown as { __COMPOSER_LAST_RUN__?: PipelineTrace | null }).__COMPOSER_LAST_RUN__ =
      trace;
  } catch {
    // globalThis может быть заморожен — зеркало опционально
  }
}

function cloneTrace(trace: PipelineTrace): PipelineTrace {
  return JSON.parse(JSON.stringify(trace)) as PipelineTrace;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Стабильная ссылка до следующего изменения (требование useSyncExternalStore) */
function getSnapshot(): readonly PipelineTrace[] {
  return history;
}

function getLatestTrace(): PipelineTrace | null {
  return history.length > 0 ? history[history.length - 1] : null;
}

/** История в хронологическом порядке (старые -> новые) */
function getHistory(): PipelineTrace[] {
  return [...history];
}

function recordTrace(trace: PipelineTrace): void {
  const copy = cloneTrace(trace);
  const next = [...history, copy];
  history = Object.freeze(next.slice(Math.max(0, next.length - MAX_TRACE_HISTORY)));
  mirrorToGlobal(copy);
  emit();
}

function clearTraces(): void {
  mirrorToGlobal(null);
  if (history.length === 0) return;
  history = EMPTY;
  emit();
}

/** JSON-бандл для Debug Inspector / баг-репортов */
function exportDebugBundle(): string {
  const bundle: DebugBundle = {
    engineVersion: ENGINE_VERSION,
    exportedAtIso: nowIso(),
    maxTraces: MAX_TRACE_HISTORY,
    count: history.length,
    latest: getLatestTrace(),
    history: getHistory(),
  };
  return JSON.stringify(bundle, null, 2);
}

export const traceStore = {
  subscribe,
  getSnapshot,
  getLatestTrace,
  getHistory,
  recordTrace,
  clearTraces,
  exportDebugBundle,
} as const;
