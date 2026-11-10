import React from 'react';
import { CanvasFormatId, CANVAS_FORMATS, DetailSize, Palette } from '../types';
import { BUILTIN_PALETTES } from '../utils/recolorEngine';
import { Download, Sparkles, Layers, Palette as PaletteIcon, Square, Maximize2, Smartphone } from 'lucide-react';

interface ToolbarProps {
  size: DetailSize;
  onSizeChange: (size: DetailSize) => void;
  format: CanvasFormatId;
  onFormatChange: (f: CanvasFormatId) => void;
  activePalette: Palette;
  onPaletteChange: (p: Palette) => void;
  onExport: () => void;
  onOpenAiModal: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  size,
  onSizeChange,
  format,
  onFormatChange,
  activePalette,
  onPaletteChange,
  onExport,
  onOpenAiModal,
}) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-[#0f1422] px-6 flex items-center justify-between z-30 select-none">
      {/* Brand & AI Prompt trigger */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20">
            О
          </div>
          <div>
            <div className="font-semibold text-sm tracking-wide text-slate-100">
              Студия Очень
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              Векторный конструктор
            </div>
          </div>
        </div>

        <button
          onClick={onOpenAiModal}
          className="ml-3 flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-purple-600/25 transition-all transform active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Собрать по метафоре (AI)</span>
        </button>
      </div>

      {/* Middle Options: Size & Formats */}
      <div className="flex items-center gap-6">
        {/* Detail Level: L / S */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => onSizeChange('L')}
            className={`px-3 py-1 rounded font-medium transition ${
              size === 'L'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Размер L
          </button>
          <button
            onClick={() => onSizeChange('S')}
            className={`px-3 py-1 rounded font-medium transition ${
              size === 'S'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Размер S
          </button>
        </div>

        {/* Canvas Formats */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => onFormatChange('square')}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition ${
              format === 'square'
                ? 'bg-slate-700/80 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="1:1 Квадрат"
          >
            <Square className="w-3.5 h-3.5" />
            <span>1:1</span>
          </button>
          <button
            onClick={() => onFormatChange('horizontal')}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition ${
              format === 'horizontal'
                ? 'bg-slate-700/80 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="16:9 Горизонтальный"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>16:9</span>
          </button>
          <button
            onClick={() => onFormatChange('vertical')}
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition ${
              format === 'vertical'
                ? 'bg-slate-700/80 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="9:16 Вертикальный"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>9:16</span>
          </button>
        </div>

        {/* Palette Selector */}
        <div className="flex items-center gap-2">
          {BUILTIN_PALETTES.map((p) => {
            const isActive = activePalette.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onPaletteChange(p)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition ${
                  isActive
                    ? 'border-purple-500 bg-purple-950/30 text-purple-200'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full border border-black/20"
                  style={{ backgroundColor: p.roles.bg }}
                />
                <span className="capitalize">{p.id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Export Action */}
      <div className="flex items-center gap-3">
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-600/20 transition active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Скачать SVG</span>
        </button>
      </div>
    </header>
  );
};
