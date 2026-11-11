import { beforeEach, describe, expect, it } from 'vitest';
import type { IllustrationId, Palette } from '../../types';
import { composeByComponentList, generateCompositionByMetaphor } from '../../utils/aiComposer';
import {
  buildSvgRawKey,
  compileFullSvg,
  composeScene,
  extractSvgInner,
  FALLBACK_PLACEHOLDER_SVG,
  MAX_TRACE_HISTORY,
  normalizeHex,
  parseSvgViewBoxPure,
  recolorSvgPure,
  runEngineSmokeSuite,
  scopeSvgIds,
  traceStore,
} from '../index';
import type { PipelineTrace } from '../index';

const SAND: Palette = {
  id: 'sand',
  name: 'Sand',
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
};

const rawAsset = (label: string): string =>
  '<?xml version="1.0"?>' +
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 80" fill="none">' +
  '<defs><linearGradient id="grad"><stop offset="0" stop-color="#AA9BF0"/><stop offset="1" stop-color="#7864D7"/></linearGradient></defs>' +
  `<!-- ${label} -->` +
  '<rect id="body" width="100" height="80" fill="url(#grad)" stroke="#181817"/>' +
  '<use xlink:href="#body" style="fill:#F9ECB0"/>' +
  '</svg>';

/** Минимальная проверка well-formed XML без DOMParser */
function assertWellFormedXml(xml: string): void {
  const tagRe =
    /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[A-Za-z_][\w:.-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/g;
  const stack: string[] = [];
  let roots = 0;
  let last = 0;
  const checkText = (text: string) => {
    expect(text).not.toMatch(/[<>]/);
    expect(text).not.toMatch(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/);
  };
  for (const m of xml.matchAll(tagRe)) {
    const index = m.index ?? 0;
    checkText(xml.slice(last, index));
    last = index + m[0].length;
    const [, closing, name, attrs, selfClosing] = m;
    if (name === undefined) continue;

    const attrNames = Array.from((attrs ?? '').matchAll(/([A-Za-z_][\w:.-]*)\s*=/g)).map((a) => a[1]);
    expect(new Set(attrNames).size).toBe(attrNames.length);

    if (closing) {
      expect(stack.pop()).toBe(name);
    } else {
      if (stack.length === 0) roots++;
      if (!selfClosing) stack.push(name);
    }
  }
  checkText(xml.slice(last));
  expect(stack).toEqual([]);
  expect(roots).toBe(1);
}

describe('composeScene: стратегии', () => {
  it('exact_preset по id', () => {
    const res = composeScene({ prompt: 'music-focus', format: 'square', seed: 's' });
    expect(res.trace.intent.strategy).toBe('exact_preset');
    expect(res.trace.intent.matchedRuleId).toBe('music-focus');
  });

  it('явный список важнее текста', () => {
    const res = composeScene({ prompt: 'music-focus', components: ['phone', 'puzzle'], format: 'square', seed: 's' });
    expect(res.trace.intent.strategy).toBe('explicit_components');
    expect(res.objects.map((o) => o.illustrationId)).toEqual(expect.arrayContaining(['phone', 'puzzle']));
  });

  it('невалидный список -> разбор текста + предупреждение', () => {
    const res = composeScene({
      prompt: 'music-focus',
      components: ['ufo' as IllustrationId],
      format: 'square',
      seed: 's',
    });
    expect(res.trace.intent.strategy).toBe('exact_preset');
    expect(res.trace.warnings.some((w) => w.includes('валидных'))).toBe(true);
  });

  it('текст с предметами -> explicit_components без lamp', () => {
    const res = composeScene({ prompt: 'Смартфон, Пазл, Букет цветов, Папка', format: 'vertical', seed: 's' });
    expect(res.trace.intent.strategy).toBe('explicit_components');
    const ids = res.objects.map((o) => o.illustrationId);
    expect(ids).toEqual(expect.arrayContaining(['phone', 'puzzle', 'vase', 'folder']));
    expect(ids).not.toContain('lamp');
  });

  it('неизвестный формат -> square + предупреждение', () => {
    const res = composeScene({ prompt: 'music-focus', format: 'round' as never, seed: 's' });
    expect(res.trace.spatial.grid).toMatchObject({ W: 380, H: 380 });
    expect(res.trace.warnings.some((w) => w.includes('формат'))).toBe(true);
  });

  it('детерминизм полного ответа при seed (кроме времени)', () => {
    const req = { prompt: 'Осенний вечер', format: 'horizontal' as const, seed: 'det' };
    const a = composeScene(req);
    const b = composeScene(req);
    expect(a.objects).toEqual(b.objects);
    expect(a.trace.traceId).toBe(b.trace.traceId);
    expect(a.trace.intent).toEqual(b.trace.intent);
    expect(a.trace.roles).toEqual(b.trace.roles);
    expect(a.trace.spatial).toEqual(b.trace.spatial);
  });
});

describe('runEngineSmokeSuite', () => {
  it('все кейсы зелёные', () => {
    const report = runEngineSmokeSuite();
    expect(report.cases.filter((c) => !c.passed)).toEqual([]);
    expect(report.failed).toBe(0);
    expect(report.total).toBeGreaterThanOrEqual(12);
    expect(report.passed).toBe(report.total);
  });

  it('не пишет в traceStore', () => {
    traceStore.clearTraces();
    runEngineSmokeSuite();
    expect(traceStore.getHistory()).toHaveLength(0);
  });
});

describe('traceStore', () => {
  beforeEach(() => traceStore.clearTraces());

  it('record: true пишет трассу и зеркало', () => {
    const res = composeScene({ prompt: 'music-focus', format: 'square', seed: 'r' }, { record: true });
    expect(traceStore.getLatestTrace()?.traceId).toBe(res.trace.traceId);
    const mirror = (globalThis as unknown as { __COMPOSER_LAST_RUN__?: PipelineTrace | null })
      .__COMPOSER_LAST_RUN__;
    expect(mirror?.traceId).toBe(res.trace.traceId);
  });

  it('record: false не пишет', () => {
    composeScene({ prompt: 'music-focus', format: 'square', seed: 'r' });
    expect(traceStore.getLatestTrace()).toBeNull();
  });

  it('кольцевой буфер и стабильный снапшот', () => {
    let notified = 0;
    const unsubscribe = traceStore.subscribe(() => notified++);
    for (let i = 0; i < MAX_TRACE_HISTORY + 5; i++) {
      composeScene({ prompt: `запрос ${i}`, format: 'square', seed: `s${i}` }, { record: true });
    }
    expect(notified).toBe(MAX_TRACE_HISTORY + 5);
    expect(traceStore.getHistory()).toHaveLength(MAX_TRACE_HISTORY);
    expect(traceStore.getSnapshot()).toBe(traceStore.getSnapshot());
    expect(traceStore.getLatestTrace()?.request.prompt).toBe(`запрос ${MAX_TRACE_HISTORY + 4}`);

    unsubscribe();
    composeScene({ prompt: 'после отписки', format: 'square' }, { record: true });
    expect(notified).toBe(MAX_TRACE_HISTORY + 5);

    const bundle = JSON.parse(traceStore.exportDebugBundle());
    expect(bundle.count).toBe(MAX_TRACE_HISTORY);
    expect(bundle.latest.request.prompt).toBe('после отписки');
  });

  it('трасса в хранилище изолирована от мутаций ответа', () => {
    const res = composeScene({ prompt: 'music-focus', format: 'square', seed: 'm' }, { record: true });
    res.objects[0].x = 99999;
    expect(traceStore.getLatestTrace()?.spatial.objects[0].x).not.toBe(99999);
  });
});

describe('SVG-утилиты', () => {
  it('normalizeHex', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('aabbcc')).toBe('#AABBCC');
    expect(normalizeHex(' #AaBbCc ')).toBe('#AABBCC');
  });

  it('recolorSvgPure: однопроходная замена ролей', () => {
    const out = recolorSvgPure('<path fill="#AA9BF0" stroke="#181817" style="fill:#7864D7"/>', SAND);
    expect(out).toContain('fill="#FAC896"');
    expect(out).toContain('fill:#D27532');
    expect(out).not.toContain('#AA9BF0');
  });

  it('recolorSvgPure: Bg-вариант монохромный', () => {
    const out = recolorSvgPure('<path fill="#F9ECB0"/>', SAND.roles, undefined, 'Bg');
    expect(out).toContain('fill="#FAC896"');
  });

  it('scopeSvgIds', () => {
    const out = scopeSvgIds(
      '<svg><g id="a"/><rect fill="url(#a)"/><use href="#a"/><use xlink:href="#zz"/></svg>',
      'obj 1'
    );
    expect(out).toContain('id="obj_1-a"');
    expect(out).toContain('url(#obj_1-a)');
    expect(out).toContain('href="#obj_1-a"');
    expect(out).toContain('xlink:href="#zz"');
  });

  it('parseSvgViewBoxPure / extractSvgInner', () => {
    expect(parseSvgViewBoxPure('<svg viewBox="0 -5 120.5 60"></svg>')).toEqual({
      minX: 0,
      minY: -5,
      vbWidth: 120.5,
      vbHeight: 60,
    });
    expect(parseSvgViewBoxPure('<svg width="40" height="20"></svg>')).toMatchObject({ vbWidth: 40, vbHeight: 20 });
    expect(extractSvgInner(rawAsset('x'))).toMatch(/^<defs>/);
    expect(extractSvgInner('<svg/>')).toBe('');
    expect(extractSvgInner(FALLBACK_PLACEHOLDER_SVG)).toContain('<rect');
  });
});

describe('compileFullSvg', () => {
  const { objects } = composeScene({ prompt: 'music-focus', format: 'square', seed: 'svg' });

  // Последний объект намеренно без ассета -> заглушка
  const svgRawMap: Record<string, string> = {};
  objects.slice(0, -1).forEach((obj) => {
    svgRawMap[buildSvgRawKey(obj.illustrationId, 'L', obj.variant)] = rawAsset(obj.illustrationId);
  });

  const compile = (bg = '#FDD7B9') =>
    compileFullSvg(
      { objects, format: 'square', size: 'L', palette: SAND.roles, canvasBg: bg, svgRawMap },
      { palette: SAND, dimensions: { width: 380, height: 380 } }
    );

  it('well-formed XML (включая экранирование фона)', () => {
    assertWellFormedXml(compile());
    assertWellFormedXml(compile('"><script>'));
  });

  it('корень, фон, перекраска, scoping', () => {
    const svg = compile();
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain('viewBox="0 0 380 380"');
    expect(svg).toContain('fill="#FDD7B9"');
    expect(svg).not.toContain('#AA9BF0');
    expect(svg).toContain('#FAC896');
    expect(svg).not.toContain('id="grad"');
    objects.slice(0, -1).forEach((obj) => {
      expect(svg).toContain(`url(#${obj.instanceId}-grad)`);
    });
    expect(svg).toContain('stroke-dasharray');
  });

  it('порядок слоёв по zIndex', () => {
    const order = Array.from(compile().matchAll(/data-illustration="([^"]+)"/g)).map((m) => m[1]);
    const expected = [...objects].sort((a, b) => a.zIndex - b.zIndex).map((o) => o.illustrationId);
    expect(order).toEqual(expected);
  });

  it('детерминированный вывод', () => {
    expect(compile()).toBe(compile());
  });
});

describe('фасад aiComposer', () => {
  it('пустой список -> []', () => {
    expect(composeByComponentList([], 'square')).toEqual([]);
  });

  it('метафора даёт объекты', () => {
    expect(generateCompositionByMetaphor('music-focus', 'square').length).toBeGreaterThan(0);
  });
});
