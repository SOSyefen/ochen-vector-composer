import React, { useRef, useState, useEffect } from 'react';
import { CanvasFormatConfig, CanvasObject, DetailSize, Palette } from '../types';
import { getRawSvg, parseSvgViewBox } from '../utils/svgRegistry';
import { recolorSvg } from '../utils/recolorEngine';
import { Move, RotateCw, Trash2, Copy, ArrowUp, ArrowDown } from 'lucide-react';

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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
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
      setFitScale(Math.min(scaleX, scaleY, 1.0));
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
              const recolored = recolorSvg(raw, palette, obj.instanceId);
              const metrics = parseSvgViewBox(raw);
              const isSelected = obj.instanceId === selectedId;

              const originX = metrics.vbWidth / 2;
              const originY = metrics.vbHeight / 2;
              const transform = `translate(${obj.x - originX * obj.scale}, ${obj.y - originY * obj.scale}) scale(${obj.scale}) rotate(${obj.rotation} ${originX} ${originY})`;

              // Parse inner SVG markup
              const match = recolored.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
              const innerSvg = match ? match[1] : '';

              return (
                <g
                  key={obj.instanceId}
                  transform={transform}
                  className="cursor-grab active:cursor-grabbing group transition-opacity"
                  onPointerDown={(e) => handlePointerDown(e, obj)}
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
        </svg>
      </div>
    </div>
  );
};
