import { CanvasFormatId, CanvasObject, CANVAS_FORMATS, IllustrationId, ObjectVariant } from '../types';
import { ILLUSTRATION_CATALOG } from './svgRegistry';

/**
 * AI COMPOSER ENGINE (Студия Очень)
 * 
 * Supports:
 * - Scenario 1: Natural language metaphor or headline -> automated balanced composition
 * - Scenario 2: Explicit component names (chips or text) -> intelligent isometric assembly
 * - 3 Canonical Art Director Schemes:
 *   1. «Собранно» (Centered Island / Surface Stack) — 1:1 match with art director's reference
 *   2. «Со смещением» (Asymmetric Offset) — diagonal balance from tall background to accent
 *   3. «Под заголовок» (Under Headline) — right-shifted diorama leaving left space for typography
 */

export type LayoutStyle = 'centered' | 'offset' | 'headline';

export interface LayoutStyleOption {
  id: LayoutStyle;
  label: string;
  description: string;
}

export const LAYOUT_STYLE_OPTIONS: readonly LayoutStyleOption[] = [
  {
    id: 'centered',
    label: 'Собранно (Островок)',
    description: 'Компактный изометрический островок по центру с опорой на базу',
  },
  {
    id: 'offset',
    label: 'Со смещением',
    description: 'Асимметричный диагональный баланс от высокого фона к акценту',
  },
  {
    id: 'headline',
    label: 'Под заголовок',
    description: 'Смещение композиции вправо с чистым полем слева под типографику',
  },
];

// Role classification for composition hierarchy
export type ObjectRole = 'base' | 'background' | 'hero' | 'accent';

export const ROLE_MAP: Record<IllustrationId, ObjectRole> = {
  book: 'base',
  folder: 'base',
  notebook: 'base',
  lamp: 'background',
  vase: 'background',
  headphones: 'hero',
  puzzle: 'hero',
  phone: 'hero',
  coin: 'accent',
  pen: 'accent',
};

// Visual weight mapping from registry
export const VISUAL_WEIGHT_MAP: Record<string, number> = {};
ILLUSTRATION_CATALOG.forEach((item) => {
  VISUAL_WEIGHT_MAP[item.id] = item.visualWeight;
});

// Calibrated native scale factors preserving strict mutual proportions
export const CALIBRATED_OBJECT_SCALES: Record<IllustrationId, number> = {
  book: 0.38,       // 1447px -> ~550px
  folder: 0.42,     // 1243px -> ~522px
  notebook: 0.42,   // 640px  -> ~268px (pedestal / wallet)
  lamp: 0.32,       // 1131px -> ~361px (tall background)
  vase: 0.30,       // 748px  -> ~224px (flower bouquet)
  headphones: 0.42, // 883px  -> ~370px (hero)
  puzzle: 0.38,     // 1029px -> ~391px (hero)
  phone: 0.38,      // 802px  -> ~304px (hero)
  pen: 0.38,        // 517px  -> ~196px (accent)
  coin: 0.40,       // 335px  -> ~134px (accent)
};

export interface RolePositionConfig {
  dx: number;
  dy: number;
  variant: ObjectVariant;
  layerTier: number; // 0 = base / bg, 1 = hero, 2 = accent
}

export type LayoutConfig = Record<ObjectRole, RolePositionConfig>;

/**
 * 3 Canonical Art Director Layout Configurations
 * All offsets calibrated relative to canvas center (500, 500 in 1:1)
 */
export const LAYOUT_CONFIGS: Record<LayoutStyle, LayoutConfig> = {
  // Scheme 1: Centered Island (1:1 with art director's reference photo)
  // notebook (wallet Bg) at (-100, -20)
  // vase (flowers Bg) at (+120, -110)
  // headphones (Main) at (+20, +30)
  // pen (Main) at (+110, +75)
  centered: {
    base: { dx: -100, dy: -20, variant: 'Bg', layerTier: 0 },
    background: { dx: 120, dy: -110, variant: 'Bg', layerTier: 0 },
    hero: { dx: 20, dy: 30, variant: 'Main', layerTier: 1 },
    accent: { dx: 110, dy: 75, variant: 'Main', layerTier: 2 },
  },

  // Scheme 2: Asymmetric Offset
  // Tall lamp Bg top-left (-190, -120)
  // Base / book / phone in center (-20, 10)
  // Hero in center right (40, -10)
  // Accent coin / pen in foreground right (170, 80)
  offset: {
    background: { dx: -190, dy: -120, variant: 'Bg', layerTier: 0 },
    base: { dx: -20, dy: 10, variant: 'Bg', layerTier: 0 },
    hero: { dx: 40, dy: -10, variant: 'Main', layerTier: 1 },
    accent: { dx: 170, dy: 80, variant: 'Main', layerTier: 2 },
  },

  // Scheme 3: Under Headline (Negative space on left for typography)
  // All elements shifted to the right (dx +150..+240)
  // Left area (X < 500) completely clear
  headline: {
    base: { dx: 160, dy: -20, variant: 'Bg', layerTier: 0 },
    background: { dx: 240, dy: -110, variant: 'Bg', layerTier: 0 },
    hero: { dx: 180, dy: 30, variant: 'Main', layerTier: 1 },
    accent: { dx: 240, dy: 75, variant: 'Main', layerTier: 2 },
  },
};

/**
 * Natural language component name parser (Russian & English)
 */
export function extractComponentsFromText(text: string): IllustrationId[] {
  const normalized = text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ');

  const COMPONENT_PATTERNS: Array<{ regex: RegExp; id: IllustrationId }> = [
    { regex: /\b(книг|book)\b/i, id: 'book' },
    { regex: /\b(смартфон|телефон|phone)\b/i, id: 'phone' },
    { regex: /\b(пазл|детал|puzzle)\b/i, id: 'puzzle' },
    { regex: /\b(монет|жетон|coin)\b/i, id: 'coin' },
    { regex: /\b(наушник|headphones)\b/i, id: 'headphones' },
    { regex: /\b(ламп|свет|светильник|lamp)\b/i, id: 'lamp' },
    { regex: /\b(ваз|букет|цвет|vase|flowers)\b/i, id: 'vase' },
    { regex: /\b(кошел|блокнот|портмоне|wallet|notebook)\b/i, id: 'notebook' },
    { regex: /\b(папк|документ|folder)\b/i, id: 'folder' },
    { regex: /\b(ручк|стилус|pen)\b/i, id: 'pen' },
  ];

  const found = new Set<IllustrationId>();
  for (const { regex, id } of COMPONENT_PATTERNS) {
    if (regex.test(normalized)) {
      found.add(id);
    }
  }

  return Array.from(found);
}

/**
 * Scenario 2 Dynamic Solver:
 * Assembles exact component list according to isometric hierarchy and selected layout scheme.
 */
export function composeByComponentList(
  components: IllustrationId[],
  formatId: CanvasFormatId,
  layoutStyle: LayoutStyle = 'centered'
): CanvasObject[] {
  const format = CANVAS_FORMATS[formatId];
  const centerX = format.width / 2;
  const centerY = format.height / 2;
  const config = LAYOUT_CONFIGS[layoutStyle];

  // Format adaptation multipliers
  const spreadX = formatId === 'horizontal' ? 1.25 : formatId === 'vertical' ? 0.75 : 1.0;
  const spreadY = formatId === 'horizontal' ? 0.85 : formatId === 'vertical' ? 1.25 : 1.0;
  const globalScaleMultiplier = formatId === 'horizontal' ? 0.90 : formatId === 'vertical' ? 0.86 : 1.0;

  // Group components by functional role
  const roleGroups: Record<ObjectRole, IllustrationId[]> = {
    base: [],
    background: [],
    hero: [],
    accent: [],
  };

  components.forEach((id) => {
    const role = ROLE_MAP[id] || 'hero';
    roleGroups[role].push(id);
  });

  // Sort each role group by visual weight (heaviest first)
  (Object.keys(roleGroups) as ObjectRole[]).forEach((role) => {
    roleGroups[role].sort((a, b) => (VISUAL_WEIGHT_MAP[b] || 1) - (VISUAL_WEIGHT_MAP[a] || 1));
  });

  const objects: CanvasObject[] = [];
  let instanceCounter = 0;

  // Sequence of placement: background first (deepest), base, hero, accent in front
  const roleSequence: ObjectRole[] = ['background', 'base', 'hero', 'accent'];

  roleSequence.forEach((role) => {
    const itemsInRole = roleGroups[role];
    if (!itemsInRole || itemsInRole.length === 0) return;

    itemsInRole.forEach((componentId, roleIdx) => {
      const roleCfg = config[role];
      const baseScale = CALIBRATED_OBJECT_SCALES[componentId] || 0.38;
      const finalScale = Number((baseScale * globalScaleMultiplier).toFixed(2));

      // Micro-stagger if multiple items share the same role slot
      const staggerX = roleIdx * 45;
      const staggerY = roleIdx * 35;

      const finalX = Math.round(centerX + (roleCfg.dx + staggerX) * spreadX);
      const finalY = Math.round(centerY + (roleCfg.dy + staggerY) * spreadY);

      // Strict layer hierarchy:
      // tier 0 (bg / base): zIndex 0..9
      // tier 1 (hero resting on base): zIndex 10..19
      // tier 2 (accents): zIndex 20..29
      const calculatedZIndex = roleCfg.layerTier * 10 + roleIdx + (role === 'base' ? 2 : 0);

      objects.push({
        instanceId: `inst_${Date.now()}_${++instanceCounter}_${componentId}`,
        illustrationId: componentId,
        variant: roleCfg.variant,
        x: Math.max(60, Math.min(format.width - 60, finalX)),
        y: Math.max(60, Math.min(format.height - 60, finalY)),
        scale: finalScale,
        rotation: 0,
        zIndex: calculatedZIndex,
      });
    });
  });

  // Strict Painter's Algorithm sorting
  return objects.sort((a, b) => a.zIndex - b.zIndex);
}

// ---------------------------------------------------------------------------
// DOMAIN ARCHETYPES (For Scenario 1: Metaphors & Headlines)
// ---------------------------------------------------------------------------

export interface DomainArchetype {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  components: IllustrationId[];
  preferredStyle: LayoutStyle;
}

export const DOMAIN_ARCHETYPES: DomainArchetype[] = [
  // 1. Studio Reference Palette (Exact match with user reference photo)
  {
    id: 'studio_reference',
    name: 'Эталон арт-директора (Собранно)',
    description: 'Кошелек-подложка, наушники, букет цветов на фоне и ручка',
    keywords: [
      'референс', 'эталон', 'арт', 'директор', 'кошелек', 'наушники', 'ваза', 'ручка',
      'собранно', 'островок', 'reference', 'studio',
    ],
    components: ['notebook', 'vase', 'headphones', 'pen'],
    preferredStyle: 'centered',
  },

  // 2. Fintech & Wealth
  {
    id: 'fintech',
    name: 'Финтех и капитал',
    description: 'Цифровой банкинг, аналитика, инвестиции и активы',
    keywords: [
      'финтех', 'банк', 'деньг', 'крипт', 'инвест', 'капитал', 'доход', 'валют',
      'коин', 'fintech', 'money', 'finance', 'crypto', 'wallet', 'бюджет', 'счет',
    ],
    components: ['folder', 'phone', 'coin', 'pen'],
    preferredStyle: 'centered',
  },

  // 3. Education & Study
  {
    id: 'education',
    name: 'Образование и книги',
    description: 'Академические знания, курсы, исследования и чтение',
    keywords: [
      'образ', 'учеб', 'книг', 'курс', 'студент', 'лекци', 'наук', 'исследов',
      'школ', 'study', 'education', 'book', 'learn', 'academy', 'университет', 'диплом',
    ],
    components: ['book', 'lamp', 'pen', 'coin'],
    preferredStyle: 'offset',
  },

  // 4. Creative Studio & Design
  {
    id: 'creative',
    name: 'Творчество и дизайн',
    description: 'Вдохновение, креатив, эстетика рабочего пространства',
    keywords: [
      'дизайн', 'арт', 'творчеств', 'мастерск', 'вдохновен', 'красот', 'гармони',
      'уют', 'decor', 'art', 'creative', 'design', 'craft', 'стиль',
    ],
    components: ['notebook', 'vase', 'headphones', 'pen'],
    preferredStyle: 'centered',
  },

  // 5. Teamwork & Synergy
  {
    id: 'teamwork',
    name: 'Командная работа и продукт',
    description: 'Совместные проекты, сборка сложного функционала и синергия',
    keywords: [
      'команд', 'проект', 'пазл', 'сборк', 'митинг', 'agile', 'синк', 'спринт',
      'team', 'product', 'collaboration', 'puzzle', 'meeting', 'задач',
    ],
    components: ['folder', 'puzzle', 'lamp', 'coin'],
    preferredStyle: 'offset',
  },

  // 6. Deep Focus & Development
  {
    id: 'deep_focus',
    name: 'Глубокий фокус и технологии',
    description: 'Программирование, ночной кодинг, сосредоточенность и алгоритмы',
    keywords: [
      'фокус', 'код', 'программир', 'ноч', 'концентрац', 'технолог', 'разработк',
      'dev', 'code', 'focus', 'tech', 'software', 'deep', 'ноутбук', 'алгоритм',
    ],
    components: ['lamp', 'phone', 'headphones', 'notebook'],
    preferredStyle: 'offset',
  },

  // 7. Editorial & Headline Layout
  {
    id: 'headline_layout',
    name: 'Под заголовок (Маркетинг)',
    description: 'Композиция с воздухом на левой трети полотна для крупного текста',
    keywords: [
      'заголовок', 'типографик', 'текст', 'баннер', 'статья', 'обложк', 'headline',
      'banner', 'editorial', 'свободн', 'воздух', 'маркетинг',
    ],
    components: ['book', 'phone', 'pen', 'coin'],
    preferredStyle: 'headline',
  },
];

export const PRESET_METAPHORS = [
  { title: '⭐ Эталон арт-директора', query: 'Кошелек, наушники, букет цветов, ручка (собранно)' },
  { title: 'Финтех и аналитика', query: 'Финтех-стартап, криптовалюты и управление капиталом' },
  { title: 'Командный брейншторм', query: 'Командный брейншторм, решение сложных пазлов и синергия' },
  { title: 'Глубокий фокус в дедлайн', query: 'Ночной кодинг в наушниках, глубокая концентрация и поиск инсайта' },
  { title: 'Образование будущего', query: 'Онлайн-университет, фундаментальные книги и конспектирование' },
  { title: '📰 Сцена под заголовок', query: 'Маркетинговый баннер под заголовок статьи' },
];

/**
 * Classifies a prompt into one of the domain archetypes
 */
export function classifyPrompt(input: string): {
  archetype: DomainArchetype;
  confidence: number;
} {
  const lower = input.toLowerCase().replace(/ё/g, 'е');
  let bestArchetype = DOMAIN_ARCHETYPES[0];
  let maxScore = -1;

  for (const arch of DOMAIN_ARCHETYPES) {
    let score = 0;
    for (const kw of arch.keywords) {
      if (lower.includes(kw)) {
        score += Math.max(1, kw.length / 3);
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestArchetype = arch;
    }
  }

  const confidence = maxScore > 0 ? Math.min(0.99, 0.75 + maxScore * 0.05) : 0.70;
  return { archetype: bestArchetype, confidence };
}

/**
 * Universal Master Composer:
 * Automatically branches between Scenario 1 (Metaphor) and Scenario 2 (Component List)
 */
export function generateCompositionByMetaphor(
  prompt: string,
  formatId: CanvasFormatId,
  overrideStyle?: LayoutStyle
): CanvasObject[] {
  // 1. Check if prompt explicitly specifies 2 or more components (Scenario 2)
  const explicitComponents = extractComponentsFromText(prompt);
  if (explicitComponents.length >= 2) {
    const layoutStyle = overrideStyle || (prompt.toLowerCase().includes('заголовок') ? 'headline' : 'centered');
    return composeByComponentList(explicitComponents, formatId, layoutStyle);
  }

  // 2. Scenario 1: Metaphor classification
  const { archetype } = classifyPrompt(prompt);
  const layoutStyle = overrideStyle || archetype.preferredStyle;

  return composeByComponentList(archetype.components, formatId, layoutStyle);
}
