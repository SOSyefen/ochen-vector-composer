import { CanvasFormatId, CanvasObject, CANVAS_FORMATS, IllustrationId } from '../types';

export interface SemanticRule {
  keywords: string[];
  primary: IllustrationId[];
  supporting: IllustrationId[];
  mood: 'focus' | 'dynamic' | 'balance' | 'creative';
}

export const SEMANTIC_RULES: SemanticRule[] = [
  {
    keywords: ['финтех', 'банк', 'деньги', 'крипт', 'инвест', 'доход', 'капитал', 'fintech', 'money', 'finance'],
    primary: ['coin', 'phone'],
    supporting: ['folder', 'notebook', 'pen'],
    mood: 'balance',
  },
  {
    keywords: ['обучен', 'знани', 'учеб', 'книг', 'курс', 'студент', 'лекци', 'образован', 'study', 'education', 'book'],
    primary: ['book', 'lamp'],
    supporting: ['notebook', 'pen', 'headphones'],
    mood: 'focus',
  },
  {
    keywords: ['команд', 'брейншторм', 'стартап', 'партнер', 'синерги', 'пазл', 'team', 'brainstorm', 'puzzle', 'collab'],
    primary: ['puzzle', 'phone'],
    supporting: ['lamp', 'notebook', 'coin', 'vase'],
    mood: 'dynamic',
  },
  {
    keywords: ['фокус', 'разработк', 'код', 'программир', 'технолог', 'аудио', 'музык', 'tech', 'dev', 'focus'],
    primary: ['headphones', 'phone'],
    supporting: ['lamp', 'notebook', 'puzzle'],
    mood: 'focus',
  },
  {
    keywords: ['офис', 'бизнес', 'документ', 'отчет', 'план', 'менеджмент', 'work', 'business', 'office'],
    primary: ['folder', 'notebook'],
    supporting: ['pen', 'lamp', 'phone', 'coin'],
    mood: 'balance',
  },
  {
    keywords: ['творчеств', 'дизайн', 'вдохновен', 'иде', 'арт', 'creative', 'art', 'design', 'idea'],
    primary: ['vase', 'lamp'],
    supporting: ['puzzle', 'book', 'pen', 'notebook'],
    mood: 'creative',
  },
];

export const PRESET_METAPHORS = [
  { title: 'Финтех и аналитика', query: 'Финтех-стартап, криптовалюты и управление капиталом' },
  { title: 'Командный брейншторм', query: 'Командный брейншторм, решение сложных пазлов и синергия' },
  { title: 'Глубокий фокус', query: 'Глубокий рабочий фокус, музыка в наушниках и продуктивность' },
  { title: 'Образование будущего', query: 'Онлайн-университет, чтение книг и конспектирование' },
  { title: 'Творческое вдохновение', query: 'Уютная студия дизайна, цветы, настольная лампа и новые идеи' },
  { title: 'Деловые документы', query: 'Офисный порядок, согласование договоров и папки документов' },
];

export function analyzeMetaphor(input: string): {
  primary: IllustrationId[];
  supporting: IllustrationId[];
  description: string;
} {
  const lower = input.toLowerCase();

  for (const rule of SEMANTIC_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return {
        primary: rule.primary,
        supporting: rule.supporting,
        description: `Подобран стиль "${rule.mood}" на основе ключевых понятий`,
      };
    }
  }

  // Fallback defaults: balanced variety
  return {
    primary: ['phone', 'book'],
    supporting: ['puzzle', 'lamp', 'notebook', 'coin'],
    description: 'Универсальная сбалансированная композиция',
  };
}

export function generateCompositionByMetaphor(
  prompt: string,
  formatId: CanvasFormatId
): CanvasObject[] {
  const format = CANVAS_FORMATS[formatId];
  const { primary, supporting } = analyzeMetaphor(prompt);

  const cx = format.width / 2;
  const cy = format.height / 2;
  const objects: CanvasObject[] = [];

  let instanceCounter = 0;

  // 1. Primary Focal Object(s) - Main state
  const focalId = primary[0] || 'phone';
  objects.push({
    instanceId: `inst_${++instanceCounter}_${focalId}`,
    illustrationId: focalId,
    variant: 'Main',
    x: cx - 120,
    y: cy - 80,
    scale: 1.15,
    rotation: 0,
    zIndex: 10,
  });

  if (primary[1]) {
    const secondFocal = primary[1];
    objects.push({
      instanceId: `inst_${++instanceCounter}_${secondFocal}`,
      variant: 'Main',
      illustrationId: secondFocal,
      x: cx + 110,
      y: cy + 40,
      scale: 1.0,
      rotation: 0,
      zIndex: 12,
    });
  }

  // 2. Supporting background / accent objects
  // Layout offsets based on canvas ratio
  const layoutSlots =
    formatId === 'horizontal'
      ? [
          { x: cx - 380, y: cy - 130, scale: 0.85, variant: 'Bg' as const },
          { x: cx + 360, y: cy - 110, scale: 0.85, variant: 'Bg' as const },
          { x: cx - 260, y: cy + 120, scale: 0.9, variant: 'Main' as const },
          { x: cx + 280, y: cy + 130, scale: 0.8, variant: 'Bg' as const },
        ]
      : formatId === 'vertical'
      ? [
          { x: cx - 130, y: cy - 340, scale: 0.85, variant: 'Bg' as const },
          { x: cx + 120, y: cy - 200, scale: 0.9, variant: 'Main' as const },
          { x: cx - 140, y: cy + 260, scale: 0.85, variant: 'Bg' as const },
          { x: cx + 130, y: cy + 380, scale: 0.8, variant: 'Bg' as const },
        ]
      : [
          // Square 1:1
          { x: cx - 240, y: cy - 230, scale: 0.85, variant: 'Bg' as const },
          { x: cx + 220, y: cy - 220, scale: 0.85, variant: 'Bg' as const },
          { x: cx - 240, y: cy + 200, scale: 0.9, variant: 'Main' as const },
          { x: cx + 240, y: cy + 210, scale: 0.8, variant: 'Bg' as const },
        ];

  supporting.forEach((item, idx) => {
    if (idx >= layoutSlots.length) return;
    const slot = layoutSlots[idx];
    objects.push({
      instanceId: `inst_${++instanceCounter}_${item}`,
      illustrationId: item,
      variant: slot.variant,
      x: slot.x,
      y: slot.y,
      scale: slot.scale,
      rotation: 0,
      zIndex: slot.y > cy ? 15 + idx : 4 + idx,
    });
  });

  // Sort objects by zIndex for painters' algorithm
  return objects.sort((a, b) => a.zIndex - b.zIndex);
}
