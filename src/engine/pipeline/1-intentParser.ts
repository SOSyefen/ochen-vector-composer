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
 *  5) 'explicit_components'   — единственный распознанный предмет («букет», «смартфон»)
 *  5.5) fuzzy typo recovery   — префиксное расстояние Дамерау–Левенштейна по основам слов
 *  6) 'deterministic_fallback'— хэш-детерминированный выбор пресета
 */
import { IllustrationId } from '../../types';
import {
  COMPONENT_KEYWORDS,
  FALLBACK_PRESETS,
  FallbackPreset,
  FUZZY_COMPONENT_STEMS,
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

// ---- Fuzzy typo recovery ---------------------------------------------------

/** Минимальная длина пользовательского токена для нечёткого сравнения */
const FUZZY_MIN_TOKEN_LENGTH = 4;

/**
 * Расстояние Дамерау–Левенштейна (optimal string alignment):
 * вставки, удаления, замены и перестановки соседних символов.
 */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;

  const d: number[][] = [];
  for (let i = 0; i <= n; i++) {
    d.push(new Array<number>(m + 1).fill(0));
    d[i][0] = i;
  }
  for (let j = 0; j <= m; j++) d[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2][j - 2] + 1);
      }
      d[i][j] = v;
    }
  }
  return d[n][m];
}

/** Допустимое расстояние в зависимости от длины основы (M) и токена (N) */
function fuzzyMaxDistance(stemLen: number, tokenLen: number): number {
  if (stemLen < 4) return 0;
  if (stemLen === 4) return tokenLen <= 5 ? 1 : 0;
  if (stemLen <= 6) return 1;
  return 2;
}

/**
 * Префиксное расстояние токена до основы.
 * Если токен длиннее основы — основа сравнивается со всеми префиксами длиной M-1, M, M+1
 * (учёт окончаний + опечаток одновременно). Возвращает Infinity, если выше порога.
 */
export function prefixFuzzyDistance(token: string, stem: string): number {
  const n = token.length;
  const m = stem.length;
  if (m < 4) return token === stem ? 0 : Infinity;

  const limit = fuzzyMaxDistance(m, n);
  if (n < m && m - n > limit) return Infinity;

  const candidates = n > m
    ? dedupe([token.slice(0, m - 1), token.slice(0, m), token.slice(0, m + 1)].filter(Boolean))
    : [token];

  let best = Infinity;
  for (const candidate of candidates) {
    const dist = damerauLevenshtein(stem, candidate);
    if (dist < best) best = dist;
  }
  return best <= limit ? best : Infinity;
}

interface FuzzyComponentStemEntry {
  id: IllustrationId;
  stem: string;
}

interface FuzzyRuleStemEntry {
  kind: 'preset_keyword' | 'semantic_theme';
  ruleId: string;
  stem: string;
  components: readonly IllustrationId[];
  style: LayoutStyle;
}

function buildFuzzyComponentStems(): FuzzyComponentStemEntry[] {
  const out: FuzzyComponentStemEntry[] = [];
  for (const entry of FUZZY_COMPONENT_STEMS) {
    for (const raw of entry.stems) {
      const stem = normalizeText(raw).trim();
      if (stem) out.push({ id: entry.id, stem });
    }
  }
  return out;
}

function buildFuzzyRuleStems(): FuzzyRuleStemEntry[] {
  const out: FuzzyRuleStemEntry[] = [];
  const seen = new Set<string>();
  const push = (
    kind: FuzzyRuleStemEntry['kind'],
    ruleId: string,
    raw: string,
    components: readonly IllustrationId[],
    style: LayoutStyle
  ): void => {
    const stem = normalizeText(raw).trim();
    // только однословные буквенные основы: «арт-директор», «home office» не участвуют
    if (stem.length < FUZZY_MIN_TOKEN_LENGTH || !/^\p{L}+$/u.test(stem)) return;
    const key = `${kind}|${ruleId}|${stem}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, ruleId, stem, components, style });
  };

  for (const preset of PRESET_METAPHORS) {
    for (const kw of preset.keywords) {
      push('preset_keyword', preset.id, kw, preset.components, preset.layoutStyle);
    }
  }
  for (const theme of SEMANTIC_METAPHOR_THEMES) {
    for (const kw of theme.keywords) {
      push('semantic_theme', theme.id, kw, theme.components, theme.style);
    }
  }
  return out;
}

const FUZZY_COMPONENT_ENTRIES: readonly FuzzyComponentStemEntry[] = buildFuzzyComponentStems();
const FUZZY_RULE_ENTRIES: readonly FuzzyRuleStemEntry[] = buildFuzzyRuleStems();

function tokenizeForFuzzy(text: string): string[] {
  const tokens = normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= FUZZY_MIN_TOKEN_LENGTH);
  return dedupe(tokens);
}

interface FuzzyComponentMatch {
  token: string;
  id: IllustrationId;
}

/** Для каждого токена выбирает предмет с наименьшей нормированной дистанцией */
function fuzzyRecoverComponents(tokens: readonly string[]): FuzzyComponentMatch[] {
  const result: FuzzyComponentMatch[] = [];
  const seen = new Set<IllustrationId>();
  for (const token of tokens) {
    let best: { id: IllustrationId; score: number } | null = null;
    for (const entry of FUZZY_COMPONENT_ENTRIES) {
      const dist = prefixFuzzyDistance(token, entry.stem);
      if (!Number.isFinite(dist)) continue;
      const score = dist / entry.stem.length;
      if (!best || score < best.score) best = { id: entry.id, score };
    }
    if (best && !seen.has(best.id)) {
      seen.add(best.id);
      result.push({ token, id: best.id });
    }
  }
  return result;
}

/** Лучшее нечёткое совпадение с ключевыми словами пресетов/тем */
function fuzzyRecoverRule(tokens: readonly string[]): FuzzyRuleStemEntry | null {
  let best: FuzzyRuleStemEntry | null = null;
  let bestScore = Infinity;
  for (const token of tokens) {
    for (const entry of FUZZY_RULE_ENTRIES) {
      const dist = prefixFuzzyDistance(token, entry.stem);
      if (!Number.isFinite(dist)) continue;
      const score = dist / entry.stem.length;
      if (score < bestScore) {
        best = entry;
        bestScore = score;
      }
    }
  }
  return best;
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

  // 5. Один распознанный предмет: roleResolver достроит сцену детерминированными компаньонами
  if (extracted.length >= 1) {
    return {
      strategy: 'explicit_components',
      matchedRuleId: null,
      extractedExplicit: extracted,
      rawComponents: [extracted[0]],
      resolvedStyle: styleOverride ?? DEFAULT_STYLE,
    };
  }

  // 5.5. Нечёткое восстановление опечаток (префиксный Дамерау–Левенштейн)
  const fuzzyTokens = tokenizeForFuzzy(rawPrompt);
  if (fuzzyTokens.length > 0) {
    const recovered = fuzzyRecoverComponents(fuzzyTokens);
    if (recovered.length > 0) {
      const ids = recovered.map((m) => m.id);
      return {
        strategy: 'explicit_components',
        matchedRuleId: `fuzzy:components:${recovered.map((m) => `${m.token}->${m.id}`).join(',')}`,
        extractedExplicit: ids,
        rawComponents: [...ids],
        resolvedStyle: styleOverride ?? DEFAULT_STYLE,
      };
    }

    const rule = fuzzyRecoverRule(fuzzyTokens);
    if (rule) {
      return {
        strategy: rule.kind,
        matchedRuleId: `fuzzy:${rule.ruleId}`,
        extractedExplicit: extracted,
        rawComponents: [...rule.components],
        resolvedStyle: styleOverride ?? rule.style,
      };
    }
  }

  // 6. Детерминированный fallback
  return fallbackResolution(rawPrompt, extracted, styleOverride);
}
