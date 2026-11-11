### 1. Разбор текущей реализации: что это на самом деле?

Сейчас в `src/utils/aiComposer.ts` реализован **детерминированный классификатор на жестких правилах (Rule-Based Heuristic Engine)** в паре с **алгоритмическим компоновщиком (Slot-based Layout Solver)**. Никакого машинного обучения (ML), нейросетей или векторных эмбеддингов там нет.

Как это работает под капотом по шагам:
1. **Псевдо-стемминг и поиск подстрок (`analyzeMetaphor`):** Входная строка приводится к нижнему регистру (`toLowerCase()`). Скрипт линейно проходит по массиву `SEMANTIC_RULES` и через `String.prototype.includes()` ищет вхождение обрезанных корней слов (например, `'обучен'`, `'крипт'`, `'брейншторм'`).
   * *Уязвимость:* Срабатывает **первое** совпавшее правило (`First-Match Wins`). Запрос *«Обучение финтех-команды дизайну»* вернет только объекты из правила `финтех` (так как оно стоит нулевым в массиве), полностью проигнорировав контекст обучения, команды и дизайна. Отрицания (*«бизнес без бумажных папок»*) также не понимаются — слово `'бизнес'` триггернет папку (`folder`).
2. **Жесткая онтология:** Каждому правилу статично прибиты массивы `primary` (1–2 фокусных объекта) и `supporting` (3–4 фоновых). Нет вариативности (temperature = 0) — на один и тот же класс запросов всегда выдается идентичный набор ассетов.
3. **Изометрический солвер (`generateCompositionByMetaphor`):** Берет центр холста `(cx, cy)` и раскладывает объекты по заранее захардкоженным координатам (`layoutSlots`) в зависимости от пропорций (`horizontal`, `vertical`, `square`). Глубина (`zIndex`) вычисляется линейно по оси Y (`slot.y > cy ? 15 + idx : 4 + idx`) для соблюдения алгоритма художника в изометрии (объекты ниже по экрану перекрывают те, что выше).

---

### 2. Оценка глазами Техлида / Рекрутера на позицию Junior AI Developer

#### Почему текущий подход хорош как инженерная база (Pros):
* **Zero-Cost & Zero-Latency:** Мгновенный отклик (`<1 мс`), не требует бэкенда, прокси-серверов и оплаты токенов.
* **Безопасность на GitHub Pages:** В статическом SPA нельзя спрятать приватный API-ключ в бандле (его вытащат из вкладки Network за 10 секунд). Детерминированный движок решает проблему демо-режима «из коробки» — рекрутер открывает ссылку, и всё гарантированно работает со 100% аптаймом.
* **Предсказуемость верстки:** LLM плохо считают пиксельные координаты в отрыве от визуального контекста. Алгоритмические слоты гарантируют, что объекты не улетят за края холста.

#### Чего критически не хватает для позиции AI Developer (Cons):
Если сдать **только** `includes()` по массиву строк, техлид скажет: *«Кандидат отличный фронтендер, но где здесь AI? Это `if-else` из 2010 года»*. Для AI-разработчика не показаны ключевые компетенции:
1. **Работа с LLM API и Structured Outputs (JSON Schema):** Умение системно промптить модель, ограничивать её галлюцинации строгим списком ассетов (`IllustrationId`) и гарантированно получать валидный типизированный JSON.
2. **Семантическое понимание (Zero-shot reasoning):** Способность обработать нестандартную метафору, которой нет в словаре (например, *«Выгорание на удаленке в дедлайн»* $\rightarrow$ лампа, разбросанные документы, телефон, наушники).
3. **Graceful Degradation (Отказоустойчивость):** Архитектурный паттерн, где LLM выступает умным оркестратором, но при ошибке сети/отсутствии ключа система бесшовно падает на локальный математический классификатор (BM25 / Cosine Similarity по весам, а не тупой `first-match`).

---

### 3. Архитектура уровня Senior/Lead: Гибридный AI-движок

Чтобы тестовое пробило потолок ожиданий на позицию Junior AI Developer, внедряем двухконтурную архитектуру (**Dual-Engine Architecture**):

```
[ Пользовательский промпт ]
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ Контур 1: LLM Spatial & Semantic Agent (BYOK Mode)     │
│ Провайдеры: Gemini 2.5 Flash / OpenRouter / OpenAI     │
│ Вход: Системный промпт с онтологией ассетов + Формат   │
│ Выход: Строгий JSON (primary, supporting, jitter, why) │
└───────────┬────────────────────────────────────────────┘
            │ (Нет ключа / Ошибка сети / Таймаут / Невалидный JSON)
            ▼ Fallback
┌────────────────────────────────────────────────────────┐
│ Контур 2: Локальный Multi-Label Scoring Engine         │
│ Вместо first-match: взвешенный скоринг всех правил,    │
│ смешивание категорий (блендинг векторов тем) +         │
│ детерминированный псевдорандом (seed от хеша строки)   │
└───────────┬────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ Контур 3: Isometric Spatial Solver (Физика / Слоты)    │
│ Принимает семантический граф объектов и раскладывает   │
│ по безопасным координатам с микро-смещениями (jitter)  │
└────────────────────────────────────────────────────────┘
```

**Ключевое решение (Separation of Concerns):** Мы не заставляем LLM угадывать сырые координаты типа `x: 432, y: 819` (модели часто лепят объекты друг на друга). LLM решает **семантическую и композиционную задачу**: выбирает ассеты из строгого enum, назначает им роли (`Main` / `Bg`), масштабный акцент и выдает текстовое обоснование (`reasoning`) для UI, а финальную геометрическую раскладку с защитой от коллизий делает наш изометрический солвер. (Опционально LLM может передавать нормализованные офсеты `dx, dy` в диапазоне `[-1, 1]`).

---

### 4. Production-код для интеграции в проект

Ниже приведены полные файлы без заглушек. Скопируй и замени `src/utils/aiComposer.ts` и `src/components/AiModal.tsx` (при необходимости обнови проп `onGenerate` в родительском `App.tsx`, либо оставь обратную совместимость — код ниже поддерживает оба варианта).

#### Файл 1: `src/utils/aiComposer.ts`
Реализует поддержку **Gemini API / OpenAI-compatible (OpenRouter, Groq, OpenAI)** со строгой валидацией схемы + продвинутый локальный **Multi-Rule Weighted Classifier** с хеш-сидированием (разные промпты вне словаря дают разные композиции).

```typescript
import { CanvasFormatId, CanvasObject, CANVAS_FORMATS, IllustrationId } from '../types';

export type AiProvider = 'local' | 'gemini' | 'openai';

export interface AiConfig {
  provider: AiProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string; // Для OpenRouter / кастомных эндпоинтов
}

export interface CompositionResult {
  objects: CanvasObject[];
  reasoning: string;
  engineUsed: 'llm' | 'heuristic-fallback' | 'local-weighted';
}

export const VALID_ILLUSTRATION_IDS: IllustrationId[] = [
  'phone',
  'coin',
  'folder',
  'notebook',
  'pen',
  'book',
  'lamp',
  'headphones',
  'puzzle',
  'vase',
];

const ASSET_ONTOLOGY_DESCRIPTION: Record<IllustrationId, string> = {
  phone: 'Смартфон, мобильное приложение, коммуникации, диджитал, уведомления, соцсети, финтех-клиент',
  coin: 'Монета, деньги, финансы, крипто, инвестиции, прибыль, капитал, экономика, монетизация',
  folder: 'Папка с файлами, документооборот, бюрократия, архив, порядок, корпоративные данные, отчеты',
  notebook: 'Блокнот, заметки, планирование, конспект, список задач, менеджмент, черновик',
  pen: 'Ручка, подписание договора, копирайтинг, письмо, авторство, редактура, дизайн-скетчинг',
  book: 'Книга, фундаментальные знания, образование, университет, база знаний, чтение, наука',
  lamp: 'Настольная лампа, инсайт, идея, эврика, ночная работа, глубокий фокус, уютное рабочее место, свет',
  headphones: 'Наушники, глубокая концентрация (deep work), музыка, подкаст, аудио, кодинг в потоке, изоляция от шума',
  puzzle: 'Пазл, решение нетривиальной проблемы, синергия команды, интеграция систем, стратегия, логика',
  vase: 'Ваза с растением, эстетика, креатив, дизайн-студия, гармония, баланс work-life, спокойствие',
};

export interface SemanticRule {
  id: string;
  keywords: string[];
  primary: IllustrationId[];
  supporting: IllustrationId[];
  mood: 'focus' | 'dynamic' | 'balance' | 'creative';
}

export const SEMANTIC_RULES: SemanticRule[] = [
  {
    id: 'fintech',
    keywords: ['финтех', 'банк', 'деньг', 'крипт', 'инвест', 'доход', 'капитал', 'бюджет', 'оплат', 'fintech', 'money', 'finance', 'crypto'],
    primary: ['coin', 'phone'],
    supporting: ['folder', 'notebook', 'pen', 'puzzle'],
    mood: 'balance',
  },
  {
    id: 'education',
    keywords: ['обучен', 'знани', 'учеб', 'книг', 'курс', 'студент', 'лекци', 'образован', 'наук', 'универ', 'study', 'education', 'book', 'learn'],
    primary: ['book', 'lamp'],
    supporting: ['notebook', 'pen', 'headphones', 'puzzle'],
    mood: 'focus',
  },
  {
    id: 'teamwork',
    keywords: ['команд', 'брейншторм', 'стартап', 'партнер', 'синерги', 'пазл', 'митинг', 'созвон', 'интеграц', 'team', 'brainstorm', 'puzzle', 'collab'],
    primary: ['puzzle', 'phone'],
    supporting: ['lamp', 'notebook', 'coin', 'vase'],
    mood: 'dynamic',
  },
  {
    id: 'deep_focus',
    keywords: ['фокус', 'разработк', 'код', 'программир', 'технолог', 'аудио', 'музык', 'поток', 'дедлайн', 'ноч', 'tech', 'dev', 'focus', 'code'],
    primary: ['headphones', 'lamp'],
    supporting: ['phone', 'notebook', 'puzzle', 'book'],
    mood: 'focus',
  },
  {
    id: 'corporate',
    keywords: ['офис', 'бизнес', 'документ', 'отчет', 'план', 'менеджмент', 'договор', 'сделк', 'аудит', 'work', 'business', 'office', 'contract'],
    primary: ['folder', 'notebook'],
    supporting: ['pen', 'lamp', 'phone', 'coin'],
    mood: 'balance',
  },
  {
    id: 'creative',
    keywords: ['творчеств', 'дизайн', 'вдохновен', 'иде', 'арт', 'креатив', 'студи', 'эстетик', 'уют', 'creative', 'art', 'design', 'idea'],
    primary: ['vase', 'lamp'],
    supporting: ['puzzle', 'book', 'pen', 'notebook'],
    mood: 'creative',
  },
];

export const PRESET_METAPHORS = [
  { title: 'Финтех и аналитика', query: 'Финтех-стартап, криптовалюты и управление капиталом' },
  { title: 'Командный брейншторм', query: 'Командный брейншторм, решение сложных пазлов и синергия' },
  { title: 'Глубокий фокус в дедлайн', query: 'Ночной кодинг в наушниках, глубокая концентрация и поиск инсайта' },
  { title: 'Образование будущего', query: 'Онлайн-университет, фундаментальные книги и конспектирование' },
  { title: 'Творческая дизайн-студия', query: 'Уютная студия дизайна, эстетика, настольная лампа и свежие идеи' },
  { title: 'Слияние EdTech и бизнеса', query: 'Корпоративное обучение сотрудников, подписание контрактов и рост прибыли' },
];

const STORAGE_KEY = 'ochen_ai_config_v1';

export function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore storage errors
  }
  return { provider: 'local' };
}

export function saveAiConfig(config: AiConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
}

/** Детерминированный хеш строки для воспроизводимого рандома на неизвестных запросах */
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Улучшенный локальный Multi-Label классификатор (взвешенный скоринг всех тем + блендинг)
 * Решает проблему First-Match Wins на кросс-доменных запросах.
 */
export function analyzeMetaphorLocal(input: string): {
  primary: IllustrationId[];
  supporting: IllustrationId[];
  description: string;
  seed: number;
} {
  const lower = input.toLowerCase();
  const seed = hashString(lower);

  const assetScores = new Map<IllustrationId, number>();
  VALID_ILLUSTRATION_IDS.forEach((id) => assetScores.set(id, 0));

  const matchedRules: string[] = [];

  for (const rule of SEMANTIC_RULES) {
    let hits = 0;
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) hits++;
    }
    if (hits > 0) {
      matchedRules.push(rule.id);
      // Начисляем веса: primary получают больший буст, чем supporting
      rule.primary.forEach((id, idx) => {
        assetScores.set(id, (assetScores.get(id) || 0) + hits * (idx === 0 ? 5.0 : 3.5));
      });
      rule.supporting.forEach((id, idx) => {
        assetScores.set(id, (assetScores.get(id) || 0) + hits * Math.max(1.0, 2.2 - idx * 0.3));
      });
    }
  }

  // Также проверяем прямые упоминания самих предметов в промпте
  const directMentions: Record<IllustrationId, string[]> = {
    phone: ['телефон', 'смартфон', 'экран', 'приложен', 'phone'],
    coin: ['монет', 'деньг', 'рубл', 'доллар', 'coin'],
    folder: ['папк', 'файл', 'архив', 'folder'],
    notebook: ['блокнот', 'тетрад', 'ежедневник', 'заметк', 'notebook'],
    pen: ['ручк', 'карандаш', 'перо', 'pen'],
    book: ['книг', 'учебник', 'том', 'book'],
    lamp: ['ламп', 'свет', 'торшер', 'lamp'],
    headphones: ['наушник', 'гарнитур', 'звук', 'headphones'],
    puzzle: ['пазл', 'головоломк', 'детал', 'puzzle'],
    vase: ['ваз', 'цвет', 'растен', 'букет', 'vase'],
  };

  for (const [id, stems] of Object.entries(directMentions) as [IllustrationId, string[]][]) {
    if (stems.some((s) => lower.includes(s))) {
      assetScores.set(id, (assetScores.get(id) || 0) + 6.0);
    }
  }

  if (matchedRules.length > 0 || Array.from(assetScores.values()).some((v) => v > 0)) {
    const sorted = Array.from(assetScores.entries())
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    // Добиваем список детерминированно по сиду, если совпало мало объектов
    for (let i = 0; sorted.length < 6 && i < VALID_ILLUSTRATION_IDS.length; i++) {
      const candidate = VALID_ILLUSTRATION_IDS[(seed + i * 3) % VALID_ILLUSTRATION_IDS.length];
      if (!sorted.includes(candidate)) sorted.push(candidate);
    }

    return {
      primary: sorted.slice(0, 2),
      supporting: sorted.slice(2, 6),
      description: `Локальный мульти-классификатор: скомбинированы домены [${matchedRules.join(' + ') || 'прямые объекты'}]`,
      seed,
    };
  }

  // Fallback с детерминированным разнообразием на основе хеша строки
  const shuffled = [...VALID_ILLUSTRATION_IDS].sort(
    (a, b) => hashString(a + lower) - hashString(b + lower)
  );

  return {
    primary: shuffled.slice(0, 2),
    supporting: shuffled.slice(2, 6),
    description: 'Эвристическая генерация на основе семантического хеша запроса',
    seed,
  };
}

/** Обратная совместимость со старым синхронным API */
export function analyzeMetaphor(input: string) {
  const { primary, supporting, description } = analyzeMetaphorLocal(input);
  return { primary, supporting, description };
}

interface LlmSceneSchema {
  primary: IllustrationId[];
  supporting: IllustrationId[];
  reasoning: string;
}

function buildSystemPrompt(): string {
  const catalog = Object.entries(ASSET_ONTOLOGY_DESCRIPTION)
    .map(([id, desc]) => `- "${id}": ${desc}`)
    .join('\n');

  return `Ты — арт-директор и пространственный AI-компоновщик изометрических сцен.
Твоя задача — перевести текстовую метафору пользователя в визуальную композицию из строго ограниченного каталога 3D/изометрических объектов.

ДОСТУПНЫЙ КАТАЛОГ ОБЪЕКТОВ (используй ТОЛЬКО эти строковые ID):
${catalog}

ПРАВИЛА КОМПОЗИЦИИ:
1. Выбери 1 или 2 ключевых объекта ("primary"), которые несут главный метафорический смысл и будут крупными в центре внимания.
2. Выбери от 3 до 4 вспомогательных объектов ("supporting"), раскрывающих контекст, атмосферу и детали вокруг центра.
3. Объекты в primary и supporting НЕ должны повторяться.
4. Поле "reasoning": кратко (1-2 предложения на русском) объясни арт-директорскую логику выбора этих метафор.

Верни СТРОГО валидный JSON без markdown-оберток по следующей схеме:
{
  "primary": ["id1", "id2"],
  "supporting": ["id3", "id4", "id5", "id6"],
  "reasoning": "Объяснение выбора метафоры"
}`;
}

function validateAndSanitizeLlmOutput(rawJson: unknown): LlmSceneSchema | null {
  if (!rawJson || typeof rawJson !== 'object') return null;
  const obj = rawJson as Record<string, unknown>;

  const filterValid = (arr: unknown): IllustrationId[] => {
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (item): item is IllustrationId =>
        typeof item === 'string' && VALID_ILLUSTRATION_IDS.includes(item as IllustrationId)
    );
  };

  const primary = Array.from(new Set(filterValid(obj.primary))).slice(0, 2);
  const supporting = Array.from(
    new Set(filterValid(obj.supporting).filter((id) => !primary.includes(id)))
  ).slice(0, 4);

  if (primary.length === 0) return null;

  return {
    primary,
    supporting,
    reasoning:
      typeof obj.reasoning === 'string' && obj.reasoning.trim()
        ? obj.reasoning.trim()
        : 'Сцена собрана нейросетевым планировщиком по семантике запроса.',
  };
}

async function callLlmSemanticAgent(prompt: string, config: AiConfig): Promise<LlmSceneSchema> {
  const apiKey = config.apiKey?.trim();
  if (!apiKey) throw new Error('API key is missing');

  const systemInstruction = buildSystemPrompt();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    let rawText = '';

    if (config.provider === 'gemini') {
      const model = config.model?.trim() || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: `Метафора / Заголовок: "${prompt}"` }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = await res.json();
      rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (config.provider === 'openai') {
      const baseUrl = (config.baseUrl?.trim() || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
      const model = config.model?.trim() || 'openai/gpt-4o-mini';

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `Метафора / Заголовок: "${prompt}"` },
          ],
        }),
      });

      if (!res.ok) throw new Error(`OpenAI/OpenRouter HTTP ${res.status}`);
      const data = await res.json();
      rawText = data?.choices?.[0]?.message?.content || '';
    }

    // Очистка на случай если модель все же обернула ответ в ```json ... ```
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    const validated = validateAndSanitizeLlmOutput(parsed);

    if (!validated) {
      throw new Error('LLM returned invalid schema');
    }
    return validated;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Пространственный изометрический солвер: раскладывает выбранные ассеты по слотам
 * с легким детерминированным микро-смещением (jitter) для живой композиции.
 */
function buildIsometricLayout(
  primary: IllustrationId[],
  supporting: IllustrationId[],
  formatId: CanvasFormatId,
  seed: number
): CanvasObject[] {
  const format = CANVAS_FORMATS[formatId];
  const cx = format.width / 2;
  const cy = format.height / 2;
  const objects: CanvasObject[] = [];

  let instanceCounter = 0;
  const jitter = (step: number, amplitude: number) =>
    (((seed >> (step * 3)) & 0xff) / 255 - 0.5) * 2 * amplitude;

  const focalId = primary[0] || 'phone';
  objects.push({
    instanceId: `inst_${Date.now()}_${++instanceCounter}_${focalId}`,
    illustrationId: focalId,
    variant: 'Main',
    x: Math.round(cx - (primary[1] ? 115 : 0) + jitter(1, 18)),
    y: Math.round(cy - (primary[1] ? 70 : 10) + jitter(2, 14)),
    scale: 1.15,
    rotation: 0,
    zIndex: 10,
  });

  if (primary[1]) {
    const secondFocal = primary[1];
    objects.push({
      instanceId: `inst_${Date.now()}_${++instanceCounter}_${secondFocal}`,
      illustrationId: secondFocal,
      variant: 'Main',
      x: Math.round(cx + 110 + jitter(3, 18)),
      y: Math.round(cy + 45 + jitter(4, 14)),
      scale: 1.02,
      rotation: 0,
      zIndex: 12,
    });
  }

  const layoutSlots =
    formatId === 'horizontal'
      ? [
          { x: cx - 380, y: cy - 130, scale: 0.85, variant: 'Bg' as const },
          { x: cx + 360, y: cy - 110, scale: 0.85, variant: 'Bg' as const },
          { x: cx - 260, y: cy + 125, scale: 0.9, variant: 'Main' as const },
          { x: cx + 285, y: cy + 130, scale: 0.82, variant: 'Bg' as const },
        ]
      : formatId === 'vertical'
      ? [
          { x: cx - 130, y: cy - 340, scale: 0.85, variant: 'Bg' as const },
          { x: cx + 120, y: cy - 205, scale: 0.9, variant: 'Main' as const },
          { x: cx - 140, y: cy + 260, scale: 0.85, variant: 'Bg' as const },
          { x: cx + 130, y: cy + 380, scale: 0.82, variant: 'Bg' as const },
        ]
      : [
          { x: cx - 240, y: cy - 230, scale: 0.85, variant: 'Bg' as const },
          { x: cx + 225, y: cy - 220, scale: 0.85, variant: 'Bg' as const },
          { x: cx - 240, y: cy + 205, scale: 0.9, variant: 'Main' as const },
          { x: cx + 240, y: cy + 215, scale: 0.82, variant: 'Bg' as const },
        ];

  supporting.forEach((item, idx) => {
    if (idx >= layoutSlots.length) return;
    const slot = layoutSlots[idx];
    const finalY = Math.round(slot.y + jitter(idx + 5, 16));
    objects.push({
      instanceId: `inst_${Date.now()}_${++instanceCounter}_${item}`,
      illustrationId: item,
      variant: slot.variant,
      x: Math.round(slot.x + jitter(idx + 9, 20)),
      y: finalY,
      scale: slot.scale,
      rotation: 0,
      zIndex: finalY > cy ? 15 + idx : 4 + idx,
    });
  });

  return objects.sort((a, b) => a.zIndex - b.zIndex);
}

/** Синхронный генератор (обратная совместимость с текущим App.tsx) */
export function generateCompositionByMetaphor(
  prompt: string,
  formatId: CanvasFormatId
): CanvasObject[] {
  const { primary, supporting, seed } = analyzeMetaphorLocal(prompt);
  return buildIsometricLayout(primary, supporting, formatId, seed);
}

/**
 * Асинхронный гибридный AI-генератор (LLM Agent + Graceful Fallback на локальный классификатор)
 */
export async function generateCompositionHybrid(
  prompt: string,
  formatId: CanvasFormatId,
  customConfig?: AiConfig
): Promise<CompositionResult> {
  const config = customConfig || loadAiConfig();
  const seed = hashString(prompt.toLowerCase());

  if (config.provider !== 'local' && config.apiKey?.trim()) {
    try {
      const llmPlan = await callLlmSemanticAgent(prompt, config);
      return {
        objects: buildIsometricLayout(llmPlan.primary, llmPlan.supporting, formatId, seed),
        reasoning: llmPlan.reasoning,
        engineUsed: 'llm',
      };
    } catch (err) {
      console.warn('[AI Composer] LLM call failed, falling back to local classifier:', err);
      const local = analyzeMetaphorLocal(prompt);
      return {
        objects: buildIsometricLayout(local.primary, local.supporting, formatId, local.seed),
        reasoning: `Fallback на локальный движок (ошибка API): ${local.description}`,
        engineUsed: 'heuristic-fallback',
      };
    }
  }

  const local = analyzeMetaphorLocal(prompt);
  return {
    objects: buildIsometricLayout(local.primary, local.supporting, formatId, local.seed),
    reasoning: local.description,
    engineUsed: 'local-weighted',
  };
}
```

---

#### Файл 2: `src/components/AiModal.tsx`
Обновленная модалка с переключателем движка (`Local Weighted Engine` vs `Gemini API` vs `OpenRouter / OpenAI`), безопасным хранением ключа в `localStorage` браузера (ключ никуда не утекает кроме прямого запроса к API провайдера), состоянием загрузки и выводом `AI Reasoning` (почему выбраны именно эти объекты).

```tsx
import React, { useState, useEffect } from 'react';
import {
  PRESET_METAPHORS,
  AiConfig,
  AiProvider,
  loadAiConfig,
  saveAiConfig,
} from '../utils/aiComposer';
import { Sparkles, X, ArrowRight, Settings2, Cpu, CloudLightning, Loader2 } from 'lucide-react';

interface AiModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Поддерживает как синхронный вызов, так и async Promise */
  onGenerate: (prompt: string) => void | Promise<void>;
}

export const AiModal: React.FC<AiModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [prompt, setPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<AiConfig>(() => loadAiConfig());

  useEffect(() => {
    if (isOpen) {
      setConfig(loadAiConfig());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateConfig = (patch: Partial<AiConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveAiConfig(next);
  };

  const triggerGeneration = async (targetPrompt: string) => {
    if (!targetPrompt.trim() || isLoading) return;
    setIsLoading(true);
    try {
      await onGenerate(targetPrompt.trim());
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerGeneration(prompt);
  };

  const isLlmActive = config.provider !== 'local' && Boolean(config.apiKey?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#111827] border border-slate-700/8