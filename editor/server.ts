// ============================================================================
// Union Arena Digital — Card Editor: Express Server (Batch 7.2)
// ============================================================================
// 卡牌编辑器 Web/API 层：静态托管 + REST API。
// 规则逻辑只通过 CardEditorEngine → CardSystem，本文件不实现任何卡牌规则。
// 浏览器端只做展示/输入/调用本 API，不复制规则逻辑。
// ============================================================================

import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { CardData, CardType } from '../src/core/types';
import { CardSystem } from '../src/systems/CardSystem';
import { CardEditorEngine, DEFAULT_CUSTOM_DIR } from './CardEditorEngine';
import { CARD_FIELDS, CARD_TYPES, ENERGY_COLORS } from './CardSchema';

const TEST_SET_DIR = path.resolve(__dirname, '..', 'src', 'data', 'cards', 'test_set');
const KEYWORDS_FILE = path.resolve(__dirname, '..', 'src', 'data', 'keywords', 'keyword_definitions.json');
const PUBLIC_DIR = path.resolve(__dirname, 'public');

export interface ServerOptions {
  customDir?: string;
  testSetDir?: string;
  keywordsFile?: string;
  publicDir?: string;
}

interface CardMeta {
  cardId: string;
  cardName: string;
  cardType: string;
  source: string;
}

/** 只允许用作安全文件名的 cardId（禁止路径分隔符与 ..，防止路径穿越逃出 custom/）。 */
function isSafeCardId(cardId: unknown): cardId is string {
  if (typeof cardId !== 'string' || cardId.length === 0) return false;
  if (cardId.includes('/') || cardId.includes('\\') || cardId.includes('..')) return false;
  return true;
}

function listCardsInDir(dir: string, source: string): CardMeta[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f): CardMeta | null => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
        return {
          cardId: String(raw.cardId ?? ''),
          cardName: String(raw.cardName ?? ''),
          cardType: String(raw.cardType ?? ''),
          source,
        };
      } catch {
        return null;
      }
    })
    .filter((c): c is CardMeta => c !== null);
}

function findCardFile(cardId: string, dirs: string[]): string | null {
  for (const dir of dirs) {
    const p = path.join(dir, `${cardId}.json`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function createApp(options: ServerOptions = {}): express.Express {
  const customDir = options.customDir ?? DEFAULT_CUSTOM_DIR;
  const testSetDir = options.testSetDir ?? TEST_SET_DIR;
  const keywordsFile = options.keywordsFile ?? KEYWORDS_FILE;
  const publicDir = options.publicDir ?? PUBLIC_DIR;

  const engine = new CardEditorEngine(CardSystem.loadKeywordDefinitions(keywordsFile));

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(publicDir));

  // 字段元数据（供前端渲染表单，单一数据源 = CardSchema）
  app.get('/api/schema', (_req, res) => {
    res.json({ cardTypes: CARD_TYPES, energyColors: ENERGY_COLORS, fields: CARD_FIELDS });
  });

  // 空白模板（单一数据源 = CardSchema.createTemplateCard）
  app.get('/api/template', (req, res) => {
    const cardType = req.query.cardType as string | undefined;
    if (!cardType || !CARD_TYPES.includes(cardType as CardType)) {
      return res.status(400).json({ ok: false, errors: ['cardType must be one of Character/Site/Event/AP'] });
    }
    const state = engine.createTemplate(cardType as CardType);
    res.json(engine.exportCard(state));
  });

  // 关键词列表（名称 + 描述）
  app.get('/api/keywords', (_req, res) => {
    const raw = JSON.parse(fs.readFileSync(keywordsFile, 'utf-8')) as Record<string, { description?: string }>;
    const keywords = Object.entries(raw)
      .map(([name, data]) => ({ name, description: data?.description ?? '' }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ keywords });
  });

  // 列出所有卡牌（custom + test_set）
  app.get('/api/cards', (_req, res) => {
    const cards = [...listCardsInDir(customDir, 'custom'), ...listCardsInDir(testSetDir, 'test_set')].sort((a, b) =>
      a.cardId.localeCompare(b.cardId)
    );
    res.json({ cards });
  });

  // 读取单张卡牌
  app.get('/api/cards/:id', (req, res) => {
    const cardId = req.params.id;
    if (!isSafeCardId(cardId)) {
      return res.status(400).json({ ok: false, errors: ['Invalid cardId'] });
    }
    const filePath = findCardFile(cardId, [customDir, testSetDir]);
    if (!filePath) {
      return res.status(404).json({ ok: false, errors: [`Card not found: ${cardId}`] });
    }
    res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
  });

  // 校验（复用 CardSystem.validateCard）
  app.post('/api/validate', (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ valid: false, errors: ['Request body must be a card object'] });
    }
    const state = engine.importCard(body as CardData);
    res.json(engine.validate(state));
  });

  // 预览关键词展开（复用 CardSystem.expandKeywords）
  app.post('/api/preview', (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ errors: ['Request body must be a card object'] });
    }
    const state = engine.importCard(body as CardData);
    res.json(engine.previewExpansion(state));
  });

  // 保存（仅写入 custom/，前端无法指定路径；cardId 经安全校验）
  const saveCard = (req: express.Request, res: express.Response): void => {
    const cardId = req.params.id ?? (req.body && typeof req.body === 'object' ? req.body.cardId : undefined);
    if (!isSafeCardId(cardId)) {
      res.status(400).json({ ok: false, errors: ['Invalid cardId (must not contain path separators or "..")'] });
      return;
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ ok: false, errors: ['Request body must be a card object'] });
      return;
    }
    try {
      const card = { ...(body as CardData), cardId };
      const state = engine.importCard(card);
      const targetPath = path.join(customDir, `${cardId}.json`);
      const saved = engine.saveToFile(state, targetPath);
      res.json({ ok: true, path: saved.sourceFile });
    } catch (e) {
      res.status(400).json({ ok: false, errors: [(e as Error).message] });
    }
  };

  app.post('/api/cards', saveCard);
  app.put('/api/cards/:id', saveCard);

  // 统一 JSON 错误处理（例如无效 JSON body）
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ ok: false, errors: [err instanceof Error ? err.message : 'Bad request'] });
  });

  return app;
}

// 直接运行时启动；被测试 import 时（require.main !== module）不启动。
if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const app = createApp();
  app.listen(port, () => {
    console.log(`Union Arena Card Editor running at http://localhost:${port}`);
  });
}
