import React, { useState } from 'react';
import { PRESET_METAPHORS } from '../utils/aiComposer';
import { Sparkles, X, ArrowRight } from 'lucide-react';

interface AiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => void;
}

export const AiModal: React.FC<AiModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [prompt, setPrompt] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerate(prompt.trim());
      onClose();
    }
  };

  const handleSelectPreset = (query: string) => {
    onGenerate(query);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#111827] border border-slate-700/80 rounded-2xl shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-2 text-purple-400 font-semibold text-sm">
          <Sparkles className="w-4 h-4" />
          <span>Сценарий 1: AI Metaphor Composer</span>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          Собрать сцену по метафоре
        </h2>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          Введите заголовок или смысл. Алгоритм подберёт релевантные изометрические объекты, сбалансирует главные и фоновые слои и расположит их на выбранном формате.
        </p>

        <form onSubmit={handleSubmit} className="mb-5">
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Например: Финтех-стартап и криптоаналитика..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-purple-500 focus:outline-none text-sm text-slate-100 placeholder-slate-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-purple-600/20 transition active:scale-95"
            >
              <span>Собрать</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Готовые примеры для проверки:
          </div>
          <div className="space-y-1.5">
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
      </div>
    </div>
  );
};
