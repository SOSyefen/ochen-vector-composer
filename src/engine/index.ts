/**
 * Публичная точка входа ядра композитора.
 * ZERO-DOM: ни один реэкспортируемый модуль не обращается к DOM.
 */
export * from './catalog';
export * from './contracts';
export * from './pipeline/1-intentParser';
export * from './pipeline/2-roleResolver';
export * from './pipeline/3-spatialPlacer';
export * from './pipeline/4-svgCompiler';
export * from './compose';
export * from './telemetry/clock';
export * from './telemetry/traceStore';
export * from './telemetry/smokeSuite';
