/**
 * Шаг 1 пайплайна: семантический разбор запроса.
 * ZERO-DOM: чистые функции без побочных эффектов.
 *
 * Приоритет стратегий:
 *  0) explicitComponents (непустой валидный список) -> 'explicit_components'
 *  1) 'exact_preset'          — точное совпадение query/id пресета
 *  2) 'explicit_components'   — >= 2 явных предметов в тексте (важнее нечётких ключей!)
 *  3) 'preset_keyword'        — нечёткое совпадение ключевых слов/лейбла пресета
 *  4) 'semantic_theme'        — тематический словарь
 *  5) 'deterministic_fallback'— хэш-детерминированный выбор пресета
 */
import { IllustrationId } from '../../types';
import {
  COMPONENT_KEYWORDS,
  FALLBACK_PRESETS,
  FallbackPreset,
  isIllustrationId,
  LayoutStyle,
  PRESET_METAPHORS,
  PresetMetaphor,
  SEMANTIC_METAPHOR_THEMES,
  SemanticTheme,
} from '../catalog';
import { IntentResolution } from '../contracts';

const DEFAULT_STYLE: LayoutStyle = 'centered';

/** Нижний регистр + «ё» -> «е» */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е');
}

/** FNV-1a 32-bit — детерминированный хэш строки */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function dedupe<T>(list: readonly T[]): T[] {
  return Array.from(new Set(list));
}

/**
 * Извлекает все русские и английские синонимы 10 предметов каталога
 * в порядке их упоминания в тексте.
 */
export function extractComponentsFromText(text: string): IllustrationId[] {
  if (!text || !text.trim()) return [];
  const normalized = normalizeText(text);

  const hits: Array<{ id: IllustrationId; index: number }> = [];
  for (const { id, regex } of COMPONENT_KEYWORDS) {
    const match = regex.exec(normalized);
    if (match) {
      hits.push({ id, index: match.index });
    }
  }

  hits.sort((a, b) => a.index - b.index);
  return hits.map((h) => h.id);
}

function keywordHits(tokens: readonly string[], joined: string, keywords: readonly string[]): number {
  let hits = 0;
  for (const raw of keywords) {
    const kw = normalizeText(raw);
    let hit = false;
    if (kw.includes(' ')) {
      hit = joined.includes(` ${kw}`);
    } else if (kw.length <= 2) {
      hit = tokens.includes(kw);
    } else if (kw.length === 3) {
      hit = tokens.some((t) => t.startsWith(kw) && t.length <= kw.length + 2);
    } else {
      hit = tokens.some((t) => t.startsWith(kw));
    }
    if (hit) hits++;
  }
  return hits;
}

/** Возвращает тему с наибольшим числом совпадений ключевых слов либо null */
export function matchSemanticTheme(prompt: string): SemanticTheme | null {
  const tokens = normalizeText(prompt).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!tokens.length) return null;
  const joined = ` ${tokens.join(' ')} `;
  let best: SemanticTheme | null = null;
  let bestScore = 0;
  for (const theme of SEMANTIC_METAPHOR_THEMES) {
    const score = keywordHits(tokens, joined, theme.keywords);
    if (score > bestScore) {
      best = theme;
      bestScore = score;
    }
  }
  return best;
}

export function pickFallbackPreset(prompt: string): { index: number; preset: FallbackPreset } {
  const normalized = normalizeText(prompt).trim();
  const index = hashString(normalized) % FALLBACK_PRESETS.length;
  return { index, preset: FALLBACK_PRESETS[index] };
}

export function resolveFallbackTheme(prompt: string): { components: IllustrationId[]; style: LayoutStyle } {
  const { preset } = pickFallbackPreset(prompt);
  return { components: [...preset.components], style: preset.style };
}

export function resolveSemanticTheme(prompt: string): { components: IllustrationId[]; style: LayoutStyle } {
  const theme = matchSemanticTheme(prompt);
  return theme
    ? { components: [...theme.components], style: theme.style }
    : resolveFallbackTheme(prompt);
}

function findExactPreset(trimmedNormalized: string): PresetMetaphor | undefined {
  return PRESET_METAPHORS.find(
    (preset) =>
      normalizeText(preset.query) === trimmedNormalized ||
      preset.id.toLowerCase() === trimmedNormalized
  );
}

function findKeywordPreset(normalized: string): PresetMetaphor | undefined {
  return PRESET_METAPHORS.find((preset) => {
    if (preset.keywords.some((kw) => normalized.includes(normalizeText(kw)))) return true;
    if (preset.label && normalized.includes(normalizeText(preset.label))) return true;
    return false;
  });
}

function fallbackResolution(
  prompt: string,
  extracted: IllustrationId[],
  styleOverride?: LayoutStyle
): IntentResolution {
  const { index, preset } = pickFallbackPreset(prompt);
  return {
    strategy: 'deterministic_fallback',
    matchedRuleId: `fallback:${index}`,
    extractedExplicit: extracted,
    rawComponents: [...preset.components],
    resolvedStyle: styleOverride ?? preset.style,
  };
}

export function parseIntent(
  prompt?: string,
  explicitComponents?: IllustrationId[],
  styleOverride?: LayoutStyle
): IntentResolution {
  // 0. Явный список компонентов из UI/CLI — никакого перехвата пресетами
  if (explicitComponents && explicitComponents.length > 0) {
    const valid = dedupe(explicitComponents.filter(isIllustrationId));
    if (valid.length > 0) {
      return {
        strategy: 'explicit_components',
        matchedRuleId: null,
        extractedExplicit: valid,
        rawComponents: [...valid],
        resolvedStyle: styleOverride ?? DEFAULT_STYLE,
      };
    }
  }

  const rawPrompt = prompt ?? '';
  const normalized = normalizeText(rawPrompt);
  const trimmed = normalized.trim();
  const extracted = extractComponentsFromText(rawPrompt);

  if (!trimmed) {
    return fallbackResolution('', extracted, styleOverride);
  }

  // 1. Точный запрос пресета или его id
  const exact = findExactPreset(trimmed);
  if (exact) {
    return {
      strategy: 'exact_preset',
      matchedRuleId: exact.id,
      extractedExplicit: extracted,
      rawComponents: [...exact.components],
      resolvedStyle: styleOverride ?? exact.layoutStyle,
    };
  }

  // 2. Явные упоминания предметов (приоритет над нечёткими ключами пресетов)
  if (extracted.length >= 2) {
    const wantsHeadline = normalized.includes('заголовок') || normalized.includes('headline');
    return {
      strategy: 'explicit_components',
      matchedRuleId: null,
      extractedExplicit: extracted,
      rawComponents: [...extracted],
      resolvedStyle: styleOverride ?? (wantsHeadline ? 'headline' : DEFAULT_STYLE),
    };
  }

  // 3. Нечёткое совпадение ключевых слов/лейбла пресета
  const keywordPreset = findKeywordPreset(normalized);
  if (keywordPreset) {
    return {
      strategy: 'preset_keyword',
      matchedRuleId: keywordPreset.id,
      extractedExplicit: extracted,
      rawComponents: [...keywordPreset.components],
      resolvedStyle: styleOverride ?? keywordPreset.layoutStyle,
    };
  }

  // 4. Семантическая тема
  const theme = matchSemanticTheme(rawPrompt);
  if (theme) {
    return {
      strategy: 'semantic_theme',
      matchedRuleId: theme.id,
      extractedExplicit: extracted,
      rawComponents: [...theme.components],
      resolvedStyle: styleOverride ?? theme.style,
    };
  }

  // 5. Детерминированный fallback
  return fallbackResolution(rawPrompt, extracted, styleOverride);
}
