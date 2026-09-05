import { describe, expect, it } from 'vitest';
import { AI_PROVIDERS, providerById, chatEndpoint, resolveBaseUrl } from './providerRegistry.js';
import { buildMessages, buildUserPrompt, SYSTEM_PROMPT, JUDGMENT_CARD_SCHEMA } from './prompt.js';
import { parseJudgmentResult, chatCompletions } from './client.js';
import { makeAuditEntry } from './audit.js';

describe('ProviderRegistry', () => {
  it('内置 7 家厂商 + 自定义', () => {
    expect(AI_PROVIDERS.length).toBe(7);
    expect(providerById('deepseek').baseUrlTemplate).toContain('api.deepseek.com');
  });

  it('chatEndpoint 拼接', () => {
    expect(chatEndpoint({ providerId: 'deepseek', apiKey: 'k', model: 'deepseek-chat' })).toBe('https://api.deepseek.com/chat/completions');
    expect(chatEndpoint({ providerId: 'custom', baseUrl: 'http://localhost:11434/v1/', apiKey: 'k', model: 'qwen2.5' })).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('内置厂商忽略任意地址覆盖，自定义地址仅接受安全的 HTTP(S) URL', () => {
    expect(resolveBaseUrl({ providerId: 'deepseek', baseUrl: 'https://evil.example/v1', apiKey: 'k', model: 'm' })).toBe('https://api.deepseek.com');
    expect(() => resolveBaseUrl({ providerId: 'custom', baseUrl: 'file:///tmp/model', apiKey: 'k', model: 'm' })).toThrow('http 或 https');
    expect(() => resolveBaseUrl({ providerId: 'custom', baseUrl: 'https://user:pass@example.test/v1', apiKey: 'k', model: 'm' })).toThrow('用户名或密码');
  });

  it('未知 provider 抛错', () => {
    expect(() => providerById('nope')).toThrow();
  });
});

describe('提示工程', () => {
  it('系统提示禁止自行推算', () => {
    expect(SYSTEM_PROMPT).toContain('绝不自行推算');
    expect(SYSTEM_PROMPT).toContain('逐字复制');
  });

  it('用户提示包含盘面 JSON 与输出契约', () => {
    const msgs = buildMessages({
      art: 'liuyao',
      chartJson: { benName: '乾为天' },
      configHash: 'cfg_x',
      question: '钱包丢了',
      category: '失物',
      ruleHits: [{ ruleId: 'liuyao.xunkong', text: '财爻旬空' }],
      evidence: [],
    });
    const user = msgs[1]!.content;
    expect(user).toContain('乾为天');
    expect(user).toContain('liuyao.xunkong');
    expect(user).toContain('检索片段：无');
    expect(user).toContain('cards');
  });

  it('匿名化开关', () => {
    const user = buildUserPrompt({ art: 'bazi', chartJson: {}, configHash: 'c', ruleHits: [], evidence: [], anonymize: true });
    expect(user).toContain('匿名化：已开启');
  });
});

describe('判断卡解析', () => {
  const good = JSON.stringify({
    cards: [{ claimId: 'c1', type: '用神', text: '财爻旺相', evidenceIds: ['e1'], confidence: 0.8 }],
    unsupportedClaims: [],
    coverageScore: 0.9,
  });

  it('直接 JSON 解析', () => {
    const r = parseJudgmentResult(good);
    expect(r.degraded).toBe(false);
    expect(r.cards[0]!.confidenceLevel).toBe('E');
    expect(r.cards[0]!.needsHumanReview).toBe(true);
  });

  it('代码块包裹解析', () => {
    const r = parseJudgmentResult(`好的，以下是结果：\n\`\`\`json\n${good}\n\`\`\``);
    expect(r.degraded).toBe(false);
    expect(r.cards.length).toBe(1);
  });

  it('不可信文本降级为摘录', () => {
    const r = parseJudgmentResult('抱歉，我无法完成这个请求。');
    expect(r.degraded).toBe(true);
    expect(r.cards.length).toBe(0);
    expect(r.unsupportedClaims.length).toBeGreaterThan(0);
  });

  it('结构异常的判断卡被丢弃，不把模型字段直接交给 UI', () => {
    const r = parseJudgmentResult(JSON.stringify({ cards: [null, { claimId: 'x' }], unsupportedClaims: 'not-array', coverageScore: 8 }));
    expect(r.degraded).toBe(true);
    expect(r.cards).toEqual([]);
    expect(r.unsupportedClaims[0]).toContain('2 张判断卡结构无效');
    expect(r.coverageScore).toBe(1);
  });
});

describe('客户端', () => {
  it('调用 /chat/completions 并取 content', async () => {
    const fakeFetch: typeof fetch = async (url, init) => {
      expect(String(url)).toBe('https://api.deepseek.com/chat/completions');
      expect(JSON.parse(String(init?.body)).model).toBe('deepseek-chat');
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"cards":[]}' } }] }), { status: 200 });
    };
    const text = await chatCompletions({ providerId: 'deepseek', apiKey: 'k', model: 'deepseek-chat' }, [{ role: 'user', content: 'hi' }], {}, fakeFetch);
    expect(text).toBe('{"cards":[]}');
  });

  it('HTTP 错误抛错', async () => {
    const fakeFetch: typeof fetch = async () => new Response('bad key', { status: 401 });
    await expect(chatCompletions({ providerId: 'deepseek', apiKey: 'k', model: 'm' }, [{ role: 'user', content: 'hi' }], {}, fakeFetch)).rejects.toThrow();
  });
});

describe('审计', () => {
  it('审计条目含时间与 schemaVersion', () => {
    const e = makeAuditEntry({ providerId: 'deepseek', model: 'm', inputHash: 'a', outputHash: 'b', latencyMs: 100 });
    expect(e.schemaVersion).toBe(1);
    expect(e.time).toBeTruthy();
  });
});
