/**
 * Шаг 2 пайплайна: нормализация состава сцены и назначение слотов.
 * ZERO-DOM: чистые функции без побочных эффектов.
 */
import { IllustrationId } from '../../types';
import {
  COMPONENT_WEIGHTS,
  FLAT_BASES,
  isIllustrationId,
  PRIMARY_STACKABLE_ON_BASE,
  SMALL_ACCENTS,
  TALL_BACKGROUNDS,
} from '../catalog';
import { RoleAssignment, SlotRole } from '../contracts';

function getVisualWeight(id: IllustrationId): number {
  return COMPONENT_WEIGHTS[id] ?? 1;
}

/**
 * Ограничения на количество объектов:
 * 2–4 объекта, до 5 — только при наличии плоской подложки (book/folder).
 * Один предмет дополняется детерминированными компаньонами.
 */
export function normalizeSceneComponents(rawList: IllustrationId[]): IllustrationId[] {
  const unique = Array.from(new Set(rawList));
  if (unique.length === 0) return [];

  if (unique.length === 1) {
    const single = unique[0];
    if (FLAT_BASES.has(single)) {
      return [single, 'phone', 'coin'];
    }
    if (TALL_BACKGROUNDS.has(single)) {
      return ['headphones', single, 'coin'];
    }
    if (SMALL_ACCENTS.has(single)) {
      return ['notebook', 'vase', single];
    }
    return [single, 'vase', 'coin'];
  }

  const hasBase = unique.some((id) => FLAT_BASES.has(id));
  const maxAllowed = hasBase ? 5 : 4;

  if (unique.length <= maxAllowed) {
    return unique;
  }

  // Стабильная сортировка по визуальному весу (по убыванию)
  const prioritized = [...unique].sort((a, b) => getVisualWeight(b) - getVisualWeight(a));
  return prioritized.slice(0, maxAllowed);
}

/**
 * Назначает слоты:
 *   tall_bg         — lamp / vase (монохромный Bg)
 *   flat_base       — book / folder (или notebook, если подложки нет и есть другой герой)
 *   primary_stack   — notebook / phone / puzzle на подложке
 *   secondary_stack — pen на подложке
 *   free_hero       — свободный герой
 *   second_hero     — второй герой (только без подложки)
 *   small_accent    — coin / pen
 */
export function resolveRoles(rawComponents: IllustrationId[]): RoleAssignment & { warnings: string[] } {
  const warnings: string[] = [];

  const unknown = rawComponents.filter((id) => !isIllustrationId(id));
  if (unknown.length > 0) {
    warnings.push(`Неизвестные компоненты проигнорированы: ${unknown.join(', ')}`);
  }

  const unique = Array.from(new Set(rawComponents.filter(isIllustrationId)));
  const normalized = normalizeSceneComponents(unique);

  if (normalized.length === 0) {
    warnings.push('Пустой список компонентов: сцена не будет построена.');
    return { normalizedComponents: [], droppedComponents: [], slots: {}, warnings };
  }

  if (unique.length === 1) {
    const added = normalized.filter((id) => id !== unique[0]);
    warnings.push(
      `Передан один предмет «${unique[0]}»: добавлены компаньоны ${added.join(', ')}.`
    );
  }

  const trimmed = unique.filter((id) => !normalized.includes(id));
  if (trimmed.length > 0) {
    warnings.push(
      `Превышен лимит объектов (${normalized.length}): по весу отброшены ${trimmed.join(', ')}.`
    );
  }

  // ---- Slot resolution ----------------------------------------------------
  const naturalBaseId = normalized.find((id) => FLAT_BASES.has(id));
  const tallId = normalized.find((id) => TALL_BACKGROUNDS.has(id));

  const nonBaseHeroes = normalized.filter(
    (id) => !FLAT_BASES.has(id) && !TALL_BACKGROUNDS.has(id) && !SMALL_ACCENTS.has(id)
  );

  // Без book/folder кошелёк (notebook) становится подложкой, если рядом есть другой герой
  const promoteNotebook =
    naturalBaseId === undefined &&
    normalized.includes('notebook') &&
    nonBaseHeroes.some((id) => id !== 'notebook');

  const baseId: IllustrationId | undefined =
    naturalBaseId ?? (promoteNotebook ? 'notebook' : undefined);

  const heroCandidates = nonBaseHeroes.filter((id) => id !== baseId);

  const primaryStackId: IllustrationId | undefined = baseId
    ? heroCandidates.find((id) => PRIMARY_STACKABLE_ON_BASE.has(id))
    : undefined;

  // Ручка лежит на подложке только для book/folder; на notebook она уходит в small_accent
  const penOnBase = (baseId === 'book' || baseId === 'folder') && normalized.includes('pen');

  const freeHeroId: IllustrationId | undefined = baseId
    ? heroCandidates.find((id) => id !== primaryStackId)
    : (heroCandidates[0] ?? normalized.find((id) => id !== tallId));

  const secondHeroId: IllustrationId | undefined =
    !baseId && heroCandidates.length > 1 ? heroCandidates[1] : undefined;

  const accentId = normalized.find(
    (id) =>
      SMALL_ACCENTS.has(id) &&
      id !== freeHeroId &&
      id !== secondHeroId &&
      !(penOnBase && id === 'pen')
  );

  const slots: Partial<Record<SlotRole, IllustrationId>> = {};
  if (tallId) slots.tall_bg = tallId;
  if (baseId) slots.flat_base = baseId;
  if (primaryStackId) slots.primary_stack = primaryStackId;
  if (penOnBase) slots.secondary_stack = 'pen';
  if (freeHeroId) slots.free_hero = freeHeroId;
  if (secondHeroId) slots.second_hero = secondHeroId;
  if (accentId) slots.small_accent = accentId;

  const assigned = new Set<IllustrationId>(
    Object.values(slots).filter((id): id is IllustrationId => id !== undefined)
  );
  const unplaced = normalized.filter((id) => !assigned.has(id));
  if (unplaced.length > 0) {
    warnings.push(`Для компонентов не нашлось свободного слота: ${unplaced.join(', ')}.`);
  }

  return {
    normalizedComponents: normalized,
    droppedComponents: [...trimmed, ...unplaced],
    slots,
    warnings,
  };
}
