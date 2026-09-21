// ============================================================================
// Card Editor Express Server — API 集成测试（使用 Node 原生 http，无额外依赖）
// ============================================================================

import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { createApp } from '../../editor/server';

interface HttpResult {
  status: number;
  body: any;
}

function request(port: number, method: string, urlPath: string, body?: unknown): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed: any = raw;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            /* 保留原文 */
          }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const VALID_CHARACTER = {
  cardId: 'HTR-1-001',
  cardName: 'Test Recruit',
  cardType: 'Character',
  sourceMaterial: 'HTR',
  affinities: ['Hunter'],
  requiredEnergy: { color: '白', amount: 1 },
  apCost: 1,
  bp: { base: 3000 },
  energyGeneration: [{ color: '白', amount: 1 }],
  abilities: [],
  keywords: [],
};

let server: http.Server;
let port: number;
let customDir: string;
let testSetDir: string;

beforeAll(async () => {
  customDir = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-custom-'));
  testSetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-testset-'));
  // 种子：test_set 中放一张卡（模拟只读参考数据）
  fs.writeFileSync(path.join(testSetDir, 'HTR-1-001.json'), JSON.stringify(VALID_CHARACTER, null, 2));

  const app = createApp({ customDir, testSetDir });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  port = (server.address() as { port: number }).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(customDir, { recursive: true, force: true });
  fs.rmSync(testSetDir, { recursive: true, force: true });
});

describe('GET /api/schema', () => {
  test('返回成功，包含 4 种卡牌类型与必要字段', async () => {
    const { status, body } = await request(port, 'GET', '/api/schema');
    expect(status).toBe(200);
    expect(body.cardTypes).toEqual(['Character', 'Site', 'Event', 'AP']);
    expect(Array.isArray(body.energyColors)).toBe(true);
    expect(Array.isArray(body.fields)).toBe(true);

    const keys = body.fields.map((f: any) => f.fieldKey);
    expect(keys).toContain('cardId');
    expect(keys).toContain('cardName');
    expect(keys).toContain('cardType');
    expect(keys).toContain('bp.base');
    expect(keys).toContain('energyGeneration');
  });

  test('AP 类型不含 bp / abilities 字段', async () => {
    const { body } = await request(port, 'GET', '/api/schema');
    const apFields = body.fields.filter((f: any) => f.cardTypes.includes('AP')).map((f: any) => f.fieldKey);
    expect(apFields).not.toContain('bp.base');
    expect(apFields).not.toContain('abilities');
    expect(apFields).toContain('cardId');
    expect(apFields).toContain('cardName');
  });
});

describe('GET /api/keywords', () => {
  test('返回关键词数据', async () => {
    const { status, body } = await request(port, 'GET', '/api/keywords');
    expect(status).toBe(200);
    expect(Array.isArray(body.keywords)).toBe(true);
    const names = body.keywords.map((k: any) => k.name);
    expect(names).toContain('Snipe');
    expect(names).toContain('Impact 1');
  });
});

describe('POST /api/validate', () => {
  test('合法 CardData 返回 valid=true', async () => {
    const { status, body } = await request(port, 'POST', '/api/validate', VALID_CHARACTER);
    expect(status).toBe(200);
    expect(body).toEqual({ valid: true, errors: [] });
  });

  test('非法 CardData 返回 valid=false 和 errors', async () => {
    const invalid = { ...VALID_CHARACTER, cardName: '', sourceMaterial: '', bp: undefined };
    const { status, body } = await request(port, 'POST', '/api/validate', invalid);
    expect(status).toBe(200);
    expect(body.valid).toBe(false);
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);
  });
});

describe('POST /api/preview', () => {
  test('调用实际 CardSystem.expandKeywords()（Snipe 展开）', async () => {
    const snipeCard = { ...VALID_CHARACTER, keywords: ['Snipe'] };
    const { status, body } = await request(port, 'POST', '/api/preview', snipeCard);
    expect(status).toBe(200);
    expect(Array.isArray(body.abilities)).toBe(true);
    const effects = body.abilities.flatMap((a: any) => a.effects.map((e: any) => e.effectType));
    expect(effects).toContain('AllowTargetCharacter');
    expect(effects).toContain('PreventBlock');
  });
});

describe('GET /api/cards', () => {
  test('能发现 custom 与 test_set 中的卡', async () => {
    await request(port, 'POST', '/api/cards', { ...VALID_CHARACTER, cardId: 'CUSTOM-1' });
    const { status, body } = await request(port, 'GET', '/api/cards');
    expect(status).toBe(200);
    const ids = body.cards.map((c: any) => c.cardId);
    expect(ids).toContain('HTR-1-001'); // test_set
    expect(ids).toContain('CUSTOM-1'); // custom
  });
});

describe('POST /api/cards', () => {
  test('合法卡保存到 custom/', async () => {
    const { status, body } = await request(port, 'POST', '/api/cards', { ...VALID_CHARACTER, cardId: 'CUSTOM-2' });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(fs.existsSync(path.join(customDir, 'CUSTOM-2.json'))).toBe(true);
  });

  test('不允许覆盖 test_set/', async () => {
    const card = { ...VALID_CHARACTER, cardId: 'HTR-1-001', cardName: 'Overwrite Attempt' };
    const { status, body } = await request(port, 'POST', '/api/cards', card);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    // 写入了 custom/，而非 test_set/
    expect(fs.existsSync(path.join(customDir, 'HTR-1-001.json'))).toBe(true);
    const testSetOnDisk = JSON.parse(fs.readFileSync(path.join(testSetDir, 'HTR-1-001.json'), 'utf-8'));
    expect(testSetOnDisk.cardName).toBe('Test Recruit');
  });

  test('非法卡返回 400 且不写文件', async () => {
    const invalid = { ...VALID_CHARACTER, cardId: 'INVALID-1', cardName: '' };
    const { status } = await request(port, 'POST', '/api/cards', invalid);
    expect(status).toBe(400);
    expect(fs.existsSync(path.join(customDir, 'INVALID-1.json'))).toBe(false);
  });

  test('拒绝路径穿越 cardId', async () => {
    const { status } = await request(port, 'POST', '/api/cards', { ...VALID_CHARACTER, cardId: '../evil' });
    expect(status).toBe(400);
  });
});

describe('PUT /api/cards/:id', () => {
  test('可以更新 custom 卡', async () => {
    await request(port, 'POST', '/api/cards', { ...VALID_CHARACTER, cardId: 'CUSTOM-3', cardName: 'Before' });
    const updated = { ...VALID_CHARACTER, cardId: 'CUSTOM-3', cardName: 'After', bp: { base: 4000 } };
    const { status, body } = await request(port, 'PUT', '/api/cards/CUSTOM-3', updated);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const onDisk = JSON.parse(fs.readFileSync(path.join(customDir, 'CUSTOM-3.json'), 'utf-8'));
    expect(onDisk.cardName).toBe('After');
    expect(onDisk.bp.base).toBe(4000);
  });
});
