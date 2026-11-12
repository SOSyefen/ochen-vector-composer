import React, { useRef, useState, useEffect, useSyncExternalStore } from 'react';
import { CanvasFormatConfig, CanvasObject, DetailSize, Palette } from '../types';
import { getRawSvg, parseSvgViewBox } from '../utils/svgRegistry';
import { recolorSvg } from '../utils/recolorEngine';
import { extractSvgInner, readInheritedRootAttrs } from '../engine/pipeline/4-svgCompiler';
import { traceStore } from '../engine/telemetry/traceStore';
import type { PipelineTrace } from '../engine/contracts';
import { RotateCw, Trash2, Copy, ArrowUp, ArrowDown } from 'lucide-react';

interface CanvasProps {
  objects: CanvasObject[];
  size: DetailSize;
  palette: Palette;
  canvasBg: string;
  format: CanvasFormatConfig;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateObject: (updated: CanvasObject) => void;
  onDeleteObject: (id: string) => void;
  onDuplicateObject: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  showDebugOverlay?: boolean;
}

/** Отладочный оверлей: AABB, перекрестия, сетка и safe-зона headline в координатах холста */
function renderDebugOverlay(
  trace: PipelineTrace,
  format: CanvasFormatConfig,
  fitScale: number
): React.ReactNode {
  const { grid, items } = trace.spatial;
  if (!(grid.W > 0) || !(grid.H > 0) || !(fitScale > 0)) return null;

  const sx = format.width / grid.W;
  const sy = format.height / grid.H;
  const px = 1 / fitScale; // 1 экранный пиксель в единицах холста
  const fontSize = 9 * px;
  const cross = 5 * px;
  const gridDivisions = 4;

  return (
    <g pointerEvents="none" className="debug-overlay">
      {/* Сетка */}
      <rect
        x={0}
        y={0}
        width={format.width}
        height={format.height}
        fill="none"
        stroke="#94a3b8"
        strokeOpacity={0.5}
        strokeWidth={px}
      />
      {Array.from({ length: gridDivisions - 1 }, (_, i) => {
        const k = (i + 1) / gridDivisions;
        return (
          <g key={`grid_${i}`} stroke="#94a3b8" strokeOpacity={0.18} strokeWidth={px}>
            <line x1={k * format.width} y1={0} x2={k * format.width} y2={format.height} />
            <line x1={0} y1={k * format.height} x2={format.width} y2={k * format.height} />
          </g>
        );
      })}

      {/* Safe-зона headline */}
      {trace.intent.resolvedStyle === 'headline' && (
        <g>
          <line
            x1={0.28 * format.width}
            y1={0}
            x2={0.28 * format.width}
            y2={format.height}
            stroke="#fbbf24"
            strokeWidth={1.5 * px}
            strokeDasharray={`${6 * px} ${4 * px}`}
          />
          <text
            x={0.28 * format.width + 3 * px}
            y={fontSize + 2 * px}
            fontSize={fontSize}
            fill="#fbbf24"
            fontFamily="monospace"
          >
            headline safe 0.28W
          </text>
        </g>
      )}

      {/* AABB и перекрестия */}
      {items.map((item, i) => {
        const left = item.aabb.left * sx;
        const top = item.aabb.top * sy;
        const width = (item.aabb.right - item.aabb.left) * sx;
        const height = (item.aabb.bottom - item.aabb.top) * sy;
        const cx = item.finalCoords.gx * sx;
        const cy = item.finalCoords.gy * sy;
        const color = item.role === 'small_accent' ? '#22d3ee' : '#34d399';
        const labelY = top < fontSize + 2 * px ? top + fontSize + 1 * px : top - 2 * px;
        return (
          <g key={`${item.illustrationId}_${i}`}>
            <rect
              x={left}
              y={top}
              width={width}
              height={height}
              fill={color}
              fillOpacity={0.06}
              stroke={color}
              strokeWidth={1.25 * px}
              strokeDasharray={`${5 * px} ${3 * px}`}
            />
            <line x1={cx - cross} y1={cy} x2={cx + cross} y2={cy} stroke={color} strokeWidth={px} />
            <line x1={cx} y1={cy - cross} x2={cx} y2={cy + cross} stroke={color} strokeWidth={px} />
            <text
              x={left + 2 * px}
              y={labelY}
              fontSize={fontSize}
              fill={color}
              fontFamily="monospace"
            >
              {`${item.role}:${item.illustrationId} (z:${item.zIndex})`}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export const Canvas: React.FC<CanvasProps> = ({
  objects,
  size,
  palette,
  canvasBg,
  format,
  selectedId,
  onSelect,
  onUpdateObject,
  onDeleteObject,
  onDuplicateObject,
  onBringForward,
  onSendBackward,
  showDebugOverlay = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const latestTrace = useSyncExternalStore(
    traceStore.subscribe,
    traceStore.getLatestTrace,
    traceStore.getLatestTrace
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Compute visual scale to fit within parent viewport
  const [fitScale, setFitScale] = useState(0.8);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const padding = 80;
      const scaleX = (clientWidth - padding) / format.width;
      const scaleY = (clientHeight - padding) / format.height;
      setFitScale(Math.min(scaleX, scaleY, 2.5));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [format.width, format.height]);

  const handlePointerDown = (e: React.PointerEvent, obj: CanvasObject) => {
    e.stopPropagation();
    onSelect(obj.instanceId);
    setDraggingId(obj.instanceId);
    (e.target as Element).setPointerCapture?.(e.pointerId);

    // Calculate offset in canvas units
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const pointerCanvasX = (e.clientX - rect.left - (rect.width - format.width * fitScale) / 2) / fitScale;
      const pointerCanvasY = (e.clientY - rect.top - (rect.height - format.height * fitScale) / 2) / fitScale;
      setDragOffset({
        x: pointerCanvasX - obj.x,
        y: pointerCanvasY - obj.y,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId || !containerRef.current) return;
    const targetObj = objects.find((o) => o.instanceId === draggingId);
    if (!targetObj) return;

    const rect = containerRef.current.getBoundingClientRect();
    const pointerCanvasX = (e.clientX - rect.left - (rect.width - format.width * fitScale) / 2) / fitScale;
    const pointerCanvasY = (e.clientY - rect.top - (rect.height - format.height * fitScale) / 2) / fitScale;

    const rawX = pointerCanvasX - dragOffset.x;
    const rawY = pointerCanvasY - dragOffset.y;

    if (isNaN(rawX) || isNaN(rawY)) return;

    // Clamp within generous bounds of canvas
    const clampedX = Math.max(-100, Math.min(format.width + 100, Math.round(rawX)));
    const clampedY = Math.max(-100, Math.min(format.height + 100, Math.round(rawY)));

    onUpdateObject({
      ...targetObj,
      x: clampedX,
      y: clampedY,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingId) {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      setDraggingId(null);
    }
  };

  const selectedObj = objects.find((o) => o.instanceId === selectedId);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full w-full flex items-center justify-center bg-[#090d16] overflow-hidden select-none"
      onClick={() => onSelect(null)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Format Badge */}
      <div className="absolute top-4 left-6 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-full border border-slate-700/60 text-xs text-slate-300 shadow">
        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span>{format.label}</span>
        <span className="text-slate-500">•</span>
        <span className="font-mono text-slate-400">{format.width}×{format.height}px</span>
      </div>

      {/* Floating Object Controls when an item is selected */}
      {selectedObj && (
        <div className="absolute top-4 right-6 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur px-3 py-2 rounded-xl border border-slate-700/80 shadow-2xl text-xs">
          <span className="font-medium text-slate-300 mr-2 capitalize">
            {selectedObj.illustrationId} ({selectedObj.variant})
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onBringForward(selectedObj.instanceId);
            }}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded"
            title="На передний план"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSendBackward(selectedObj.instanceId);
            }}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded"
            title="На задний план"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdateObject({
                ...selectedObj,
                rotation: (selectedObj.rotation + 15) % 360,
              });
            }}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded"
            title="Повернуть на 15°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <span
            className="text-[10px] font-mono text-slate-400 px-1.5 select-none"
            title="Относительные пропорции зафиксированы по правилам дизайн-системы"
          >
            {Math.round(selectedObj.scale * 100)}%
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicateObject(selectedObj.instanceId);
            }}
            className="p-1.5 hover:bg-slate-800 text-slate-300 rounded"
            title="Дублировать"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteObject(selectedObj.instanceId);
            }}
            className="p-1.5 hover:bg-rose-950/60 text-rose-400 rounded ml-1"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Actual Scaled SVG Artboard */}
      <div
        className="relative transition-transform duration-75 shadow-2xl rounded-sm"
        style={{
          width: format.width * fitScale,
          height: format.height * fitScale,
          backgroundColor: canvasBg,
        }}
      >
        <svg
          viewBox={`0 0 ${format.width} ${format.height}`}
          width={format.width * fitScale}
          height={format.height * fitScale}
          className="w-full h-full overflow-hidden block"
        >
          {/* Background fill */}
          <rect width={format.width} height={format.height} fill={canvasBg} />

          {/* Render objects sorted by zIndex */}
          {[...objects]
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((obj) => {
              const raw = getRawSvg(obj.illustrationId, size, obj.variant);
              const recolored = recolorSvg(raw, palette, obj.instanceId, obj.variant);
              const metrics = parseSvgViewBox(raw);
              const isSelected = obj.instanceId === selectedId;

              const originX = metrics.vbWidth / 2;
              const originY = metrics.vbHeight / 2;
              const transform = `translate(${obj.x - (originX + metrics.minX) * obj.scale}, ${obj.y - (originY + metrics.minY) * obj.scale}) scale(${obj.scale}) rotate(${obj.rotation} ${originX + metrics.minX} ${originY + metrics.minY})`;

              // Содержимое ассета + наследуемые атрибуты корня (как в экспорте)
              const innerSvg = `<g${readInheritedRootAttrs(recolored)}>${extractSvgInner(recolored)}</g>`;

              return (
                <g
                  key={obj.instanceId}
                  transform={transform}
                  className="cursor-grab active:cursor-grabbing group transition-opacity"
                  onPointerDown={(e) => handlePointerDown(e, obj)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(obj.instanceId);
                  }}
                >
                  {/* Invisible hit area */}
                  <rect
                    width={metrics.vbWidth}
                    height={metrics.vbHeight}
                    fill="transparent"
                  />

                  {/* Render Object Content */}
                  <g dangerouslySetInnerHTML={{ __html: innerSvg }} />

                  {/* Selection Outline Box */}
                  {isSelected && (
                    <rect
                      x={-4}
                      y={-4}
                      width={metrics.vbWidth + 8}
                      height={metrics.vbHeight + 8}
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth={2 / obj.scale}
                      strokeDasharray="4 4"
                      className="pointer-events-none"
                    />
                  )}
                </g>
              );
            })}

          {/* Debug overlay (AABB / grid / headline safe-zone) */}
          {showDebugOverlay && latestTrace ? renderDebugOverlay(latestTrace, format, fitScale) : null}
        </svg>
      </div>
    </div>
  );
};
