import { describe, expect, it } from 'vitest';
import type { IllustrationId } from '../../types';
import { PRESET_METAPHORS } from '../catalog';
import {
  damerauLevenshtein,
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

  it('одиночное «библиотека» даёт сцену с book, а не случайный fallback', () => {
    const intent = parseIntent('библиотека');
    expect(intent.strategy).not.toBe('deterministic_fallback');
    expect(intent.rawComponents).toContain('book');
  });

  it('одиночный предмет («букет») -> explicit_components с этим предметом', () => {
    const intent = parseIntent('букет');
    expect(intent.strategy).toBe('explicit_components');
    expect(intent.matchedRuleId).toBeNull();
    expect(intent.rawComponents).toEqual(['vase']);
  });

  it('«Эталон арт-директора» -> director-standard', () => {
    const intent = parseIntent('Эталон арт-директора');
    expect(intent.strategy).toBe('exact_preset');
    expect(intent.matchedRuleId).toBe('director-standard');
    expect(intent.rawComponents).toEqual(['notebook', 'headphones', 'vase', 'pen']);
    expect(intent.resolvedStyle).toBe('centered');
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

describe('damerauLevenshtein', () => {
  it('считает подстановки, вставки, удаления и перестановки', () => {
    expect(damerauLevenshtein('пазл', 'пазл')).toBe(0);
    expect(damerauLevenshtein('пазл', 'палз')).toBe(1); // перестановка
    expect(damerauLevenshtein('кошелек', 'кашелек')).toBe(1); // замена
    expect(damerauLevenshtein('библиотек', 'библитек')).toBe(1); // удаление
    expect(damerauLevenshtein('книг', 'книига')).toBe(2); // вставка + вставка
    expect(damerauLevenshtein('', 'abc')).toBe(3);
  });
});

describe('parseIntent: fuzzy typo recovery', () => {
  it('«библиатека» -> book, не fallback', () => {
    const intent = parseIntent('библиатека');
    expect(intent.strategy).not.toBe('deterministic_fallback');
    expect(intent.rawComponents).toContain('book');
  });

  it('«в библиатеками читаю» (склонение + опечатка) -> book, не fallback', () => {
    const intent = parseIntent('в библиатеками читаю');
    expect(intent.strategy).not.toBe('deterministic_fallback');
    expect(intent.rawComponents).toContain('book');
  });

  it('лишняя и пропущенная буква в «библиотеке»', () => {
    expect(parseIntent('бииблиатека').rawComponents).toContain('book');
    expect(parseIntent('библатека').rawComponents).toContain('book');
  });

  it('«кашелек» -> notebook', () => {
    const intent = parseIntent('кашелек');
    expect(intent.strategy).toBe('explicit_components');
    expect(intent.rawComponents).toEqual(['notebook']);
  });

  it('«наущники» -> headphones', () => {
    const intent = parseIntent('наущники');
    expect(intent.strategy).toBe('explicit_components');
    expect(intent.rawComponents).toEqual(['headphones']);
  });

  it('«смарфон» -> phone', () => {
    const intent = parseIntent('смарфон');
    expect(intent.strategy).toBe('explicit_components');
    expect(intent.rawComponents).toEqual(['phone']);
  });

  it('«осинь» -> semantic_theme cozy', () => {
    const intent = parseIntent('осинь');
    expect(intent.strategy).toBe('semantic_theme');
    expect(intent.matchedRuleId).toBe('fuzzy:cozy');
  });

  it('короткие слова «для без при» не дают ложных срабатываний', () => {
    const intent = parseIntent('для без при');
    expect(intent.strategy).toBe('deterministic_fallback');
  });

  it('мусор «qwerty12345» -> deterministic_fallback', () => {
    expect(parseIntent('qwerty12345').strategy).toBe('deterministic_fallback');
  });

  it('результат детерминирован', () => {
    expect(parseIntent('библиатека')).toEqual(parseIntent('библиатека'));
  });
});
