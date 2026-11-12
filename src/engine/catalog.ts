/**
 * Каталог доменных констант композитора.
 * ZERO-DOM: только данные и чистые типы, без зависимостей от utils/UI.
 */
import { CanvasFormatId, IllustrationCatalogItem, IllustrationId, Palette } from '../types';

export const ENGINE_VERSION = '1.0.0';

// ---- Layout styles ---------------------------------------------------------

export type LayoutStyle = 'centered' | 'offset' | 'headline';

export interface LayoutStyleOption {
  id: LayoutStyle;
  label: string;
  description: string;
}

export const LAYOUT_STYLE_OPTIONS: readonly LayoutStyleOption[] = [
  {
    id: 'centered',
    label: 'Собранно',
    description: 'Компактная изометрическая диорама вокруг центральных слотов',
  },
  {
    id: 'offset',
    label: 'Со смещением',
    description: 'Диагональный баланс: высокий фон слева-сверху, герой справа, акцент внизу',
  },
  {
    id: 'headline',
    label: 'Под заголовок',
    description: 'Смещение всей композиции вправо (+28% W), левая половина чистая под заголовок',
  },
];

// ---- Geometry --------------------------------------------------------------

// Composition logical grid dimensions per requirement
export const COMPOSER_GRID_SIZES: Readonly<Record<CanvasFormatId, { W: number; H: number }>> = {
  square: { W: 380, H: 380 },
  horizontal: { W: 450, H: 250 },
  vertical: { W: 250, H: 450 },
};

export const BASE_SQUARE_SIDE = 380;

/** Доля ширины холста, освобождаемая под заголовок в стиле 'headline' */
export const HEADLINE_SAFE_ZONE_RATIO = 0.28;

/** Допуск правой границы композиции в стиле 'headline' */
export const HEADLINE_RIGHT_EDGE_TOLERANCE = 10;

// Intrinsic SVG viewBox dimensions [width, height] at scale = 1
export const ILLUSTRATION_SIZES: Readonly<Record<IllustrationId, readonly [number, number]>> = {
  book: [1447, 988],
  folder: [1243, 661],
  lamp: [946, 1131],
  headphones: [882.7, 696.1],
  phone: [802, 463],
  vase: [627.7, 748.5],
  notebook: [640, 401], // wallet / notebook
  puzzle: [1029, 576],
  pen: [517, 289],
  coin: [335, 273],
};

// Calibrated scales on 380x380 grid (scenes fit with clean margins, see examples/01..03)
export const CALIBRATED_SCALES: Readonly<Record<IllustrationId, number>> = {
  headphones: 0.2, // ~177px on 380 grid
  book: 0.17, // ~246px on 380 grid
  folder: 0.19, // ~236px on 380 grid
  vase: 0.16,
  lamp: 0.16,
  phone: 0.19,
  notebook: 0.21, // wallet / notebook
  puzzle: 0.19,
  pen: 0.19,
  coin: 0.21,
};

export const ALL_ILLUSTRATION_IDS: readonly IllustrationId[] = Object.keys(
  ILLUSTRATION_SIZES
) as IllustrationId[];

export function isIllustrationId(value: unknown): value is IllustrationId {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(ILLUSTRATION_SIZES, value)
  );
}

// ---- Built-in palettes -----------------------------------------------------

export const BUILTIN_PALETTES: Palette[] = [
  {
    id: 'lavender',
    name: 'Lavender / Лаванда',
    roles: {
      bg: '#D7CDF5',
      primary_accent: '#AA9BF0',
      secondary_accent: '#7864D7',
      highlight: '#F9ECB0',
      tertiary_accent: '#F9A3AA',
      soft_fill: '#FFE3E1',
      stroke: '#181817',
      white: '#FFFFFF',
    },
  },
  {
    id: 'sand',
    name: 'Sand & Peach / Песок',
    roles: {
      bg: '#FDD7B9',
      primary_accent: '#FAC896',
      secondary_accent: '#D27532',
      highlight: '#F9ECB0',
      tertiary_accent: '#80DADA',
      soft_fill: '#BEEBEB',
      stroke: '#181817',
      white: '#FFFFFF',
    },
  },
  {
    id: 'mint',
    name: 'Mint & Teal / Мята',
    roles: {
      bg: '#BEEBEB',
      primary_accent: '#80DADA',
      secondary_accent: '#5ABEBE',
      highlight: '#FFD4F2',
      tertiary_accent: '#6D7BFC',
      soft_fill: '#B6C6FE',
      stroke: '#181817',
      white: '#FFFFFF',
    },
  },
];

// ---- Role groups -----------------------------------------------------------

export const FLAT_BASES: ReadonlySet<IllustrationId> = new Set<IllustrationId>(['book', 'folder']);
export const TALL_BACKGROUNDS: ReadonlySet<IllustrationId> = new Set<IllustrationId>(['vase', 'lamp']);
export const STACKABLE_ON_BASE: ReadonlySet<IllustrationId> = new Set<IllustrationId>([
  'notebook',
  'phone',
  'puzzle',
  'pen',
  'coin',
]);
export const PRIMARY_STACKABLE_ON_BASE: ReadonlySet<IllustrationId> = new Set<IllustrationId>([
  'notebook',
  'phone',
  'puzzle',
]);
export const SMALL_ACCENTS: ReadonlySet<IllustrationId> = new Set<IllustrationId>(['coin', 'pen']);

// ---- Metadata & weights ----------------------------------------------------

export const ILLUSTRATION_META: readonly IllustrationCatalogItem[] = [
  { id: 'headphones', label: 'Наушники', category: 'tech', visualWeight: 5.0 },
  { id: 'book', label: 'Книга', category: 'study', visualWeight: 4.8 },
  { id: 'folder', label: 'Папка', category: 'work', visualWeight: 4.5 },
  { id: 'notebook', label: 'Кошелек', category: 'finance', visualWeight: 4.2 },
  { id: 'phone', label: 'Смартфон', category: 'tech', visualWeight: 4.0 },
  { id: 'puzzle', label: 'Пазл', category: 'creative', visualWeight: 3.8 },
  { id: 'lamp', label: 'Лампа', category: 'work', visualWeight: 3.5 },
  { id: 'vase', label: 'Букет цветов', category: 'creative', visualWeight: 3.4 },
  { id: 'pen', label: 'Ручка', category: 'work', visualWeight: 1.5 },
  { id: 'coin', label: 'Монета', category: 'finance', visualWeight: 1.2 },
];

export const COMPONENT_WEIGHTS: Readonly<Record<IllustrationId, number>> = ILLUSTRATION_META.reduce(
  (acc, item) => {
    acc[item.id] = item.visualWeight;
    return acc;
  },
  {} as Record<IllustrationId, number>
);

// ---- Component synonym dictionary (RU + EN) ---------------------------------

export interface ComponentKeywordMatcher {
  readonly id: IllustrationId;
  readonly regex: RegExp;
}

/** Регулярки применяются к тексту в нижнем регистре с заменой «ё» -> «е». */
export const COMPONENT_KEYWORDS: readonly ComponentKeywordMatcher[] = [
  {
    id: 'headphones',
    regex: /(?:^|[^а-яa-z0-9])(наушник[а-я]*|гарнитур[а-я]*|аудио|airpods|headphone[s]?|headset|earphone[s]?)(?=$|[^а-яa-z0-9])/i,
  },
  {
    id: 'book',
    regex: /(?:^|[^а-яa-z0-9])(книг[а-я]*|книжк[а-я]*|учебник[а-я]*|том|литератур[а-я]*|библиотек[а-я]*|читальн[а-я]*|роман[а-я]*|пособи[а-я]*|book[s]?|textbook[s]?|library)(?=$|[^а-яa-z0-9])/i,
  },
  {
    id: 'phone',
    regex: /(?:^|[^а-яa-z0-9])(смартфон[а-я]*|телефон[а-я]*|айфон[а-я]*|мобильн[а-я]*|экран[а-я]*|iphone|smartphone[s]?|phone[s]?|mobile)(?=$|[^а-яa-z0-9])/i,
  },
  {
    id: 'puzzle',
    regex: /(?:^|[^а-яa-z0-9])(пазл[а-я]*|мозаик[а-я]*|головоломк[а-я]*|детал[ьия][а-я]*|puzzle[s]?|jigsaw)(?=$|[^а-яa-z0-9])/i,
  },
  {
    id: 'coin',
    regex: /(?:^|[^а-яa-z0-9])(монет[а-я]*|монетк[а-я]*|жетон[а-я]*|копейк[а-я]*|рубл[а-я]*|деньг[а-я]*|валют[а-я]*|coin[s]?|token[s]?)(?=$|[^а-яa-z0-9])/i,
  },
  {
    id: 'lamp',
    regex: /(?:^|[^а-яa-z0-9])(ламп[а-я]*|светильник[а-я]*|настольн[а-я]+\s+ламп[а-я]*|торшер[а-я]*|свет|lamp[s]?|light)(?=$|[^а-яa-z0-9])/i,
  },
  {
    id: 'vase',
    regex: /(?:^|[^а-яa-z0-9])(ваз[а-я]*|букет[а-я]*|цвет[ыоауе][а-я]*|цветок|растени[а-я]*|флор[а-я]*|vase[s]?|flower[s]?|bouquet|plant[s]?)(?=$|[^а-яa-z0-9])/i,
  },
  {
    id: 'notebook',
    regex: /(?:^|[^а-яa-z0-9])(кошел[её]?к[а-я]*|кошел[ьяюе][а-я]*|бумажник[а-я]*|портмоне|картхолдер[а-я]*|блокнот[а-я]*|ежедневник[а-я]*|записн[а-я]*|wallet[s]?|purse|notebook[s]?)(?=$|[^а-яa-z0-9])/i,
  },
  {
    id: 'folder',
    regex: /(?:^|[^а-яa-z0-9])(папк[а-я]*|документ[а-я]*|файл[а-я]*|архив[а-я]*|портфел[а-я]*|folder[s]?|binder|document[s]?)(?=$|[^а-яa-z0-9])/i,
  },
  {
    id: 'pen',
    regex: /(?:^|[^а-яa-z0-9])(ручк[а-я]*|авторучк[а-я]*|карандаш[а-я]*|стилус[а-я]*|перо|маркер[а-я]*|pen[s]?|pencil[s]?|stylus)(?=$|[^а-яa-z0-9])/i,
  },
];

// ---- Fuzzy (typo-tolerant) component stems ----------------------------------

export interface FuzzyComponentStems {
  readonly id: IllustrationId;
  /** Основы слов (RU + EN), нижний регистр, «ё» -> «е». Используются только в fuzzy-режиме. */
  readonly stems: readonly string[];
}

export const FUZZY_COMPONENT_STEMS: readonly FuzzyComponentStems[] = [
  {
    id: 'headphones',
    stems: ['наушник', 'гарнитур', 'airpods', 'headphone', 'earphone'],
  },
  {
    id: 'book',
    stems: ['книг', 'книжк', 'библиотек', 'учебник', 'литератур', 'читальн', 'textbook', 'library'],
  },
  {
    id: 'phone',
    stems: ['смартфон', 'телефон', 'айфон', 'мобильн', 'smartphone', 'iphone'],
  },
  {
    id: 'puzzle',
    stems: ['пазл', 'мозаик', 'головоломк', 'jigsaw', 'puzzle'],
  },
  {
    id: 'coin',
    stems: ['монет', 'жетон', 'копейк', 'деньг', 'валют', 'рубл'],
  },
  {
    id: 'lamp',
    stems: ['ламп', 'светильник', 'торшер'],
  },
  {
    id: 'vase',
    stems: ['букет', 'цветок', 'цветочн', 'растени', 'флор', 'flower', 'bouquet'],
  },
  {
    id: 'notebook',
    stems: [
      'кошелек',
      'бумажник',
      'портмоне',
      'картхолдер',
      'блокнот',
      'ежедневник',
      'записн',
      'wallet',
      'notebook',
    ],
  },
  {
    id: 'folder',
    stems: ['папк', 'документ', 'файл', 'архив', 'портфел', 'folder', 'binder'],
  },
  {
    id: 'pen',
    stems: ['ручк', 'авторучк', 'карандаш', 'стилус', 'маркер', 'pencil', 'stylus'],
  },
];

// ---- Presets ---------------------------------------------------------------

export interface PresetMetaphor {
  id: string;
  label: string;
  name?: string;
  title?: string;
  description?: string;
  query: string;
  keywords: string[];
  components: IllustrationId[];
  layoutStyle: LayoutStyle;
}

export const PRESET_METAPHORS: PresetMetaphor[] = [
  {
    id: 'music-focus',
    label: 'Музыка и фокус в работе',
    name: 'Музыка и фокус в работе',
    title: 'Музыка и фокус в работе',
    description: 'Фокусное состояние, гармония звука и эстетики',
    query: 'музыка фокус наушники букет монета',
    keywords: ['музык', 'фокус', 'подкаст', 'аудио', 'стрим', 'звук', 'медиа', 'music', 'podcast', 'audio', 'focus'],
    components: ['headphones', 'vase', 'coin'],
    layoutStyle: 'centered',
  },
  {
    id: 'personal-budget',
    label: 'Контроль личного бюджета',
    name: 'Контроль личного бюджета',
    title: 'Контроль личного бюджета',
    description: 'Учёт расходов, финансовая подушка и сбережения',
    query: 'бюджет кошелек лампа монета финансы',
    keywords: ['бюджет', 'финанс', 'финтех', 'кошел', 'копилк', 'кэшбэк', 'кешбэк', 'сбереж', 'расход', 'трат', 'инвест', 'банк', 'доход', 'зарплат', 'налог', 'budget', 'finance', 'fintech', 'wallet', 'savings', 'money', 'cashback'],
    components: ['notebook', 'lamp', 'coin'],
    layoutStyle: 'centered',
  },
  {
    id: 'missing-puzzle',
    label: 'Поиск недостающего элемента',
    name: 'Поиск недостающего элемента',
    title: 'Поиск недостающего элемента',
    description: 'Сборка сложной картины, озарение и ключевая деталь',
    query: 'пазл лампа папка поиск задача',
    keywords: ['пазл', 'головолом', 'недостающ', 'озарен', 'поиск', 'задач', 'решен', 'креатив', 'творч', 'puzzle', 'insight', 'problem', 'solution'],
    components: ['puzzle', 'lamp', 'folder'],
    layoutStyle: 'offset',
  },
  {
    id: 'education-knowledge',
    label: 'Обучение и база знаний',
    name: 'Обучение и база знаний',
    title: 'Обучение и база знаний',
    description: 'Чтение литературы, конспекты и образовательные курсы',
    query: 'обучение книги смартфон ручка знания',
    keywords: ['обучен', 'образован', 'учеб', 'курс', 'школ', 'вуз', 'экзамен', 'знани', 'чтени', 'конспект', 'наук', 'study', 'education', 'learn', 'course', 'knowledge'],
    components: ['book', 'phone', 'pen'],
    layoutStyle: 'centered',
  },
  {
    id: 'headline-article',
    label: 'Под заголовок статьи',
    name: 'Под заголовок статьи',
    title: 'Под заголовок статьи',
    description: 'Асимметричная композиция под заголовок и типографику',
    query: 'заголовок статья наушники папка ручка',
    keywords: ['заголовок', 'стать', 'обложк', 'баннер', 'редакц', 'новост', 'блог', 'типограф', 'headline', 'article', 'cover', 'banner'],
    components: ['headphones', 'folder', 'pen'],
    layoutStyle: 'headline',
  },
  {
    id: 'director-standard',
    label: 'Рабочий стол (базовый)',
    name: 'Рабочий стол (базовый)',
    title: 'Рабочий стол (базовый)',
    description: 'Референсная сцена: кошелёк, наушники, букет и ручка',
    query: 'эталон арт-директора',
    keywords: ['эталон', 'арт-директор', 'референс', 'director', 'reference'],
    components: ['notebook', 'headphones', 'vase', 'pen'],
    layoutStyle: 'centered',
  },
];

// ---- Semantic themes -------------------------------------------------------

export interface SemanticTheme {
  readonly id: string;
  readonly keywords: readonly string[];
  readonly components: readonly IllustrationId[];
  readonly style: LayoutStyle;
}

export const SEMANTIC_METAPHOR_THEMES: readonly SemanticTheme[] = [
  {
    id: 'cozy',
    keywords: ['осень', 'уют', 'погода', 'дождь', 'вечер', 'чай', 'плед', 'autumn', 'fall', 'rain', 'cozy', 'сентябр', 'октябр', 'ноябр'],
    components: ['book', 'vase', 'pen', 'coin'],
    style: 'centered',
  },
  {
    id: 'work',
    keywords: ['работа', 'дом', 'удаленк', 'remote', 'home office', 'созвон', 'фриланс', 'офис', 'задачи', 'work', 'ворк', 'zoom', 'презентац', 'маркетинг', 'пиар', 'marketing'],
    components: ['folder', 'notebook', 'pen', 'lamp', 'coin'],
    style: 'centered',
  },
  {
    id: 'cafe',
    keywords: ['кафе', 'кофе', 'встреча', 'ланч', 'столик', 'отдых', 'cafe', 'coffee', 'meeting', 'чай', 'обед', 'разговор'],
    components: ['notebook', 'phone', 'vase', 'coin'],
    style: 'centered',
  },
  {
    id: 'startup',
    keywords: ['стартап', 'идеи', 'креатив', 'дизайн', 'пазл', 'решение', 'startup', 'puzzle', 'брейншторм', 'инноваци'],
    components: ['folder', 'puzzle', 'lamp', 'pen'],
    style: 'offset',
  },
  {
    id: 'study',
    keywords: ['учеба', 'книги', 'курсы', 'образование', 'студент', 'лекция', 'конспект', 'экзамен', 'наук', 'study', 'education', 'learn', 'библиот', 'читал', 'диплом', 'реферат', 'library'],
    components: ['book', 'phone', 'pen', 'lamp'],
    style: 'centered',
  },
  {
    id: 'finance',
    keywords: ['финансы', 'бюджет', 'деньги', 'инвестиции', 'банк', 'крипта', 'доход', 'зарплат', 'актив', 'налог', 'finance', 'money', 'budget', 'аналитик', 'метрик', 'отчет', 'дашборд', 'analytics'],
    components: ['notebook', 'folder', 'pen', 'coin'],
    style: 'centered',
  },
  {
    id: 'audio',
    keywords: ['музыка', 'фокус', 'подкаст', 'аудио', 'звук', 'трек', 'стрим', 'плейлист', 'music', 'audio', 'sound', 'podcast'],
    components: ['headphones', 'vase', 'coin'],
    style: 'centered',
  },
  {
    id: 'tech',
    keywords: ['технологии', 'it', 'айти', 'код', 'софт', 'приложения', 'digital', 'смартфон', 'девайс', 'tech', 'code', 'software'],
    components: ['phone', 'headphones', 'folder', 'pen'],
    style: 'centered',
  },
  {
    id: 'headline',
    keywords: ['заголовок', 'статья', 'обложка', 'новость', 'пресса', 'сми', 'блог', 'headline', 'article', 'cover'],
    components: ['headphones', 'folder', 'pen'],
    style: 'headline',
  },
];

export interface FallbackPreset {
  readonly components: readonly IllustrationId[];
  readonly style: LayoutStyle;
}

export const FALLBACK_PRESETS: readonly FallbackPreset[] = [
  { components: ['book', 'lamp', 'vase', 'pen'], style: 'centered' },
  { components: ['folder', 'notebook', 'pen', 'coin'], style: 'centered' },
  { components: ['notebook', 'phone', 'vase', 'coin'], style: 'offset' },
  { components: ['folder', 'puzzle', 'lamp', 'pen'], style: 'offset' },
  { components: ['book', 'phone', 'pen', 'lamp'], style: 'centered' },
  { components: ['headphones', 'vase', 'coin'], style: 'centered' },
  { components: ['phone', 'headphones', 'folder', 'pen'], style: 'centered' },
  { components: ['headphones', 'folder', 'pen'], style: 'headline' },
];
