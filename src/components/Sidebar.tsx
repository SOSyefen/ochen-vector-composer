import React, { useState } from 'react';
import { CanvasObject, DetailSize, IllustrationCatalogItem, IllustrationId, ObjectVariant, Palette } from '../types';
import { ILLUSTRATION_CATALOG, getRawSvg } from '../utils/svgRegistry';
import { recolorSvg, isAllowedCanvasBg, FORBIDDEN_CANVAS_BG_COLORS } from '../utils/recolorEngine';
import { Plus, Layers, Grid, Palette as PaletteIcon, Check, AlertCircle, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface SidebarProps {
  size: DetailSize;
  activePalette: Palette;
  canvasBg: string;
  onCanvasBgChange: (color: string) => void;
  objects: CanvasObject[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddObject: (id: IllustrationId, variant: ObjectVariant) => void;
  onUpdateObject: (updated: CanvasObject) => void;
  onDeleteObject: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  size,
  activePalette,
  canvasBg,
  onCanvasBgChange,
  objects,
  selectedId,
  onSelect,
  onAddObject,
  onUpdateObject,
  onDeleteObject,
  onBringForward,
  onSendBackward,
}) => {
  const [activeTab, setActiveTab] = useState<'library' | 'layers' | 'colors'>('library');
  const [addVariant, setAddVariant] = useState<ObjectVariant>('Main');
  const [bgError, setBgError] = useState<string | null>(null);

  const handleBgSelect = (color: string) => {
    if (isAllowedCanvasBg(color, activePalette)) {
      onCanvasBgChange(color);
      setBgError(null);
    } else {
      setBgError(`Цвет ${color} принадлежит палитре объектов и запрещён для фона холста.`);
    }
  };

  return (
    <aside className="w-80 h-full border-r border-slate-800 bg-[#0f1422] flex flex-col z-20 select-none">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-800 p-2 gap-1 bg-slate-900/60">
        <button
          onClick={() => setActiveTab('library')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${
            activeTab === 'library'
              ? 'bg-slate-800 text-purple-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Каталог</span>
        </button>
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${
            activeTab === 'layers'
              ? 'bg-slate-800 text-purple-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Слои ({objects.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('colors')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${
            activeTab === 'colors'
              ? 'bg-slate-800 text-purple-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PaletteIcon className="w-3.5 h-3.5" />
          <span>Цвета</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Tab 1: Library */}
        {activeTab === 'library' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Объекты ({size})
              </span>

              {/* Toggle variant before adding */}
              <div className="flex bg-slate-900 p-0.5 rounded-md border border-slate-800 text-[11px]">
                <button
                  onClick={() => setAddVariant('Main')}
                  className={`px-2 py-0.5 rounded ${
                    addVariant === 'Main'
                      ? 'bg-purple-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Главный
                </button>
                <button
                  onClick={() => setAddVariant('Bg')}
                  className={`px-2 py-0.5 rounded ${
                    addVariant === 'Bg'
                      ? 'bg-purple-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Фоновый
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {ILLUSTRATION_CATALOG.map((item) => {
                const raw = getRawSvg(item.id, size, addVariant);
                const previewSvg = recolorSvg(raw, activePalette, `preview_${item.id}`);

                return (
                  <div
                    key={item.id}
                    onClick={() => onAddObject(item.id, addVariant)}
                    className="group relative bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-purple-500/50 rounded-xl p-2.5 flex flex-col items-center justify-center cursor-pointer transition-all shadow-sm hover:shadow-purple-500/10 active:scale-95"
                  >
                    <div
                      className="w-full h-24 flex items-center justify-center overflow-hidden"
                      dangerouslySetInnerHTML={{ __html: previewSvg }}
                    />
                    <div className="mt-1 text-xs text-slate-300 font-medium capitalize">
                      {item.label}
                    </div>
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition bg-purple-600 text-white p-1 rounded-md shadow">
                      <Plus className="w-3 h-3" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Layers */}
        {activeTab === 'layers' && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Объекты на сцене (сверху вниз)
            </div>

            {objects.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                Холст пуст. Добавьте элементы из каталога или сгенерируйте сцену по метафоре.
              </div>
            ) : (
              [...objects]
                .sort((a, b) => b.zIndex - a.zIndex)
                .map((obj, idx) => {
                  const isSelected = obj.instanceId === selectedId;
                  return (
                    <div
                      key={obj.instanceId}
                      onClick={() => onSelect(obj.instanceId)}
                      className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition cursor-pointer ${
                        isSelected
                          ? 'border-purple-500 bg-purple-950/20 text-white'
                          : 'border-slate-800/80 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-mono w-4">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="font-medium capitalize">
                            {obj.illustrationId}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateObject({
                                ...obj,
                                variant: obj.variant === 'Main' ? 'Bg' : 'Main',
                              });
                            }}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono mt-0.5 ${
                              obj.variant === 'Main'
                                ? 'bg-indigo-900/60 text-indigo-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {obj.variant === 'Main' ? 'Главный' : 'Фоновый'}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onBringForward(obj.instanceId);
                          }}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                          title="Выше"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSendBackward(obj.instanceId);
                          }}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                          title="Ниже"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteObject(obj.instanceId);
                          }}
                          className="p-1 hover:bg-rose-950/50 text-rose-400 rounded ml-1"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* Tab 3: Colors & Rules */}
        {activeTab === 'colors' && (
          <div className="space-y-5">
            <div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Цвет фона холста
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Выберите один из утверждённых цветов фона палитры:
              </p>

              <div className="flex items-center gap-2 mb-2">
                {['#D7CDF5', '#FDD7B9', '#BEEBEB', '#FFFFFF'].map((hex) => {
                  const isCurrent = canvasBg.toUpperCase() === hex.toUpperCase();
                  return (
                    <button
                      key={hex}
                      onClick={() => handleBgSelect(hex)}
                      className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center transition shadow-sm ${
                        isCurrent
                          ? 'border-purple-400 scale-105'
                          : 'border-slate-700 hover:border-slate-500'
                      }`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                    >
                      {isCurrent && (
                        <Check className="w-4 h-4 text-slate-900 stroke-[3]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {bgError && (
                <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/80 text-[11px] text-rose-300 mt-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{bgError}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-purple-950/20 border border-purple-800/30 rounded-xl">
              <div className="text-xs font-semibold text-purple-300 mb-1">
                Правило дизайн-системы:
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                «Цвета фонов могут использоваться в объектах. Цвета для объектов не могут использоваться в фонах».
              </p>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Текущие роли палитры ({activePalette.name})
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                {Object.entries(activePalette.roles).map(([role, hex]) => (
                  <div
                    key={role}
                    className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800/60"
                  >
                    <span className="text-slate-400 text-[11px] capitalize">
                      {role.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300 text-[11px]">{hex}</span>
                      <div
                        className="w-3.5 h-3.5 rounded border border-black/20"
                        style={{ backgroundColor: hex }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
