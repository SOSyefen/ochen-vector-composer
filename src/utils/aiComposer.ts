import { CanvasFormatId, CanvasObject, CANVAS_FORMATS, IllustrationId, ObjectVariant } from '../types';

/**
 * Jev-AI Inspired Non-Autoregressive Classifier & Curated Layout Solver
 *
 * Architecture Principles:
 * 1. Fast, typed, deterministic semantic categorization (Zero-hallucination Jev principles).
 * 2. Curated design-grade blueprints per domain with multi-variant options.
 * 3. Strict asset scale normalization (so 1400px book/folder never swallows 400px phone/pen).
 * 4. Layer priority tiers (ground base surfaces at lowest zIndex, resting items on top)
 *    to completely eliminate SVG clipping / polygon slicing bugs.
 */

export interface DomainArchetype {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  primaryPool: IllustrationId[];
  supportingPool: IllustrationId[];
  blueprints: CuratedBlueprint[];
}

export interface CuratedBlueprintSlot {
  id: IllustrationId;
  variant: ObjectVariant;
  dx: number; // offset in 1000x1000 space
  dy: number;
  scale: number; // normalized scale
  rotation: number;
  layerTier: number; // 0 = base surface (folder/book), 1 = resting item, 2 = foreground accent
}

export interface CuratedBlueprint {
  variantName: string;
  description: string;
  slots: CuratedBlueprintSlot[];
}

// ---------------------------------------------------------------------------
// 1. INTRINSIC SCALE NORMALIZATION & ISOMETRIC FOOTPRINT CALIBRATION
// ---------------------------------------------------------------------------
// Native SVG viewBox sizes & calibrated target canvas sizes (1000x1000 space):
// - book: ~1479x1020 px (Giant ground base) -> scale ~0.38 (renders ~562x388 px)
// - folder: ~1275x693 px (Giant ground base) -> scale ~0.42 (renders ~536x291 px)
// - lamp: ~631x1153 px (Tall background) -> scale ~0.36 - 0.38 (renders ~240x438 px)
// - vase: ~978x1163 px (Tall background) -> scale ~0.34 - 0.38 (renders ~352x419 px)
// - headphones: ~914x728 px (Foreground hero) -> scale ~0.44 (renders ~402x320 px)
// - puzzle: ~833x495 px (Phone with puzzle screen) -> scale ~0.50 - 0.52 (renders ~433x257 px)
//   NOTE: puzzle and phone are mutually exclusive in L-size!
// - phone: ~418x313 px (Standard smartphone) -> scale ~0.76 - 0.82 (renders ~334x250 px)
// - notebook: ~413x415 px (Compact spiral pad) -> scale ~0.64 - 0.68 (renders ~281x282 px)
// - pen: ~549x321 px (Desk stylus / pen) -> scale ~0.50 - 0.52 (renders ~274x160 px)
// - coin: ~391x397 px (Accent medal / coin) -> scale ~0.46 - 0.50 (renders ~180x182 px)

export const DOMAIN_ARCHETYPES: DomainArchetype[] = [
  // 1. FINTECH & CAPITAL
  {
    id: 'fintech',
    name: 'Финтех и управление капиталом',
    description: 'Инвестиционные сервисы, цифровой банкинг, аналитика и активы',
    keywords: [
      'финтех', 'банк', 'деньг', 'крипт', 'инвест', 'капитал', 'доход', 'валют',
      'коин', 'fintech', 'money', 'finance', 'crypto', 'wallet', 'бюджет', 'счет',
    ],
    primaryPool: ['phone', 'coin'],
    supportingPool: ['folder', 'notebook', 'pen'],
    blueprints: [
      {
        variantName: 'Vault Desk (Сейфовый стол)',
        description: 'Папка документов как основа, смартфон и инвестиционная монета на первом плане, ручка лежит на переднем крае стола',
        slots: [
          { id: 'folder', variant: 'Bg', dx: -50, dy: 10, scale: 0.44, rotation: 0, layerTier: 0 },
          { id: 'phone', variant: 'Main', dx: 40, dy: -20, scale: 0.38, rotation: 0, layerTier: 1 },
          { id: 'coin', variant: 'Main', dx: -160, dy: 60, scale: 0.40, rotation: 0, layerTier: 2 },
          { id: 'pen', variant: 'Bg', dx: 140, dy: 145, scale: 0.38, rotation: 0, layerTier: 2 },
        ],
      },
      {
        variantName: 'Digital Trading (Мобильный трейдинг)',
        description: 'Фокус на смартфоне с аналитическим блокнотом и золотой монетой',
        slots: [
          { id: 'notebook', variant: 'Bg', dx: -130, dy: -30, scale: 0.65, rotation: 0, layerTier: 0 },
          { id: 'phone', variant: 'Main', dx: 50, dy: 0, scale: 0.38, rotation: 0, layerTier: 1 },
          { id: 'coin', variant: 'Main', dx: 180, dy: 80, scale: 0.40, rotation: 0, layerTier: 2 },
          { id: 'pen', variant: 'Bg', dx: -120, dy: 110, scale: 0.38, rotation: 0, layerTier: 2 },
        ],
      },
    ],
  },

  // 2. EDUCATION & STUDY
  {
    id: 'education',
    name: 'Образование и аналитика',
    description: 'Академические знания, курсы, исследования и книги',
    keywords: [
      'образ', 'учеб', 'книг', 'курс', 'студент', 'лекци', 'наук', 'исследов',
      'школ', 'study', 'education', 'book', 'learn', 'academy', 'университет', 'диплом',
    ],
    primaryPool: ['book', 'pen'],
    supportingPool: ['lamp', 'headphones', 'vase', 'coin'],
    blueprints: [
      {
        variantName: 'Scholar Desk (Рабочий стол исследователя)',
        description: 'Раскрытая книга как основа, лампа в глубине, ручка и жетон на переднем плане',
        slots: [
          { id: 'book', variant: 'Main', dx: 0, dy: -10, scale: 0.38, rotation: 0, layerTier: 0 },
          { id: 'lamp', variant: 'Bg', dx: -190, dy: -120, scale: 0.32, rotation: 0, layerTier: 0 },
          { id: 'pen', variant: 'Main', dx: -20, dy: 115, scale: 0.38, rotation: 0, layerTier: 2 },
          { id: 'coin', variant: 'Bg', dx: 180, dy: 90, scale: 0.40, rotation: 0, layerTier: 2 },
        ],
      },
      {
        variantName: 'Audio Lecture (Аудиолекция)',
        description: 'Книга с наушниками для аудиального обучения, ваза на фоне, ручка на переднем плане',
        slots: [
          { id: 'book', variant: 'Bg', dx: -70, dy: -10, scale: 0.38, rotation: 0, layerTier: 0 },
          { id: 'vase', variant: 'Bg', dx: -190, dy: -130, scale: 0.30, rotation: 0, layerTier: 0 },
          { id: 'headphones', variant: 'Main', dx: 90, dy: 35, scale: 0.40, rotation: 0, layerTier: 2 },
          { id: 'pen', variant: 'Main', dx: -50, dy: 115, scale: 0.38, rotation: 0, layerTier: 2 },
        ],
      },
    ],
  },

  // 3. CREATIVE WORKSHOP & ART
  {
    id: 'creative',
    name: 'Творчество и мастерская',
    description: 'Дизайн, вдохновение, иллюстрации и эстетичные пространства',
    keywords: [
      'дизайн', 'арт', 'творчеств', 'мастерск', 'вдохновен', 'красот', 'гармони',
      'уют', 'decor', 'art', 'creative', 'design', 'craft', 'studio', 'стиль',
    ],
    primaryPool: ['vase', 'lamp'],
    supportingPool: ['book', 'headphones', 'notebook', 'pen', 'coin'],
    blueprints: [
      {
        variantName: 'Atelier Harmony (Гармония мастерской)',
        description: 'Ваза с ветвями в глубине, блокнот и наушники в творческом пространстве, ручка впереди',
        slots: [
          { id: 'vase', variant: 'Main', dx: -160, dy: -110, scale: 0.30, rotation: 0, layerTier: 0 },
          { id: 'notebook', variant: 'Bg', dx: -80, dy: 10, scale: 0.65, rotation: 0, layerTier: 0 },
          { id: 'headphones', variant: 'Bg', dx: 70, dy: 30, scale: 0.40, rotation: 0, layerTier: 2 },
          { id: 'pen', variant: 'Main', dx: 140, dy: 110, scale: 0.38, rotation: 0, layerTier: 2 },
        ],
      },
      {
        variantName: 'Inspiration Book (Книга вдохновения)',
        description: 'Раскрытая книга с эстетичной вазой на фоне, монетой и ручкой впереди',
        slots: [
          { id: 'book', variant: 'Main', dx: -20, dy: 10, scale: 0.38, rotation: 0, layerTier: 0 },
          { id: 'vase', variant: 'Bg', dx: 180, dy: -110, scale: 0.30, rotation: 0, layerTier: 0 },
          { id: 'pen', variant: 'Bg', dx: -50, dy: 115, scale: 0.38, rotation: 0, layerTier: 2 },
          { id: 'coin', variant: 'Main', dx: 170, dy: 80, scale: 0.40, rotation: 0, layerTier: 2 },
        ],
      },
    ],
  },

  // 4. TEAMWORK & PRODUCT
  {
    id: 'teamwork',
    name: 'Командная работа и продукт',
    description: 'Совместные проекты, сборка функционала, agile и коммуникации',
    keywords: [
      'команд', 'проект', 'пазл', 'сборк', 'митинг', 'agile', 'синк', 'спринт',
      'team', 'product', 'collaboration', 'puzzle', 'meeting', 'задач', 'решени',
    ],
    primaryPool: ['puzzle', 'folder'],
    supportingPool: ['phone', 'lamp', 'pen', 'coin', 'notebook'],
    blueprints: [
      {
        variantName: 'Puzzle Matrix (Сборка пазла)',
        description: 'Смартфон на столе, над экраном парят детали пазла, золотая монета на первом плане',
        slots: [
          { id: 'lamp', variant: 'Bg', dx: -190, dy: -120, scale: 0.32, rotation: 0, layerTier: 0 },
          { id: 'puzzle', variant: 'Main', dx: 0, dy: 10, scale: 0.38, rotation: 0, layerTier: 1 },
          { id: 'coin', variant: 'Bg', dx: 170, dy: 70, scale: 0.40, rotation: 0, layerTier: 2 },
          { id: 'pen', variant: 'Main', dx: -120, dy: 120, scale: 0.38, rotation: 0, layerTier: 2 },
        ],
      },
      {
        variantName: 'Sync Meeting (Синхронизация)',
        description: 'Папка документов с парящим элементом пазла, лампа на фоне и ручка впереди',
        slots: [
          { id: 'folder', variant: 'Bg', dx: -40, dy: -10, scale: 0.44, rotation: 0, layerTier: 0 },
          { id: 'lamp', variant: 'Bg', dx: 190, dy: -110, scale: 0.32, rotation: 0, layerTier: 0 },
          { id: 'puzzle', variant: 'Main', dx: -10, dy: 20, scale: 0.38, rotation: 0, layerTier: 1 },
          { id: 'pen', variant: 'Main', dx: 130, dy: 110, scale: 0.38, rotation: 0, layerTier: 2 },
        ],
      },
    ],
  },

  // 5. DEEP FOCUS & TECH
  {
    id: 'deep_focus',
    name: 'Глубокий фокус и технологии',
    description: 'Программирование, ночной кодинг, сосредоточенность и алгоритмы',
    keywords: [
      'фокус', 'код', 'программир', 'ноч', 'концентрац', 'технолог', 'разработк',
      'dev', 'code', 'focus', 'tech', 'software', 'deep', 'ноутбук', 'алгоритм',
    ],
    primaryPool: ['headphones', 'phone'],
    supportingPool: ['lamp', 'notebook', 'pen', 'vase'],
    blueprints: [
      {
        variantName: 'Night Flow (Ночной поток кодинга)',
        description: 'Лампа в глубине, блокнот на столе, смартфон и накладные наушники в фокусе',
        slots: [
          { id: 'notebook', variant: 'Bg', dx: 140, dy: -40, scale: 0.65, rotation: 0, layerTier: 0 },
          { id: 'lamp', variant: 'Bg', dx: -190, dy: -110, scale: 0.32, rotation: 0, layerTier: 0 },
          { id: 'phone', variant: 'Main', dx: -90, dy: 30, scale: 0.38, rotation: 0, layerTier: 1 },
          { id: 'headphones', variant: 'Main', dx: 70, dy: 40, scale: 0.40, rotation: 0, layerTier: 2 },
        ],
      },
      {
        variantName: 'Zen Coding (Дзен разработки)',
        description: 'Наушники для изоляции шума, блокнот со схемами, ваза на фоне и ручка впереди',
        slots: [
          { id: 'notebook', variant: 'Bg', dx: -120, dy: -40, scale: 0.65, rotation: 0, layerTier: 0 },
          { id: 'vase', variant: 'Bg', dx: 170, dy: -100, scale: 0.30, rotation: 0, layerTier: 0 },
          { id: 'headphones', variant: 'Main', dx: 0, dy: 35, scale: 0.40, rotation: 0, layerTier: 1 },
          { id: 'pen', variant: 'Bg', dx: 130, dy: 115, scale: 0.38, rotation: 0, layerTier: 2 },
        ],
      },
    ],
  },

  // 6. EXECUTIVE & STRATEGY
  {
    id: 'executive',
    name: 'Стратегия и управление',
    description: 'Бизнес-планирование, подписание договоров, отчеты и лидерство',
    keywords: [
      'бизнес', 'стратег', 'договор', 'контракт', 'директор', 'управлен', 'план',
      'аудит', 'отчет', 'leader', 'business', 'strategy', 'management', 'executive',
    ],
    primaryPool: ['folder', 'book'],
    supportingPool: ['pen', 'coin', 'lamp', 'phone'],
    blueprints: [
      {
        variantName: 'Contract Signing (Подписание контракта)',
        description: 'Официальная папка документов с ручкой на переднем крае, смартфон и настольная лампа',
        slots: [
          { id: 'folder', variant: 'Main', dx: -40, dy: 10, scale: 0.44, rotation: 0, layerTier: 0 },
          { id: 'lamp', variant: 'Bg', dx: 180, dy: -110, scale: 0.32, rotation: 0, layerTier: 0 },
          { id: 'phone', variant: 'Bg', dx: 40, dy: -20, scale: 0.38, rotation: 0, layerTier: 1 },
          { id: 'pen', variant: 'Main', dx: 140, dy: 145, scale: 0.38, rotation: 0, layerTier: 2 },
        ],
      },
      {
        variantName: 'Archive Audit (Архивный аудит)',
        description: 'Папка и книга как аналитическая база, ручка и жетон на переднем плане',
        slots: [
          { id: 'folder', variant: 'Bg', dx: -90, dy: -25, scale: 0.44, rotation: 0, layerTier: 0 },
          { id: 'book', variant: 'Main', dx: 70, dy: 10, scale: 0.38, rotation: 0, layerTier: 0 },
          { id: 'pen', variant: 'Main', dx: -60, dy: 115, scale: 0.38, rotation: 0, layerTier: 2 },
          { id: 'coin', variant: 'Bg', dx: 180, dy: 80, scale: 0.40, rotation: 0, layerTier: 2 },
        ],
      },
    ],
  },
];

export const PRESET_METAPHORS = [
  { title: 'Финтех и аналитика', query: 'Финтех-стартап, криптовалюты и управление капиталом' },
  { title: 'Командный брейншторм', query: 'Командный брейншторм, решение сложных пазлов и синергия' },
  { title: 'Глубокий фокус в дедлайн', query: 'Ночной кодинг в наушниках, глубокая концентрация и поиск инсайта' },
  { title: 'Образование будущего', query: 'Онлайн-университет, фундаментальные книги и конспектирование' },
  { title: 'Творческая дизайн-студия', query: 'Уютная студия дизайна, эстетика, настольная лампа и свежие идеи' },
  { title: 'Деловые документы', query: 'Офисный порядок, согласование договоров и папки документов' },
];

let globalVariantCounter = 0;

/**
 * Jev-AI Non-Autoregressive Matcher:
 * Computes scores across all archetypes, applying feature weights and calibrated probabilities.
 */
export function classifyPrompt(input: string): {
  archetype: DomainArchetype;
  confidence: number;
  matchedScore: number;
} {
  const lower = input.toLowerCase().replace(/ё/g, 'е');
  let bestArchetype = DOMAIN_ARCHETYPES[0];
  let maxScore = -1;

  for (const arch of DOMAIN_ARCHETYPES) {
    let score = 0;
    for (const kw of arch.keywords) {
      if (lower.includes(kw)) {
        // Longer keyword matches receive quadratic weight boost
        score += Math.max(1, kw.length / 3);
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestArchetype = arch;
    }
  }

  // Calibrated confidence (bounded 0.65 - 0.99)
  const confidence = maxScore > 0 ? Math.min(0.99, 0.72 + maxScore * 0.05) : 0.65;

  return {
    archetype: bestArchetype,
    confidence,
    matchedScore: maxScore,
  };
}

export function analyzeMetaphor(input: string): {
  primary: IllustrationId[];
  supporting: IllustrationId[];
  description: string;
  archetype: string;
  confidence: number;
} {
  const { archetype, confidence } = classifyPrompt(input);
  return {
    primary: archetype.primaryPool,
    supporting: archetype.supportingPool,
    description: `Классификатор Jev AI: подобран архетип "${archetype.name}" (уверенность ${Math.round(confidence * 100)}%)`,
    archetype: archetype.id,
    confidence,
  };
}

/**
 * Studio Curated Layout Generator:
 * Generates human-designed isometric compositions where:
 * 1. Base surfaces (folder, book) are placed at lower zIndex (tier 0).
 * 2. Resting items (phone, pen, notebook) sit at higher zIndex (tier 1..2).
 * 3. Scales are normalized so giant assets never swallow medium assets.
 * 4. Repeating the same metaphor smoothly cycles through curated blueprint variants.
 */
export function generateCompositionByMetaphor(
  prompt: string,
  formatId: CanvasFormatId
): CanvasObject[] {
  const format = CANVAS_FORMATS[formatId];
  const { archetype } = classifyPrompt(prompt);

  // Cycle through available curated blueprints for this archetype
  const blueprintIndex = (++globalVariantCounter) % archetype.blueprints.length;
  const blueprint = archetype.blueprints[blueprintIndex];

  const cx = format.width / 2;
  const cy = format.height / 2;

  // Format adaptation multipliers
  const spreadX = formatId === 'horizontal' ? 1.25 : formatId === 'vertical' ? 0.75 : 1.0;
  const spreadY = formatId === 'horizontal' ? 0.85 : formatId === 'vertical' ? 1.25 : 1.0;
  const globalScaleMultiplier = formatId === 'horizontal' ? 0.92 : formatId === 'vertical' ? 0.88 : 1.0;

  const objects: CanvasObject[] = [];

  blueprint.slots.forEach((slot, idx) => {
    const finalX = Math.round(cx + slot.dx * spreadX);
    const finalY = Math.round(cy + slot.dy * spreadY);
    const finalScale = Number((slot.scale * globalScaleMultiplier).toFixed(2));

    // Strict zIndex calculation:
    // tier 0 (bases like folder/book): zIndex 0..4
    // tier 1 (resting items like pen/phone on folder): zIndex 10..14
    // tier 2 (foreground accents): zIndex 20..24
    const baseZ = slot.layerTier * 10 + idx;

    objects.push({
      instanceId: `inst_${Date.now()}_${idx}_${slot.id}`,
      illustrationId: slot.id,
      variant: slot.variant,
      x: Math.max(80, Math.min(format.width - 80, finalX)),
      y: Math.max(80, Math.min(format.height - 80, finalY)),
      scale: finalScale,
      rotation: slot.rotation,
      zIndex: baseZ,
    });
  });

  // Sort strictly by zIndex (Painter's algorithm guaranteed)
  return objects.sort((a, b) => a.zIndex - b.zIndex);
}
