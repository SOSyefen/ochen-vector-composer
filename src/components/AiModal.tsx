import React, { useState } from 'react';
import {
  PRESET_METAPHORS,
  LAYOUT_STYLE_OPTIONS,
  type LayoutStyle,
  type LayoutStyleOption,
} from '../utils/aiComposer';
import { ILLUSTRATION_CATALOG } from '../utils/svgRegistry';
import { IllustrationId } from '../types';
import { Sparkles, X, ArrowRight, LayoutGrid, Type, Check, Star } from 'lucide-react';

export interface AiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateMetaphor: (prompt: string, layoutStyle?: LayoutStyle) => void;
  onGenerateComponents: (items: IllustrationId[], layoutStyle?: LayoutStyle) => void;
}

interface PresetLike {
  id: string;
  query: string;
  layoutStyle?: LayoutStyle;
  name?: string;
  title?: string;
  label?: string;
  description?: string;
  components?: string[];
}

const DIRECTOR_STANDARD_ITEMS: IllustrationId[] = ['notebook', 'headphones', 'vase', 'pen'];

export const AiModal: React.FC<AiModalProps> = ({
  isOpen,
  onClose,
  onGenerateMetaphor,
  onGenerateComponents,
}) => {
  const [activeTab, setActiveTab] = useState<'metaphor' | 'components'>('metaphor');
  const [prompt, setPrompt] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<IllustrationId[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<LayoutStyle>('centered');

  const presets = PRESET_METAPHORS as unknown as PresetLike[];

  const submitMetaphor = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    onGenerateMetaphor(trimmed, selectedStyle);
    onClose();
  };

  const handlePresetSelect = (preset: PresetLike) => {
    onGenerateMetaphor(preset.query, preset.layoutStyle || selectedStyle);
    onClose();
  };

  const handleGenerateComponents = () => {
    if (selectedItems.length === 0) return;
    onGenerateComponents(selectedItems, selectedStyle);
    onClose();
  };

  const toggleItem = (id: IllustrationId) => {
    setSelectedItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const applyDirectorStandard = () => {
    setSelectedItems([...DIRECTOR_STANDARD_ITEMS]);
    setSelectedStyle('centered');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-[#181920] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden text-slate-200"
        style={{
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header (Fixed) */}
        <div className="flex justify-between items-center p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
              <Sparkles size={20} />
            </div>
            <h2 className="text-lg font-bold text-[#F3F4F6]">Генератор композиций (AI Composer)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs (Fixed) */}
        <div className="flex border-b border-white/10 flex-shrink-0 px-4 bg-[#14151b]">
          <button
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition border-b-2 -mb-px ${
              activeTab === 'metaphor'
                ? 'text-indigo-400 border-indigo-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
            onClick={() => setActiveTab('metaphor')}
          >
            <Type size={16} />
            По метафоре / смыслу
          </button>
          <button
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition border-b-2 -mb-px ${
              activeTab === 'components'
                ? 'text-indigo-400 border-indigo-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
            onClick={() => setActiveTab('components')}
          >
            <LayoutGrid size={16} />
            По списку компонентов
          </button>
        </div>

        {/* Tab Content (Scrollable with bottom padding) */}
        <div className="p-5 overflow-y-auto flex-1 pb-8 space-y-5">
          {/* Metaphor Tab */}
          {activeTab === 'metaphor' && (
            <div className="space-y-4">
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                Введите заголовок статьи, слоган или метафору. Алгоритм подберёт релевантный набор объектов и сбалансирует слои.
              </p>

              <div className="flex gap-2.5">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      submitMetaphor();
                    }
                  }}
                  placeholder="Например: Музыка и фокус в работе..."
                  className="flex-1 bg-[#22242E] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={submitMetaphor}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition active:scale-95"
                >
                  Собрать <ArrowRight size={16} />
                </button>
              </div>

              <div className="pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Готовые пресеты и метафоры:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {presets.map(preset => (
                    <div
                      key={preset.id}
                      className="bg-[#22242E] border border-white/[0.08] hover:border-indigo-500 hover:bg-[#282B38] rounded-xl p-3.5 cursor-pointer transition group shadow-sm"
                      onClick={() => handlePresetSelect(preset)}
                    >
                      <div className="font-semibold text-sm text-[#F3F4F6] group-hover:text-indigo-300 transition flex items-center justify-between">
                        <span>{preset.name || preset.title || preset.label}</span>
                      </div>
                      <div className="text-xs text-[#9CA3AF] mt-1 leading-snug">
                        {preset.description || preset.query}
                      </div>
                      {preset.components && (
                        <div className="text-[11px] font-mono text-indigo-400/90 mt-2 flex items-center gap-1.5 flex-wrap">
                          {preset.components.map((cid: string) => (
                            <span key={cid} className="px-1.5 py-0.5 rounded bg-black/30 border border-white/5">
                              {cid}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Components Tab */}
          {activeTab === 'components' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-[#9CA3AF]">
                  Выберите нужные предметы из библиотеки (10 предметов):
                </p>
                <button
                  onClick={applyDirectorStandard}
                  className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-xs font-medium transition"
                >
                  <Star size={14} className="text-amber-400" />
                  Базовый пресет
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {ILLUSTRATION_CATALOG.map(item => {
                  const isSelected = selectedItems.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition ${
                        isSelected
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-sm'
                          : 'bg-[#22242E] border-white/10 text-slate-300 hover:bg-[#282B38] hover:border-white/20'
                      }`}
                      onClick={() => toggleItem(item.id)}
                    >
                      <span className="truncate w-full text-center">{item.label}</span>
                      {isSelected ? (
                        <Check className="mt-1 text-indigo-400" size={14} />
                      ) : (
                        <span className="h-3.5 mt-1 block"></span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-2">
                <div className="text-xs text-[#9CA3AF]">
                  Выбрано: <span className="font-semibold text-white">{selectedItems.length}</span> предметов (рек. 2–3)
                </div>
                <button
                  onClick={handleGenerateComponents}
                  disabled={selectedItems.length === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition ${
                    selectedItems.length > 0
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                  }`}
                >
                  Собрать композицию ({selectedItems.length}) <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Layout Selector */}
          <div className="pt-4 border-t border-white/10">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Схема расположения:
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              {LAYOUT_STYLE_OPTIONS.map((style: LayoutStyleOption) => (
                <button
                  key={style.id}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition text-left ${
                    selectedStyle === style.id
                      ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300 shadow-sm'
                      : 'bg-[#22242E] border-white/10 text-slate-400 hover:bg-[#282B38] hover:text-slate-200'
                  }`}
                  onClick={() => setSelectedStyle(style.id)}
                >
                  <div className="font-semibold text-slate-200">{style.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                    {style.id === 'centered'
                      ? 'Островок по центру'
                      : style.id === 'offset'
                        ? 'Диагональный баланс'
                        : 'Свободно слева'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiModal;
