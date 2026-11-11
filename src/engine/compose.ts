/**
 * Оркестратор пайплайна: intent -> roles -> spatial -> trace.
 * ZERO-DOM: чистая функция (кроме опциональной записи трассы в traceStore).
 */
import type { CanvasFormatId } from '../types';
import { COMPOSER_GRID_SIZES } from './catalog';
import type { ComposeRequest, ComposeResponse, PipelineTrace } from './contracts';
import { hashString, parseIntent } from './pipeline/1-intentParser';
import { resolveRoles } from './pipeline/2-roleResolver';
import { placeScene } from './pipeline/3-spatialPlacer';
import { nowIso, nowMs } from './telemetry/clock';
import { traceStore } from './telemetry/traceStore';

export interface ComposeOptions {
  /** Записать трассу в traceStore (Debug Inspector) */
  record?: boolean;
}

function isKnownFormat(format: unknown): format is CanvasFormatId {
  return (
    typeof format === 'string' && Object.prototype.hasOwnProperty.call(COMPOSER_GRID_SIZES, format)
  );
}

function snapshotRequest(req: ComposeRequest): ComposeRequest {
  const snap: ComposeRequest = { format: req.format };
  if (req.prompt !== undefined) snap.prompt = req.prompt;
  if (req.components !== undefined) snap.components = [...req.components];
  if (req.styleOverride !== undefined) snap.styleOverride = req.styleOverride;
  if (req.seed !== undefined) snap.seed = req.seed;
  return snap;
}

function buildTraceId(req: ComposeRequest, format: CanvasFormatId): string {
  if (req.seed !== undefined) {
    const fingerprint = JSON.stringify({
      p: req.prompt ?? '',
      c: req.components ?? [],
      f: format,
      s: req.styleOverride ?? '',
      seed: req.seed,
    });
    return `trace-${hashString(fingerprint).toString(36)}`;
  }
  return `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function composeScene(req: ComposeRequest, options: ComposeOptions = {}): ComposeResponse {
  const startedAt = nowMs();
  const timestampIso = nowIso();
  const warnings: string[] = [];

  let format: CanvasFormatId = 'square';
  if (isKnownFormat(req.format)) {
    format = req.format;
  } else {
    warnings.push(`Неизвестный формат «${String(req.format)}»: использован 'square'.`);
  }

  // Шаг 1
  const intent = parseIntent(req.prompt, req.components, req.styleOverride);
  if (req.components && req.components.length > 0 && intent.strategy !== 'explicit_components') {
    warnings.push('Явный список не содержит валидных компонентов: использован разбор текста.');
  }
  if (intent.strategy === 'deterministic_fallback' && (req.prompt ?? '').trim()) {
    warnings.push('Запрос не распознан: выбран детерминированный fallback-пресет.');
  }

  // Шаг 2
  const { warnings: roleWarnings, ...roles } = resolveRoles(intent.rawComponents);
  warnings.push(...roleWarnings);

  // Шаг 3
  const spatial = placeScene(roles, format, intent.resolvedStyle, req.seed);
  const lastAccentStep = spatial.accentCollisionTrace[spatial.accentCollisionTrace.length - 1];
  if (lastAccentStep && lastAccentStep.collidedWith !== null) {
    warnings.push(
      `Акцент не удалось полностью развести с «${lastAccentStep.collidedWith}» за отведённые итерации.`
    );
  }

  const trace: PipelineTrace = {
    traceId: buildTraceId(req, format),
    timestampIso,
    durationMs: Number((nowMs() - startedAt).toFixed(3)),
    request: snapshotRequest(req),
    intent,
    roles,
    spatial,
    warnings,
  };

  if (options.record) {
    traceStore.recordTrace(trace);
  }

  return { objects: spatial.objects, trace };
}
