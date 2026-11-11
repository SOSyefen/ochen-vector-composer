import React, { useState } from 'react';
import {
  PRESET_METAPHORS,
  LAYOUT_STYLE_OPTIONS,
  LayoutStyle,
} from '../utils/aiComposer';
import { ILLUSTRATION_CATALOG } from '../utils/svgRegistry';
import { IllustrationId } from '../types';
import { Sparkles, X, ArrowRight, LayoutGrid, Type, Check, Star } from 'lucide-react';

interface AiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, layoutStyle?: LayoutStyle) => void;
}

export const AiModal: React.FC<AiModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [activeTab, setActiveTab] = useState<'metaphor' | 'components'>('metaphor');
  const [prompt, setPrompt] = useState('');
  const [selectedComponents, setSelectedComponents] = useState<IllustrationId[]>([
    'notebook',
    'headphones',
    'vase',
    'pen',
  ]);
  const [selectedStyle, setSelectedStyle] = useState<LayoutStyle>('centered');

  if (!isOpen) return null;

  const handleToggleComponent = (id: IllustrationId) => {
    setSelectedComponents((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApplyReferencePreset = () => {
    setSelectedComponents(['notebook', 'headphones', 'vase', 'pen']);
    setSelectedStyle('centered');
  };

  const handleSubmitMetaphor = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerate(prompt.trim(), selectedStyle);
      onClose();
    }
  };

  const handleSubmitComponents = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedComponents.length > 0) {
      // Create comma-separated prompt containing the selected component labels
      const componentLabels = selectedComponents
        .map((id) => ILLUSTRATION_CATALOG.find((item) => item.id === id)?.label || id)
        .join(', ');
      onGenerate(componentLabels, selectedStyle);
      onClose();
    }
  };

  const handleSelectPreset = (query: string) => {
    onGenerate(query, selectedStyle);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#111827] border border-slate-700/80 rounded-2xl shadow-2xl p-6 relative flex flex-col max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-1 text-purple-400 font-semibold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4" />
          <span>Генератор композиций (AI Composer)</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-4">
          Автоматическая сборка изометрической сцены
        </h2>

        {/* Tab Switcher (Scenario 1 vs Scenario 2) */}
        <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 mb-5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('metaphor')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition ${
              activeTab === 'metaphor'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Сценарий 1: По метафоре / заголовку</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('components')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition ${
              activeTab === 'components'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Сценарий 2: По списку компонентов</span>
          </button>
        </div>

        {/* Scheme / Layout Style Selector (Canonical 3 Schemes) */}
        <div className="mb-4">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Схема расположения объектов (3 канона арт-директора):
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LAYOUT_STYLE_OPTIONS.map((style) => {
              const isSelected = selectedStyle === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setSelectedStyle(style.id)}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    isSelected
                      ? 'border-purple-500 bg-purple-950/30 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-200 mb-1 flex items-center justify-between">
                    <span>{style.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    {style.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1 Content: Scenario 1 (Metaphor) */}
        {activeTab === 'metaphor' && (
          <div className="flex-1 overflow-y-auto pr-1">
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Введите заголовок статьи, слоган или смысл. Алгоритм определит архетип, подберёт релевантный набор объектов и сбалансирует слои на холсте.
            </p>

            <form onSubmit={handleSubmitMetaphor} className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Например: Ночной кодинг в наушниках и глубокий фокус..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-purple-500 focus:outline-none text-sm text-slate-100 placeholder-slate-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!prompt.trim()}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-purple-600/20 transition active:scale-95 shrink-0"
                >
                  <span>Собрать</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>

            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Готовые метафоры для проверки:
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {PRESET_METAPHORS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(preset.query)}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-900/60 hover:bg-purple-950/30 border border-slate-800 hover:border-purple-700/60 transition group flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-medium text-slate-200 group-hover:text-purple-300">
                      {preset.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-sm">
                      {preset.query}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2 Content: Scenario 2 (Explicit Components) */}
        {activeTab === 'components' && (
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Выберите нужные предметы из библиотеки. Программа автоматически скомпонует их по слоям (база, фон, герой, акцент).
              </p>
              <button
                type="button"
                onClick={handleApplyReferencePreset}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 border border-purple-700/50 text-[11px] font-medium transition shrink-0 ml-2"
                title="Установить эталонный набор арт-директора"
              >
                <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
                <span>Эталон арт-директора</span>
              </button>
            </div>

            {/* Component Chips Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              {ILLUSTRATION_CATALOG.map((item) => {
                const isSelected = selectedComponents.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggleComponent(item.id)}
                    className={`p-2 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                      isSelected
                        ? 'border-purple-500 bg-purple-950/40 text-purple-200 shadow-sm'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <span className="font-medium truncate">{item.label}</span>
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] shrink-0 ml-1.5 transition ${
                        isSelected
                          ? 'border-purple-400 bg-purple-600 text-white'
                          : 'border-slate-700 bg-slate-800 text-transparent'
                      }`}
                    >
                      ✓
                    </div>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmitComponents} className="pt-2 border-t border-slate-800 flex justify-between items-center">
              <div className="text-[11px] text-slate-400">
                Выбрано компонентов:{' '}
                <span className="text-purple-300 font-semibold">{selectedComponents.length}</span>
              </div>
              <button
                type="submit"
                disabled={selectedComponents.length === 0}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-purple-600/20 transition active:scale-95"
              >
                <span>Собрать композицию ({selectedComponents.length})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
