import { CanvasFormatId, CanvasObject, CANVAS_FORMATS, IllustrationId, ObjectVariant } from '../types';

export interface SemanticRule {
  keywords: string[];
  primary: IllustrationId[];
  supporting: IllustrationId[];
  mood: 'focus' | 'dynamic' | 'balance' | 'creative';
}

export const SEMANTIC_RULES: SemanticRule[] = [
  {
    keywords: ['финтех', 'банк', 'деньг', 'крипт', 'инвест', 'доход', 'капитал', 'fintech', 'money', 'finance', 'коин', 'валют'],
    primary: ['coin', 'phone'],
    supporting: ['folder', 'notebook', 'pen'],
    mood: 'balance',
  },
  {
    keywords: ['обучен', 'знани', 'учеб', 'книг', 'курс', 'студент', 'лекци', 'образован', 'study', 'education', 'book', 'школ', 'университет'],
    primary: ['book', 'lamp'],
    supporting: ['notebook', 'pen', 'headphones'],
    mood: 'focus',
  },
  {
    keywords: ['команд', 'брейншторм', 'стартап', 'партнер', 'синерги', 'пазл', 'team', 'brainstorm', 'puzzle', 'collab', 'хакатон'],
    primary: ['puzzle', 'phone'],
    supporting: ['lamp', 'notebook', 'coin', 'vase'],
    mood: 'dynamic',
  },
  {
    keywords: ['фокус', 'разработк', 'код', 'программир', 'технолог', 'аудио', 'музык', 'tech', 'dev', 'focus', 'it', 'айти'],
    primary: ['headphones', 'phone'],
    supporting: ['lamp', 'notebook', 'puzzle'],
    mood: 'focus',
  },
  {
    keywords: ['офис', 'бизнес', 'документ', 'отчет', 'план', 'менеджмент', 'work', 'business', 'office', 'дело'],
    primary: ['folder', 'notebook'],
    supporting: ['pen', 'lamp', 'phone', 'coin'],
    mood: 'balance',
  },
  {
    keywords: ['творчеств', 'дизайн', 'вдохновен', 'иде', 'арт', 'creative', 'art', 'design', 'idea', 'концепт', 'иллюстрац'],
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

let globalInstanceCounter = 0;

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
        description: `Подобран стиль "${rule.mood}" на основе онтологии предметной области`,
      };
    }
  }

  // Fallback defaults
  return {
    primary: ['phone', 'book'],
    supporting: ['puzzle', 'lamp', 'notebook', 'coin'],
    description: 'Универсальная сбалансированная композиция',
  };
}

/**
 * Studio Isometric Cluster Engine:
 * Строит гармоничную композицию вокруг доминирующего Hero-предмета с лучевой
 * привязкой под изометрическим углом 30° и естественным перекрытием 15–25%.
 */
export function generateCompositionByMetaphor(
  prompt: string,
  formatId: CanvasFormatId
): CanvasObject[] {
  const format = CANVAS_FORMATS[formatId];
  const { primary, supporting } = analyzeMetaphor(prompt);

  const cx = format.width / 2;
  const cy = format.height / 2;
  const objects: CanvasObject[] = [];

  // Случайный джиттер для вариативности при повторной генерации
  const seed = Math.random();
  const archetype = seed < 0.4 ? 'hero_cluster' : seed < 0.75 ? 'isometric_cascade' : 'triad_balance';

  // 1. Hero Object (крупный якорный объект в фокусе)
  const heroId = primary[0] || 'book';
  const heroX = cx + (Math.random() * 20 - 10);
  const heroY = cy - 20 + (Math.random() * 20 - 10);
  const heroScale = 1.25;

  objects.push({
    instanceId: `inst_${Date.now()}_${++globalInstanceCounter}_${heroId}`,
    illustrationId: heroId,
    variant: 'Main',
    x: Math.round(heroX),
    y: Math.round(heroY),
    scale: heroScale,
    rotation: 0,
    zIndex: 10,
  });

  // 2. Вторичный фокусный объект (если есть)
  if (primary[1]) {
    const secondId = primary[1];
    // Размещение по изометрической диагонали вперед-вправо
    const secondX = heroX + 150 + (Math.random() * 20 - 10);
    const secondY = heroY + 85 + (Math.random() * 15 - 7);
    objects.push({
      instanceId: `inst_${Date.now()}_${++globalInstanceCounter}_${secondId}`,
      illustrationId: secondId,
      variant: 'Main',
      x: Math.round(secondX),
      y: Math.round(secondY),
      scale: 1.05,
      rotation: 0,
      zIndex: 14, // перекрывает Hero спереди
    });
  }

  // 3. Спутники (аксессуары и фоновый контекст), привязанные к изометрическим лучам
  // Угол изометрии: dy = dx * tan(30°) = dx * 0.577
  type SlotDef = { dx: number; dy: number; scale: number; variant: ObjectVariant };

  let slotArchetype: SlotDef[];

  if (archetype === 'hero_cluster') {
    slotArchetype = [
      // На заднем плане слева-вверху (за Hero)
      { dx: -160, dy: -90, scale: 0.9, variant: 'Bg' },
      // На заднем плане справа-вверху (за Hero)
      { dx: 140, dy: -80, scale: 0.85, variant: 'Bg' },
      // На переднем плане слева-внизу (ближе к зрителю)
      { dx: -150, dy: 90, scale: 0.95, variant: 'Main' },
      // Акцентный предмет на столе спереди
      { dx: 40, dy: 140, scale: 0.75, variant: 'Bg' },
    ];
  } else if (archetype === 'isometric_cascade') {
    slotArchetype = [
      // Диагональный каскад по лучу 30°
      { dx: -200, dy: -115, scale: 0.8, variant: 'Bg' },
      { dx: -100, dy: -55, scale: 0.95, variant: 'Main' },
      { dx: 100, dy: 60, scale: 0.9, variant: 'Bg' },
      { dx: 190, dy: 110, scale: 0.75, variant: 'Main' },
    ];
  } else {
    // Triad balance
    slotArchetype = [
      { dx: -180, dy: 30, scale: 0.9, variant: 'Main' },
      { dx: 90, dy: -110, scale: 0.85, variant: 'Bg' },
      { dx: -80, dy: 120, scale: 0.85, variant: 'Bg' },
      { dx: 170, dy: 40, scale: 0.8, variant: 'Main' },
    ];
  }

  // Для узкого вертикального формата сжимаем по X и растягиваем по Y
  const aspectScaleX = formatId === 'vertical' ? 0.75 : formatId === 'horizontal' ? 1.25 : 1.0;
  const aspectScaleY = formatId === 'vertical' ? 1.25 : formatId === 'horizontal' ? 0.85 : 1.0;

  supporting.slice(0, 4).forEach((item, idx) => {
    const slot = slotArchetype[idx] || slotArchetype[0];
    const jitterX = (Math.random() * 24 - 12);
    const jitterY = (Math.random() * 16 - 8);

    const finalX = Math.round(heroX + slot.dx * aspectScaleX + jitterX);
    const finalY = Math.round(heroY + slot.dy * aspectScaleY + jitterY);

    // В изометрии zIndex строго зависит от координаты Y (нижние предметы ближе к зрителю)
    const baseZ = finalY > heroY ? 12 + idx : 4 + idx;

    objects.push({
      instanceId: `inst_${Date.now()}_${++globalInstanceCounter}_${item}`,
      illustrationId: item,
      variant: slot.variant,
      x: Math.max(80, Math.min(format.width - 80, finalX)),
      y: Math.max(80, Math.min(format.height - 80, finalY)),
      scale: slot.scale,
      rotation: 0,
      zIndex: baseZ,
    });
  });

  // Нормализуем z-index по глубине Y (Painter's algorithm)
  const sorted = objects.sort((a, b) => a.y - b.y);
  return sorted.map((o, idx) => ({ ...o, zIndex: idx }));
}
