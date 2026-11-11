import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Bug,
  X,
  Play,
  Download,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { CanvasFormatId, CanvasObject, DetailSize } from '../types';
import type { IntentStrategy, PipelineTrace, SmokeReport } from '../engine/contracts';
import { traceStore } from '../engine/telemetry/traceStore';
import { runEngineSmokeSuite } from '../engine/telemetry/smokeSuite';

export interface DebugInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  showDebugOverlay: boolean;
  onToggleDebugOverlay: () => void;
  size: DetailSize;
  format: CanvasFormatId;
  objects: CanvasObject[];
}

const STRATEGY_STYLES: Record<IntentStrategy, string> = {
  exact_preset: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  explicit_components: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  preset_keyword: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  semantic_theme: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  deterministic_fallback: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

const fmt = (n: number, digits = 1): string => (Number.isFinite(n) ? n.toFixed(digits) : '—');

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString('ru-RU');
};

const SectionTitle: React.FC<{ index: number; title: string }> = ({ index, title }) => (
  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
    <span className="w-4 h-4 rounded bg-indigo-600/30 text-indigo-300 text-[10px] flex items-center justify-center font-mono">
      {index}
    </span>
    {title}
  </h3>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="bg-[#22242E] border border-white/[0.08] rounded-lg px-3 py-2 min-w-0">
    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
    <div className="text-xs text-slate-200 font-mono break-words">{children}</div>
  </div>
);

export const DebugInspectorModal: React.FC<DebugInspectorModalProps> = ({
  isOpen,
  onClose,
  showDebugOverlay,
  onToggleDebugOverlay,
  size,
  format,
  objects,
}) => {
  const history = useSyncExternalStore(
    traceStore.subscribe,
    traceStore.getSnapshot,
    traceStore.getSnapshot
  );

  // null — следим за последним запуском
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [report, setReport] = useState<SmokeReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [casesExpanded, setCasesExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const effectiveIdx =
    history.length === 0
      ? -1
      : selectedIdx === null
        ? history.length - 1
        : Math.min(selectedIdx, history.length - 1);
  const trace: PipelineTrace | null = effectiveIdx >= 0 ? history[effectiveIdx] : null;

  const handleRunSmoke = () => {
    try {
      setReport(runEngineSmokeSuite());
      setReportError(null);
      setCasesExpanded(false);
    } catch (err) {
      setReport(null);
      setReportError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleExportBundle = () => {
    const base = JSON.parse(traceStore.exportDebugBundle()) as Record<string, unknown>;
    const bundle = {
      ...base,
      context: {
        canvasSize: size,
        canvasFormat: format,
        objectsCount: objects.length,
      },
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ochen-debug-bundle.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const collisions = trace?.spatial.accentCollisionTrace ?? [];
  const hasCollisions = collisions.some((c) => c.collidedWith !== null);

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#181920] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400">
              <Bug size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#F3F4F6] leading-tight">Инспектор отладки</h2>
              <div className="text-[10px] text-slate-500 font-mono">
                Ctrl+Shift+D · трасс в истории: {history.length}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
            title="Закрыть (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {/* History selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">Запуск:</span>
            <select
              value={effectiveIdx}
              disabled={history.length === 0}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className="flex-1 min-w-[220px] bg-[#22242E] border border-white/10 text-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-500"
            >
              {history.length === 0 && <option value={-1}>Нет записанных запусков</option>}
              {history.map((t, i) => (
                <option key={`${t.traceId}_${i}`} value={i}>
                  #{i + 1} · {formatTime(t.timestampIso)} · {t.intent.strategy} · {fmt(t.durationMs, 2)} ms
                </option>
              ))}
            </select>
            <button
              onClick={() => setSelectedIdx(null)}
              disabled={history.length === 0 || selectedIdx === null}
              className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#22242E] text-xs text-slate-300 hover:bg-[#282B38] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              К последнему
            </button>
          </div>

          {/* 1. Pipeline Flow */}
          <section>
            <SectionTitle index={1} title="Pipeline Flow" />
            {!trace ? (
              <div className="text-xs text-slate-500 bg-[#22242E] border border-white/[0.08] rounded-lg px-3 py-3">
                Трасс пока нет. Соберите композицию через AI-модал — запуск появится здесь.
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Field label="prompt">
                    {trace.request.prompt ? trace.request.prompt : <span className="text-slate-500">—</span>}
                  </Field>
                  <Field label="components">
                    {trace.request.components && trace.request.components.length > 0 ? (
                      trace.request.components.join(', ')
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </Field>
                  <Field label="format">{trace.request.format}</Field>
                  <Field label="seed">
                    {trace.request.seed ? trace.request.seed : <span className="text-slate-500">—</span>}
                  </Field>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-slate-500">→</span>
                  <span
                    className={`px-2 py-1 rounded-md border font-mono ${STRATEGY_STYLES[trace.intent.strategy]}`}
                  >
                    {trace.intent.strategy}
                  </span>
                  <span className="text-slate-500">→</span>
                  <span className="px-2 py-1 rounded-md border border-white/10 bg-[#22242E] font-mono text-slate-300">
                    rule: {trace.intent.matchedRuleId ?? 'null'}
                  </span>
                  <span className="text-slate-500">→</span>
                  <span className="px-2 py-1 rounded-md border border-white/10 bg-[#22242E] font-mono text-slate-300">
                    style: {trace.intent.resolvedStyle}
                  </span>
                  <span className="text-slate-500">→</span>
                  <span className="px-2 py-1 rounded-md border border-white/10 bg-[#22242E] font-mono text-emerald-300">
                    {fmt(trace.durationMs, 2)} ms
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                  <span>trace: {trace.traceId}</span>
                  <span>объекты: {trace.spatial.objects.length}</span>
                  <span>компоненты: {trace.roles.normalizedComponents.join(', ') || '—'}</span>
                  {trace.roles.droppedComponents.length > 0 && (
                    <span className="text-amber-400">
                      отброшены: {trace.roles.droppedComponents.join(', ')}
                    </span>
                  )}
                </div>

                {trace.warnings.length > 0 ? (
                  <ul className="space-y-1">
                    {trace.warnings.map((w, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5"
                      >
                        <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[11px] text-slate-500">Предупреждений нет</div>
                )}
              </div>
            )}
          </section>

          {/* 2. Slot & Bounding Box Table */}
          <section>
            <SectionTitle index={2} title="Slot & Bounding Box Table" />
            {!trace ? (
              <div className="text-xs text-slate-500">Нет данных.</div>
            ) : (
              <div className="space-y-3">
                <div className="text-[11px] font-mono text-slate-500">
                  сетка {trace.spatial.grid.W}×{trace.spatial.grid.H} · scaleRatio{' '}
                  {fmt(trace.spatial.grid.scaleRatio, 3)} · xShift {fmt(trace.spatial.grid.xShift, 2)}
                </div>
                <div className="overflow-x-auto border border-white/[0.08] rounded-lg">
                  <table className="w-full text-[11px] font-mono">
                    <thead className="bg-[#22242E] text-slate-400">
                      <tr>
                        {['Role', 'ID', 'Variant', 'z', 'Scale', '(gx, gy)', 'AABB [L, T, R, B]', 'HeadlineΔ'].map(
                          (h) => (
                            <th key={h} className="text-left font-medium px-2.5 py-2 whitespace-nowrap">
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {trace.spatial.items.map((item, i) => (
                        <tr key={`${item.illustrationId}_${i}`} className="border-t border-white/5">
                          <td className="px-2.5 py-1.5 text-indigo-300 whitespace-nowrap">{item.role}</td>
                          <td className="px-2.5 py-1.5 text-slate-200">{item.illustrationId}</td>
                          <td className="px-2.5 py-1.5 text-slate-400">{item.variant}</td>
                          <td className="px-2.5 py-1.5 text-slate-400">{item.zIndex}</td>
                          <td className="px-2.5 py-1.5 text-slate-400">{fmt(item.scale, 3)}</td>
                          <td className="px-2.5 py-1.5 text-slate-300 whitespace-nowrap">
                            ({fmt(item.finalCoords.gx)}, {fmt(item.finalCoords.gy)})
                            {(item.initialCoords.gx !== item.finalCoords.gx ||
                              item.initialCoords.gy !== item.finalCoords.gy) && (
                              <span className="text-amber-400">
                                {' '}
                                ← ({fmt(item.initialCoords.gx)}, {fmt(item.initialCoords.gy)})
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 text-emerald-300 whitespace-nowrap">
                            [{fmt(item.aabb.left)}, {fmt(item.aabb.top)}, {fmt(item.aabb.right)},{' '}
                            {fmt(item.aabb.bottom)}]
                          </td>
                          <td
                            className={`px-2.5 py-1.5 ${
                              item.headlineShiftApplied !== 0 ? 'text-amber-300' : 'text-slate-500'
                            }`}
                          >
                            {fmt(item.headlineShiftApplied, 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
                    Лог коллизий акцента
                  </div>
                  {collisions.length === 0 ? (
                    <div className="text-[11px] text-slate-500">Акцент не проверялся на коллизии.</div>
                  ) : !hasCollisions ? (
                    <div className="text-[11px] text-emerald-400">
                      Коллизий нет (итераций: {collisions.length})
                    </div>
                  ) : (
                    <ol className="space-y-1 text-[11px] font-mono max-h-40 overflow-y-auto">
                      {collisions.map((c, i) => (
                        <li
                          key={i}
                          className={`flex gap-3 px-2.5 py-1 rounded border ${
                            c.collidedWith
                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          <span>iter {c.iteration}</span>
                          <span>
                            ({fmt(c.gx)}, {fmt(c.gy)})
                          </span>
                          <span>{c.collidedWith ? `✗ ${c.collidedWith}` : '✓ свободно'}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* 3. Visual Overlay Toggle */}
          <section>
            <SectionTitle index={3} title="Visual Overlay" />
            <label className="flex items-center gap-3 cursor-pointer bg-[#22242E] border border-white/[0.08] rounded-lg px-3 py-2.5 select-none">
              <input
                type="checkbox"
                checked={showDebugOverlay}
                onChange={onToggleDebugOverlay}
                className="sr-only peer"
              />
              <span className="relative w-9 h-5 rounded-full bg-slate-700 peer-checked:bg-emerald-600 transition flex-shrink-0">
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    showDebugOverlay ? 'translate-x-4' : ''
                  }`}
                />
              </span>
              <span className="text-xs text-slate-200">Показать AABB-оверлей и сетку на холсте</span>
            </label>
          </section>

          {/* 4. Diagnostics & Export */}
          <section>
            <SectionTitle index={4} title="Diagnostics & Export" />
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={handleRunSmoke}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/30 transition active:scale-95"
              >
                <Play size={14} />
                Запустить самодиагностику (20 инвариантов)
              </button>
              <button
                onClick={handleExportBundle}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#22242E] border border-white/10 hover:bg-[#282B38] text-slate-200 text-xs font-medium transition active:scale-95"
              >
                <Download size={14} />
                Скачать Debug Bundle (.json)
              </button>
            </div>

            {reportError && (
              <div className="mt-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                Ошибка самодиагностики: {reportError}
              </div>
            )}

            {report && (
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => setCasesExpanded((v) => !v)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition ${
                    report.failed === 0
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {report.failed === 0 ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {report.failed === 0
                      ? `${report.passed}/${report.total} PASSED (${fmt(report.durationMs)} ms)`
                      : `${report.failed} FAILED, ${report.passed}/${report.total} passed (${fmt(report.durationMs)} ms)`}
                    <span className="text-slate-500">· v{report.engineVersion}</span>
                  </span>
                  {casesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {casesExpanded && (
                  <ul className="max-h-64 overflow-y-auto space-y-1 border border-white/[0.08] rounded-lg p-1.5 bg-black/20">
                    {report.cases.map((c) => (
                      <li
                        key={c.id}
                        className="text-[11px] px-2 py-1.5 rounded bg-[#22242E] border border-white/5"
                      >
                        <div className="flex items-center gap-2">
                          {c.passed ? (
                            <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                          ) : (
                            <XCircle size={12} className="text-rose-400 flex-shrink-0" />
                          )}
                          <span className="font-mono text-slate-400 flex-shrink-0">{c.id}</span>
                          <span className="text-slate-300 truncate">{c.label}</span>
                          <span className="ml-auto font-mono text-slate-500 flex-shrink-0">
                            {fmt(c.durationMs, 2)} ms
                          </span>
                        </div>
                        {c.failures.length > 0 && (
                          <ul className="mt-1 ml-5 space-y-0.5 text-rose-300">
                            {c.failures.map((f, i) => (
                              <li key={i}>• {f}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default DebugInspectorModal;
