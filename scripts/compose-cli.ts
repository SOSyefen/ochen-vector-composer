/**
 * Headless CLI + HTTP-микросервис ядра композитора.
 * ZERO-DEPENDENCY: только встроенные модули Node (fs, path, http, url, util).
 *
 * Режимы:
 *   tsx scripts/compose-cli.ts --prompt "осень" --trace
 *   tsx scripts/compose-cli.ts --components "book,phone,coin" --out out/scene.svg
 *   tsx scripts/compose-cli.ts --smoke
 *   tsx scripts/compose-cli.ts --serve --port 8787
 *
 * Модуль также импортируется из vite.config.ts (createComposeApiHandler) —
 * в этом случае CLI не запускается.
 */
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { CANVAS_FORMATS, S_SIZE_SCALE_RATIO } from '../src/types';
import type { CanvasFormatId, CanvasObject, DetailSize, ObjectVariant, Palette } from '../src/types';
import {
  BUILTIN_PALETTES,
  ENGINE_VERSION,
  buildSvgRawKey,
  compileFullSvg,
  composeScene,
  isIllustrationId,
  runEngineSmokeSuite,
} from '../src/engine/index';
import type { ComposeRequest, LayoutStyle, PipelineTrace, SmokeReport } from '../src/engine/index';

// ---- Constants -------------------------------------------------------------

const DETAIL_SIZES: readonly DetailSize[] = ['L', 'S'];
const OBJECT_VARIANTS: readonly ObjectVariant[] = ['Main', 'Bg'];
const LAYOUT_STYLES: readonly LayoutStyle[] = ['centered', 'offset', 'headline'];

const DEFAULT_FORMAT: CanvasFormatId = 'square';
const DEFAULT_SIZE: DetailSize = 'L';
const DEFAULT_PORT = 8787;
const DEFAULT_HOST = '127.0.0.1';

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_PROMPT_LENGTH = 2000;
const MAX_SEED_LENGTH = 256;
const MAX_COMPONENTS = 32;

/** Имя файла ассета: `{size}_{variant}_{id}.svg` */
const ASSET_FILE_REGEX = /^(L|S)_(Main|Bg)_([A-Za-z0-9_-]+)\.svg$/;

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

// ---- Errors ----------------------------------------------------------------

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class ValidationError extends HttpError {
  constructor(message: string) {
    super(400, 'invalid_payload', message);
    this.name = 'ValidationError';
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---- Assets ----------------------------------------------------------------

interface SvgCacheEntry {
  signature: string;
  map: Record<string, string>;
}

const svgCache = new Map<string, SvgCacheEntry>();

/** Каталог ассетов: явный аргумент > COMPOSER_ASSETS_DIR > рядом с модулем > от cwd */
export function resolveAssetsDir(assetsDir?: string): string {
  if (assetsDir) return path.resolve(assetsDir);
  const fromEnv = process.env.COMPOSER_ASSETS_DIR;
  if (fromEnv) return path.resolve(fromEnv);
  const candidates = [
    path.resolve(MODULE_DIR, '../src/assets/illustrations'),
    path.resolve(process.cwd(), 'src/assets/illustrations'),
  ];
  return candidates.find((dir) => fs.existsSync(dir)) ?? candidates[0];
}

/**
 * Читает `src/assets/illustrations/{size}_{variant}_{id}.svg` в карту `{id}_{size}_{variant}`.
 * Результат кешируется и инвалидируется при изменении списка файлов или их mtime.
 */
export function loadSvgRawMapFromDisk(assetsDir?: string): Record<string, string> {
  const dir = resolveAssetsDir(assetsDir);
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return {};
  }

  const files = entries
    .map((name) => ({ name, match: ASSET_FILE_REGEX.exec(name) }))
    .filter(
      (f): f is { name: string; match: RegExpExecArray } =>
        f.match !== null &&
        DETAIL_SIZES.includes(f.match[1] as DetailSize) &&
        OBJECT_VARIANTS.includes(f.match[2] as ObjectVariant) &&
        isIllustrationId(f.match[3])
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const stats = files.map((f) => {
    const fullPath = path.join(dir, f.name);
    return { ...f, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
  });
  const signature = stats.map((f) => `${f.name}:${f.mtimeMs}`).join('|');

  const cached = svgCache.get(dir);
  if (cached && cached.signature === signature) return { ...cached.map };

  const map: Record<string, string> = {};
  for (const f of stats) {
    const [, size, variant, id] = f.match;
    if (!isIllustrationId(id)) continue;
    map[buildSvgRawKey(id, size as DetailSize, variant as ObjectVariant)] = fs.readFileSync(f.fullPath, 'utf8');
  }
  svgCache.set(dir, { signature, map });
  return { ...map };
}

// ---- Payload validation ----------------------------------------------------

export interface ComposePayload {
  prompt?: string;
  components?: string[] | string;
  format?: CanvasFormatId;
  styleOverride?: LayoutStyle;
  size?: DetailSize;
  seed?: string;
  paletteId?: string;
  includeSvg?: boolean;
}

export interface ComposeResult {
  objects: CanvasObject[];
  trace: PipelineTrace;
  svg?: string;
  /** Ключи ассетов, не найденных на диске (заменены заглушкой) */
  missingAssets?: string[];
}

export interface ComposeExecutionOptions {
  assetsDir?: string;
}

interface NormalizedPayload {
  request: ComposeRequest;
  size: DetailSize;
  palette: Palette;
  includeSvg: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(source: Record<string, unknown>, key: string, maxLength: number): string | undefined {
  const value = source[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') throw new ValidationError(`Поле "${key}" должно быть строкой.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(`Поле "${key}" длиннее ${maxLength} символов.`);
  }
  return trimmed.length > 0 ? trimmed : undefined;
}

function readEnum<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T | undefined {
  const value = readOptionalString(source, key, 64);
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) {
    throw new ValidationError(`Поле "${key}" должно быть одним из: ${allowed.join(', ')}.`);
  }
  return value as T;
}

function readComponents(source: Record<string, unknown>): ComposeRequest['components'] {
  const raw = source.components;
  if (raw === undefined || raw === null) return undefined;

  let list: unknown[];
  if (typeof raw === 'string') list = raw.split(',');
  else if (Array.isArray(raw)) list = raw;
  else throw new ValidationError('Поле "components" должно быть массивом строк или строкой через запятую.');

  const ids = list
    .map((item) => {
      if (typeof item !== 'string') throw new ValidationError('Элементы "components" должны быть строками.');
      return item.trim().toLowerCase();
    })
    .filter((item) => item.length > 0);

  if (ids.length > MAX_COMPONENTS) {
    throw new ValidationError(`Слишком много компонентов (максимум ${MAX_COMPONENTS}).`);
  }
  const unknownIds = ids.filter((id) => !isIllustrationId(id));
  if (unknownIds.length > 0) {
    throw new ValidationError(`Неизвестные компоненты: ${unknownIds.join(', ')}.`);
  }
  return ids.length > 0 ? ids.filter(isIllustrationId) : undefined;
}

function normalizePayload(payload: unknown): NormalizedPayload {
  if (!isPlainObject(payload)) throw new ValidationError('Тело запроса должно быть JSON-объектом.');

  const formatIds = Object.keys(CANVAS_FORMATS) as CanvasFormatId[];
  const format = readEnum(payload, 'format', formatIds) ?? DEFAULT_FORMAT;
  const styleOverride = readEnum(payload, 'styleOverride', LAYOUT_STYLES);
  const size = readEnum(payload, 'size', DETAIL_SIZES) ?? DEFAULT_SIZE;
  const prompt = readOptionalString(payload, 'prompt', MAX_PROMPT_LENGTH);
  const seed = readOptionalString(payload, 'seed', MAX_SEED_LENGTH);
  const components = readComponents(payload);

  const paletteId = readOptionalString(payload, 'paletteId', 64);
  const palette = paletteId ? BUILTIN_PALETTES.find((p) => p.id === paletteId) : BUILTIN_PALETTES[0];
  if (!palette) {
    throw new ValidationError(
      `Неизвестная палитра "${paletteId}". Доступны: ${BUILTIN_PALETTES.map((p) => p.id).join(', ')}.`
    );
  }

  const includeSvgRaw = payload.includeSvg;
  if (includeSvgRaw !== undefined && typeof includeSvgRaw !== 'boolean') {
    throw new ValidationError('Поле "includeSvg" должно быть boolean.');
  }

  const request: ComposeRequest = { format };
  if (prompt !== undefined) request.prompt = prompt;
  if (components !== undefined) request.components = components;
  if (styleOverride !== undefined) request.styleOverride = styleOverride;
  if (seed !== undefined) request.seed = seed;

  return { request, size, palette, includeSvg: includeSvgRaw === true };
}

// ---- Execution -------------------------------------------------------------

function roundScale(value: number): number {
  return Number(value.toFixed(4));
}

/** Валидирует payload, запускает пайплайн и (опционально) компилирует SVG. */
export async function executeComposePayload(
  payload: unknown,
  options: ComposeExecutionOptions = {}
): Promise<ComposeResult> {
  const { request, size, palette, includeSvg } = normalizePayload(payload);
  const response = await Promise.resolve(composeScene(request));

  const objects: CanvasObject[] = response.objects.map((obj) =>
    size === 'S' ? { ...obj, scale: roundScale(obj.scale * S_SIZE_SCALE_RATIO) } : { ...obj }
  );

  const result: ComposeResult = { objects, trace: response.trace };
  if (!includeSvg) return result;

  const svgRawMap = loadSvgRawMapFromDisk(options.assetsDir);
  const missing = Array.from(
    new Set(objects.map((obj) => buildSvgRawKey(obj.illustrationId, size, obj.variant)))
  ).filter((key) => !(key in svgRawMap));

  result.svg = compileFullSvg({
    objects,
    format: request.format,
    size,
    palette: palette.roles,
    canvasBg: palette.roles.bg,
    svgRawMap,
  });
  if (missing.length > 0) result.missingAssets = missing;
  return result;
}

// ---- HTTP ------------------------------------------------------------------

type NextFn = (err?: unknown) => void;

export type ComposeApiHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  next?: NextFn
) => void;

export interface ComposeApiOptions extends ComposeExecutionOptions {
  maxBodyBytes?: number;
}

const ROUTE_METHODS: Readonly<Record<string, readonly string[]>> = {
  '/api/health': ['GET'],
  '/api/smoke': ['GET'],
  '/api/compose': ['POST'],
};

function sendJson(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  if (res.writableEnded) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    ...headers,
  });
  res.end(payload);
}

function sendError(res: http.ServerResponse, err: unknown, req?: http.IncomingMessage): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (err instanceof HttpError) {
    const headers: Record<string, string> = {};
    if (err.status === 413) {
      // Сначала отдаём статус клиенту, затем рвём сокет, чтобы он не продолжал слать лишние байты.
      headers.Connection = 'close';
      if (req) res.once('finish', () => req.destroy());
    }
    sendJson(res, err.status, { error: err.code, message: err.message }, headers);
  } else {
    sendJson(res, 500, { error: 'internal_error', message: errorMessage(err) });
  }
}

function readBody(req: http.IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let settled = false;

    req.on('data', (chunk: Buffer) => {
      if (settled) return;
      received += chunk.length;
      if (received > limit) {
        settled = true;
        // Прекращаем буферизацию и чтение: освобождаем память и останавливаем поток данных.
        chunks.length = 0;
        req.pause();
        reject(new HttpError(413, 'payload_too_large', `Тело запроса превышает ${limit} байт.`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

async function readJsonBody(req: http.IncomingMessage, limit: number): Promise<unknown> {
  const raw = await readBody(req, limit);
  if (raw.trim().length === 0) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch (err) {
    throw new HttpError(400, 'invalid_json', `Некорректный JSON: ${errorMessage(err)}`);
  }
}

/** Возвращает true, если запрос обработан этим модулем. */
async function routeRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: ComposeApiOptions
): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  const allowed = ROUTE_METHODS[pathname];
  if (!allowed) return false;

  const method = (req.method ?? 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': [...allowed, 'OPTIONS'].join(', '),
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return true;
  }
  if (!allowed.includes(method)) {
    sendJson(
      res,
      405,
      { error: 'method_not_allowed', message: `Метод ${method} не поддерживается для ${pathname}.` },
      { Allow: [...allowed, 'OPTIONS'].join(', ') }
    );
    return true;
  }

  switch (pathname) {
    case '/api/health':
      sendJson(res, 200, { status: 'ok', engine: ENGINE_VERSION, timestamp: new Date().toISOString() });
      return true;
    case '/api/smoke': {
      const report: SmokeReport = await Promise.resolve(runEngineSmokeSuite());
      sendJson(res, 200, report);
      return true;
    }
    case '/api/compose': {
      const body = await readJsonBody(req, options.maxBodyBytes ?? MAX_BODY_BYTES);
      const result = await executeComposePayload(body, options);
      sendJson(res, 200, result);
      return true;
    }
    default:
      return false;
  }
}

/**
 * Обработчик, совместимый с connect-middleware (Vite) и с http.createServer.
 * Незнакомые маршруты передаются в next(); без next — отвечает 404.
 */
export function createComposeApiHandler(options: ComposeApiOptions = {}): ComposeApiHandler {
  return (req, res, next) => {
    routeRequest(req, res, options)
      .then((handled) => {
        if (handled) return;
        if (next) next();
        else sendJson(res, 404, { error: 'not_found', message: `Маршрут ${req.url ?? '/'} не найден.` });
      })
      .catch((err: unknown) => sendError(res, err, req));
  };
}

export interface ComposeServerOptions extends ComposeApiOptions {
  port?: number;
  host?: string;
}

export function startComposeServer(options: ComposeServerOptions = {}): Promise<http.Server> {
  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  const handler = createComposeApiHandler(options);

  const server = http.createServer((req, res) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      process.stderr.write(`[api] ${req.method ?? '-'} ${req.url ?? '/'} -> ${res.statusCode} (${Date.now() - startedAt} ms)\n`);
    });
    handler(req, res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

// ---- CLI -------------------------------------------------------------------

const USAGE = `
Использование:
  tsx scripts/compose-cli.ts [опции]

Композиция:
  --prompt "<текст>"            Текстовый запрос (например, "осень")
  --components "book,phone"     Явный список компонентов
  --format square|horizontal|vertical   (по умолчанию square)
  --style centered|offset|headline      Принудительная схема
  --size L|S                    (по умолчанию L)
  --seed "<строка>"             Детерминированные instanceId
  --palette <id>                Палитра: ${BUILTIN_PALETTES.map((p) => p.id).join(', ')}
  --out <file.svg>              Записать скомпилированный SVG
  --assets <dir>                Каталог ассетов (по умолчанию src/assets/illustrations)
  --trace                       Включить полный trace в JSON

Режимы:
  --smoke                       Самодиагностика ядра (exit 1 при падениях)
  --serve [--port 8787] [--host 127.0.0.1]   HTTP API
  -h, --help                    Справка
`.trim();

function printSmokeReport(report: SmokeReport): void {
  const lines = [
    `[smoke] engine ${report.engineVersion}: ${report.passed}/${report.total} passed, ` +
      `${report.failed} failed (${report.durationMs.toFixed(1)} ms)`,
  ];
  for (const c of report.cases) {
    lines.push(
      `  ${c.passed ? 'PASS' : 'FAIL'} ${c.id} - ${c.label} ` +
        `(${c.durationMs.toFixed(1)} ms, ${c.objectCount} obj, ${c.strategy ?? 'n/a'})`
    );
    for (const failure of c.failures) lines.push(`       - ${failure}`);
  }
  process.stderr.write(`${lines.join('\n')}\n`);
}

function parsePort(value: string | undefined): number {
  if (value === undefined) return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ValidationError(`Некорректный порт: ${value}`);
  }
  return port;
}

async function runServe(port: number, host: string, assetsDir?: string): Promise<null> {
  const server = await startComposeServer({ port, host, assetsDir });
  process.stderr.write(
    `[api] Compose API (engine ${ENGINE_VERSION}) слушает http://${host}:${port}\n` +
      `[api]   GET  /api/health\n[api]   GET  /api/smoke\n[api]   POST /api/compose\n`
  );
  const shutdown = (signal: string): void => {
    process.stderr.write(`[api] ${signal}: остановка сервера...\n`);
    server.close(() => process.exit(0));
    server.closeAllConnections();
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  return null;
}

/** Возвращает код выхода или null для долгоживущего режима (--serve). */
export async function runCli(argv: string[]): Promise<number | null> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: false,
      strict: true,
      options: {
        prompt: { type: 'string' },
        components: { type: 'string' },
        format: { type: 'string' },
        style: { type: 'string' },
        size: { type: 'string' },
        seed: { type: 'string' },
        palette: { type: 'string' },
        out: { type: 'string' },
        assets: { type: 'string' },
        trace: { type: 'boolean' },
        smoke: { type: 'boolean' },
        serve: { type: 'boolean' },
        port: { type: 'string' },
        host: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (err) {
    process.stderr.write(`Ошибка аргументов: ${errorMessage(err)}\n\n${USAGE}\n`);
    return 2;
  }
  const v = parsed.values;

  if (v.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  try {
    if (v.smoke) {
      const report: SmokeReport = await Promise.resolve(runEngineSmokeSuite());
      printSmokeReport(report);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return report.failed === 0 ? 0 : 1;
    }

    if (v.serve) {
      return await runServe(parsePort(v.port), v.host ?? DEFAULT_HOST, v.assets);
    }

    const outPath = v.out ? path.resolve(process.cwd(), v.out) : undefined;
    const payload: Record<string, unknown> = {
      prompt: v.prompt,
      components: v.components,
      format: v.format,
      styleOverride: v.style,
      size: v.size,
      seed: v.seed,
      paletteId: v.palette,
      includeSvg: outPath !== undefined,
    };
    const result = await executeComposePayload(payload, { assetsDir: v.assets });

    if (outPath && result.svg !== undefined) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, result.svg, 'utf8');
      process.stderr.write(`[compose] SVG записан: ${outPath}\n`);
    }
    if (result.missingAssets) {
      process.stderr.write(`[compose] Нет ассетов (заглушка): ${result.missingAssets.join(', ')}\n`);
    }

    const { trace } = result;
    const output = {
      objects: result.objects,
      ...(v.trace
        ? { trace }
        : {
            summary: {
              traceId: trace.traceId,
              strategy: trace.intent.strategy,
              matchedRuleId: trace.intent.matchedRuleId,
              style: trace.intent.resolvedStyle,
              durationMs: trace.durationMs,
              warnings: trace.warnings,
            },
          }),
      ...(outPath ? { svgPath: outPath } : {}),
      ...(result.missingAssets ? { missingAssets: result.missingAssets } : {}),
    };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`[compose] Ошибка: ${errorMessage(err)}\n`);
    return err instanceof ValidationError ? 2 : 1;
  }
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  return typeof entry === 'string' && /compose-cli\.(?:ts|js|mjs|cjs)$/i.test(entry.replace(/\\/g, '/'));
}

if (isDirectExecution()) {
  runCli(process.argv.slice(2))
    .then((code) => {
      if (code !== null) process.exitCode = code;
    })
    .catch((err: unknown) => {
      process.stderr.write(`[compose] Фатальная ошибка: ${errorMessage(err)}\n`);
      process.exitCode = 1;
    });
}
