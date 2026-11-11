import { describe, expect, it } from 'vitest';
import type { IllustrationId } from '../../types';
import { PRESET_METAPHORS } from '../catalog';
import {
  extractComponentsFromText,
  hashString,
  normalizeText,
  parseIntent,
  pickFallbackPreset,
} from '../pipeline/1-intentParser';

describe('normalizeText', () => {
  it('приводит к нижнему регистру и заменяет ё на е', () => {
    expect(normalizeText('КошелЁк Ёлка')).toBe('кошелек елка');
  });
});

describe('hashString', () => {
  it('детерминирован и возвращает uint32', () => {
    const h = hashString('abc');
    expect(hashString('abc')).toBe(h);
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

describe('extractComponentsFromText', () => {
  it('сохраняет порядок упоминания', () => {
    expect(extractComponentsFromText('Смартфон, Пазл, Букет цветов, Папка')).toEqual([
      'phone',
      'puzzle',
      'vase',
      'folder',
    ]);
  });

  it('понимает «ё» и словоформы', () => {
    expect(extractComponentsFromText('Кошелёк, монетками и лампой')).toEqual([
      'notebook',
      'coin',
      'lamp',
    ]);
  });

  it('понимает английские синонимы', () => {
    expect(extractComponentsFromText('headphones with flowers and coins')).toEqual([
      'headphones',
      'vase',
      'coin',
    ]);
  });

  it('пустой текст -> пустой список', () => {
    expect(extractComponentsFromText('')).toEqual([]);
    expect(extractComponentsFromText('   ')).toEqual([]);
  });
});

describe('parseIntent', () => {
  it('явный список компонентов не перехватывается пресетами', () => {
    const intent = parseIntent(undefined, ['puzzle', 'vase', 'folder']);
    expect(intent.strategy).toBe('explicit_components');
    expect(intent.matchedRuleId).toBeNull();
    expect(intent.rawComponents).toEqual(['puzzle', 'vase', 'folder']);
    expect(intent.rawComponents).not.toContain('lamp');
    expect(intent.resolvedStyle).toBe('centered');
  });

  it('явный список дедуплицируется и фильтрует невалидные id', () => {
    const intent = parseIntent(undefined, ['phone', 'phone', 'bogus' as IllustrationId]);
    expect(intent.rawComponents).toEqual(['phone']);
  });

  it.each(PRESET_METAPHORS)('точный запрос пресета $id -> exact_preset', (preset) => {
    const byQuery = parseIntent(preset.query);
    expect(byQuery.strategy).toBe('exact_preset');
    expect(byQuery.matchedRuleId).toBe(preset.id);
    expect(byQuery.resolvedStyle).toBe(preset.layoutStyle);

    const byId = parseIntent(preset.id);
    expect(byId.strategy).toBe('exact_preset');
    expect(byId.rawComponents).toEqual(preset.components);
  });

  it('явные предметы в тексте важнее ключей пресета missing-puzzle', () => {
    const intent = parseIntent('Смартфон, Пазл, Букет цветов, Папка');
    expect(intent.strategy).toBe('explicit_components');
    expect(intent.matchedRuleId).toBeNull();
    expect(intent.rawComponents).toEqual(['phone', 'puzzle', 'vase', 'folder']);
  });

  it('нечёткое совпадение ключевых слов пресета', () => {
    const intent = parseIntent('план бюджета на месяц');
    expect(intent.strategy).toBe('preset_keyword');
    expect(intent.matchedRuleId).toBe('personal-budget');
  });

  it('семантическая тема', () => {
    const intent = parseIntent('осень и вечер');
    expect(intent.strategy).toBe('semantic_theme');
    expect(intent.matchedRuleId).toBe('cozy');
  });

  it('детерминированный fallback', () => {
    const a = parseIntent('абракадабра');
    const b = parseIntent('абракадабра');
    expect(a.strategy).toBe('deterministic_fallback');
    expect(a.matchedRuleId).toBe(`fallback:${pickFallbackPreset('абракадабра').index}`);
    expect(b).toEqual(a);
  });

  it('пустой запрос -> fallback', () => {
    expect(parseIntent('').strategy).toBe('deterministic_fallback');
    expect(parseIntent().strategy).toBe('deterministic_fallback');
  });

  it('styleOverride имеет приоритет', () => {
    expect(parseIntent('music-focus', undefined, 'offset').resolvedStyle).toBe('offset');
    expect(parseIntent(undefined, ['phone', 'coin'], 'headline').resolvedStyle).toBe('headline');
  });

  it('слово «заголовок» включает headline для явных предметов', () => {
    const intent = parseIntent('наушники и папка под заголовок');
    expect(intent.strategy).toBe('explicit_components');
    expect(intent.resolvedStyle).toBe('headline');
  });
});
