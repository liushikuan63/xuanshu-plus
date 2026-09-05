import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { ArtType, CategoryId, RuleHit, ShuPlugin, Timeline } from '@xuanshu/core';
import {
  castLiuyao,
  castMeihua,
  buildBazi,
  castZiwei,
  castXiaoliuren,
  castQimen,
  castLiuRen,
  castJinKou,
  liuyaoPlugin, meihuaPlugin, baziPlugin, ziweiPlugin, xiaoliurenPlugin, qimenPlugin, liurenPlugin, jinkouPlugin,
  registerPlugin, getPlugin, hasPlugin,
  chartRules, artLabel, yongShenRules, timelineForChart, checkKeyWrite, detectPlatform,
  type BoardSpec, type LiuyaoChart, type MeihuaChart, type BaziChart, type ZiweiChart, type XiaoliurenChart, type QimenChart, type LiuRenChart, type JinKouChart,
} from '@xuanshu/core';
import { IntakeWizard, playbookFor, TAXONOMY, categories, checkQuality } from '@xuanshu/intake';
import { LocalCaseStore, LocalFollowupStore, makeCaseRecord, quotaStatus, exportJson, exportCsv, exportMarkdown, parseCaseImport, isIncomingCaseNewer, applyOutcome, calibrate, type OutcomeResult, type WindowFollowup, type WindowVerdict } from '@xuanshu/ledger';
import { DISCLAIMER, timingCandidatesOf } from '@xuanshu/answer';
import type { TimingCandidate } from '@xuanshu/core';
import { Retriever, enrichRuleCitations, type CorpusSection } from '@xuanshu/knowledge/retriever';
import { AI_PROVIDERS, providerById, chatCompletions, buildMessages, parseJudgmentResult, testConnection, webSearch, summarizeSearchResults, type AIConnectionConfig, type JudgmentResult } from '@xuanshu/ai';
import { plainRuleText, plainSummary, baziLifeTrends, baziCurrentYearNote } from '@xuanshu/core';
import { desktopBridge } from './desktopBridge';
import { ReaderView } from './ReaderView';
import { TimelineView } from './TimelineView';
import { FollowupPanel } from './FollowupPanel';

const AlmanacView = lazy(async () => ({ default: (await import('./AlmanacView')).AlmanacView }));
const DestinyToolsView = lazy(async () => ({ default: (await import('./DestinyToolsView')).DestinyToolsView }));

for (const plugin of [liuyaoPlugin, meihuaPlugin, baziPlugin, ziweiPlugin, xiaoliurenPlugin, qimenPlugin, liurenPlugin, jinkouPlugin]) {
  if (!hasPlugin(plugin.id)) registerPlugin(plugin);
}

// 内置知识库：启动即预导入公有领域原典（周易 + 增删卜易 + 卜筮正宗 + 黄金策 + 易冒 + 参考工程语料库采纳：滴天髓/渊海子平/三命通会/神峰通考/大六壬大全/毕法赋/梅花易数/烟波钓叟歌/易传/紫微斗数全书/斗数骨髓赋/太微赋/周易注外编 等 18 部）
// 同步兜底（首屏可用）+ 异步 IndexedDB 快照恢复（二次启动免重建 BM25 索引）
const fallbackKb = new Retriever();

const ARTS = [
  { id: 'liuyao', label: '六爻' },
  { id: 'meihua', label: '梅花易数' },
  { id: 'xiaoliuren', label: '小六壬' },
  { id: 'qimen', label: '奇门遁甲' },
  { id: 'liuren', label: '大六壬' },
  { id: 'jinkou', label: '金口诀' },
  { id: 'bazi', label: '八字' },
  { id: 'ziwei', label: '紫微斗数' },
] as const;
type ArtId = (typeof ARTS)[number]['id'];

type Method = 'random' | 'numbers' | 'manual' | 'time' | 'words';
const METHOD_OPTIONS: Record<ArtId, Array<[Method, string]>> = {
  liuyao: [['random', '摇卦'], ['numbers', '报数'], ['manual', '手动'], ['time', '时间卦']],
  meihua: [['random', '摇卦'], ['numbers', '报数'], ['manual', '手动'], ['time', '时间卦'], ['words', '字占']],
  xiaoliuren: [['time', '时间起课'], ['numbers', '报数起课']],
  qimen: [['time', '时间起局']],
  liuren: [['time', '时间起课']],
  jinkou: [['time', '时间起课'], ['numbers', '报数取地分']],
  bazi: [],
  ziwei: [],
};

const LEVEL_COLOR: Record<string, string> = { A: '#2e7d32', B: '#1565c0', C: '#616161', D: '#e65100', E: '#c62828' };
const LEVEL_LABEL: Record<string, string> = { A: '原典', B: '注疏', C: '现代整理', D: '流派说法', E: 'AI 生成' };
const OUTCOME_OPTIONS: OutcomeResult[] = ['应验', '部分应验', '未应验', '无法判断'];

type AnyChart = LiuyaoChart | MeihuaChart | XiaoliurenChart | BaziChart | ZiweiChart | QimenChart | LiuRenChart | JinKouChart;

const store = new LocalCaseStore();
const followupStore = new LocalFollowupStore();
function ctxAt(date: Date) {
  return { now: date, random: Math.random, tzOffsetHours: 8 };
}

export function App() {
  const platform = useMemo(() => detectPlatform({
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    hasDesktopBridge: typeof window !== 'undefined' && !!window.xuanshuDesktop?.isDesktop,
    hasCapacitor: typeof window !== 'undefined' && 'Capacitor' in window,
    notificationApi: typeof window !== 'undefined' && 'Notification' in window,
  }), []);
  const [art, setArt] = useState<ArtId>('liuyao');
  const [category, setCategory] = useState<string>('失物');
  const [question, setQuestion] = useState('');
  const [freeMode, setFreeMode] = useState(false);
  const [quality, setQuality] = useState<{ warnings: string[]; suggestions: string[] }>({ warnings: [], suggestions: [] });
  const [chart, setChart] = useState<AnyChart | null>(null);
  const [rules, setRules] = useState<RuleHit[]>([]);
  const [timing, setTiming] = useState<TimingCandidate[]>([]);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [board, setBoard] = useState<BoardSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const [cases, setCases] = useState<Awaited<ReturnType<typeof store.list>>>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof store.stats>> | null>(null);
  const [followups, setFollowups] = useState<WindowFollowup[]>([]);
  const [outcomeNotes, setOutcomeNotes] = useState<Record<string, string>>({});
  const [kb, setKb] = useState<Retriever>(fallbackKb);
  const [kbFromCache, setKbFromCache] = useState(false);
  const [kbLoading, setKbLoading] = useState(true);
  const [kbError, setKbError] = useState('');
  const [readerCorpus, setReaderCorpus] = useState<CorpusSection[]>([]);
  const [mode, setMode] = useState<'cast' | 'reader' | 'almanac' | 'destiny'>('cast');

  // 异步从 IndexedDB 恢复知识库快照（命中缓存免重建 BM25 索引；语料版本变化自动重建）
  useEffect(() => {
    let alive = true;
    Promise.all([import('@xuanshu/knowledge/builtin'), import('@xuanshu/knowledge/persist')])
      .then(async ([{ builtinCorpus }, { browserKnowledgeStore, loadBuiltinKnowledge }]) => {
        const corpus = builtinCorpus();
        const result = await loadBuiltinKnowledge(browserKnowledgeStore(), corpus);
        if (!alive) return;
        setReaderCorpus(corpus);
        setKb(result.kb);
        setKbFromCache(result.loadedFromCache);
        setRules((current) => enrichRuleCitations(current, result.kb));
      })
      .catch((error: unknown) => {
        if (alive) setKbError((error as Error).message || '知识库加载失败');
      })
      .finally(() => {
        if (alive) setKbLoading(false);
      });
    return () => { alive = false; };
  }, []);

  // 六爻/梅花 起卦参数
  const [method, setMethod] = useState<Method>('random');
  const [numbers, setNumbers] = useState('1,3,5');
  const [manual, setManual] = useState('787978');
  const [words, setWords] = useState('玄枢');
  // 八字/紫微 出生参数
  const [birth, setBirth] = useState({ year: 2000, month: 8, day: 16, hour: 3, minute: 0 });
  const [gender, setGender] = useState<'male' | 'female'>('male');

  // AI 配置（仅内存，不落盘）
  const [aiCfg, setAiCfg] = useState<AIConnectionConfig>({ providerId: 'deepseek', apiKey: '', model: '', temperature: 0.2 });
  const [aiKeyVisible, setAiKeyVisible] = useState(false);
  const [aiTest, setAiTest] = useState<string>('');
  const [aiResult, setAiResult] = useState<JudgmentResult | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [anonymize, setAnonymize] = useState(true);
  const [keyMsg, setKeyMsg] = useState<string>('');
  // 联网研读（可选增强；键仅内存/安全存储）
  const [searchCfg, setSearchCfg] = useState<{ providerId: 'bing' | 'serper'; apiKey: string }>({ providerId: 'serper', apiKey: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string>('');
  const [searchMsg, setSearchMsg] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);

  const wizard = useMemo(() => new IntakeWizard(), []);
  const playbook = useMemo(() => playbookFor(category), [category]);

  // 启动时加载已持久化的案例本
  useEffect(() => {
    let alive = true;
    store.list().then((list) => {
      if (alive) setCases(list);
    });
    store.stats().then((s) => {
      if (alive) setStats(s);
    });
    followupStore.list().then((list) => {
      if (alive) setFollowups(list);
    });
    return () => { alive = false; };
  }, []);

  // 案例本导出（JSON/CSV/Markdown）
  function download(name: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function exportCases(kind: 'json' | 'csv' | 'md') {
    const list = await store.list();
    if (list.length === 0) {
      alert('案例本为空，无可导出');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'json') download(`xuanshu-cases-${stamp}.xuan-case.json`, exportJson(list), 'application/json');
    else if (kind === 'csv') download(`xuanshu-cases-${stamp}.csv`, exportCsv(list), 'text/csv;charset=utf-8');
    else download(`xuanshu-cases-${stamp}.md`, exportMarkdown(list, { withTextFragment: true }), 'text/markdown');
    setSaved(`已导出 ${list.length} 条（${kind.toUpperCase()}）`);
  }

  async function importCases(file: File) {
    try {
      const text = await file.text();
      const imported = parseCaseImport(text);
      let added = 0;
      let updated = 0;
      let skipped = 0;
      for (const rec of imported.records) {
        const existing = await store.get(rec.caseId);
        if (!existing) {
          await store.add(rec);
          added += 1;
        } else if (isIncomingCaseNewer(rec, existing)) {
          await store.update(rec);
          updated += 1;
        } else {
          skipped += 1;
        }
      }
      skipped += imported.invalidCount;
      setSaved(`导入完成：新增 ${added} 条，更新 ${updated} 条${skipped ? `，跳过 ${skipped} 条（较旧/无效）` : ''}${imported.checksumVerified ? '，checksum 已验证' : '（旧格式无 checksum）'}`);
      refreshData();
    } catch (e) {
      alert(`导入失败：${(e as Error).message}`);
    }
  }

  function refreshData() {
    store.list().then(setCases);
    store.stats().then(setStats);
    followupStore.list().then(setFollowups);
  }

  async function markWindowVerdict(key: string, verdict: WindowVerdict) {
    try {
      await followupStore.setVerdict(key, verdict);
      refreshData();
    } catch (e) {
      alert(`应期回标保存失败：${(e as Error).message}`);
    }
  }

  /** 事后回标应验：写入标注后持久化并刷新复盘统计 */
  async function markOutcome(c: Awaited<ReturnType<typeof store.list>>[number], result: OutcomeResult) {
    try {
      const note = outcomeNotes[c.caseId]?.trim() || undefined;
      await store.update(applyOutcome(c, { result, note, matchedRuleIds: c.result.ruleHits.map((r) => r.ruleId) }));
      refreshData();
      setOutcomeNotes((n) => { const next = { ...n }; delete next[c.caseId]; return next; });
    } catch (e) {
      alert(`回标保存失败：${(e as Error).message}`);
    }
  }

  function pickCategory(c: string) {
    setCategory(c);
    wizard.chooseCategory(c as never);
  }

  function switchArt(a: ArtId) {
    setArt(a);
    setChart(null);
    setRules([]);
    setTiming([]);
    setTimeline(null);
    setBoard(null);
    setAiResult(null);
  }

  function onQuestion(text: string) {
    setQuestion(text);
    const q = checkQuality(text);
    setQuality({ warnings: q.warnings, suggestions: q.suggestions });
  }

  async function cast() {
    setBusy(true);
    setAiResult(null);
    try {
      const now = new Date();
      const ctx = ctxAt(now);
      let c: AnyChart;
      if (art === 'liuyao') {
        let input;
        if (method === 'numbers') input = { kind: 'numbers' as const, numbers: numbers.split(/[,，\s]+/).map(Number).slice(0, 3) };
        else if (method === 'manual') input = { kind: 'manual' as const, text: manual };
        else if (method === 'time') input = { kind: 'time' as const, time: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: now.getMinutes() } };
        else input = { kind: 'random' as const };
        c = await castLiuyao(input, ctx);
      } else if (art === 'meihua') {
        let input;
        if (method === 'numbers') input = { kind: 'numbers' as const, numbers: numbers.split(/[,，\s]+/).map(Number).slice(0, 3) };
        else if (method === 'words') input = { kind: 'words' as const, words };
        else if (method === 'manual') input = { kind: 'manual' as const, text: manual };
        else input = { kind: 'time' as const, time: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: now.getMinutes() } };
        c = await castMeihua(input, ctx);
      } else if (art === 'bazi') {
        c = await buildBazi({ ...birth, gender });
      } else if (art === 'qimen') {
        c = await castQimen({ kind: 'time' as const, time: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: now.getMinutes() } }, ctx);
      } else if (art === 'liuren') {
        c = await castLiuRen({ kind: 'time' as const, time: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: now.getMinutes() } }, ctx);
      } else if (art === 'jinkou') {
        const jinInput = method === 'numbers'
          ? { kind: 'numbers' as const, numbers: numbers.split(/[,，\s]+/).map(Number).filter((n) => Number.isFinite(n)).slice(0, 1) }
          : { kind: 'time' as const, time: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: now.getMinutes() } };
        c = await castJinKou(jinInput as never, ctx);
      } else if (art === 'xiaoliuren') {
        let input;
        if (method === 'numbers') input = { kind: 'numbers' as const, numbers: numbers.split(/[,，\s]+/).map(Number).filter((n) => Number.isFinite(n)).slice(0, 3) };
        else input = { kind: 'time' as const, time: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: now.getMinutes() } };
        c = await castXiaoliuren(input, ctx);
      } else {
        c = await castZiwei({ ...birth, gender: gender === 'male' ? '男' : '女' });
      }
      setChart(c);
      const plugin = getPlugin(art) as ShuPlugin;
      const r = art === 'liuyao' ? [...(await chartRules(c as LiuyaoChart)), ...yongShenRules(c as LiuyaoChart)] : await plugin.rules(c, {});
      setRules(enrichRuleCitations(r, kb));
      setTiming(timingCandidatesOf(art, JSON.parse(JSON.stringify(c)) as Record<string, unknown>, r));
      setTimeline(timelineForChart(art, c));
      setBoard(plugin.board(c, {}));
    } catch (e) {
      alert(`起卦失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveCase() {
    if (!chart) return;
    const rec = makeCaseRecord({
      artType: art,
      question: { category: category as never, summary: question || '未填问句', structured: {} },
      input: {
        raw: { art },
        normalized: (chart as unknown as { normalized?: unknown }).normalized as Record<string, unknown> ?? {},
        config: (chart as unknown as { config?: unknown }).config as Record<string, unknown> ?? {},
        configHash: (chart as unknown as { configHash: string }).configHash,
        engineVersion: '0.1.0',
      },
      result: {
        chart: JSON.parse(JSON.stringify(chart)) as Record<string, unknown>,
        ruleHits: rules.map((x) => ({ ruleId: x.ruleId, text: x.text, confidenceLevel: x.confidenceLevel })),
        warnings: [],
        evidenceRefs: rules.flatMap((x) => x.citations),
        boardHash: (chart as { configHash: string }).configHash,
      },
    });
    try {
      const activeCount = await store.countByArt(art);
      if (quotaStatus(art, activeCount, 0).full) {
        alert(`「${artLabel(art)}」案例本已达到 99 条上限，请先归档或导出备份`);
        return;
      }
      const duplicate = await store.findDuplicate({ configHash: rec.input.configHash, summary: rec.question.summary, createdAt: rec.createdAt });
      if (duplicate) {
        const seeded = timeline ? await followupStore.seed(duplicate.caseId, art, category, timeline.entries) : 0;
        setSaved(`未重复存档：相同盘面与问句已存在（#${duplicate.caseId}）${seeded ? `，已补充 ${seeded} 个应期窗口` : ''}`);
        refreshData();
        return;
      }
      await store.add(rec);
      const seeded = timeline ? await followupStore.seed(rec.caseId, art, category, timeline.entries) : 0;
      setSaved(`已存档 #${rec.caseId}（${chartTitle() ?? ''}）${seeded ? `，已建立 ${seeded} 个应期窗口` : ''}`);
      refreshData();
    } catch (e) {
      alert(`案例保存失败：${(e as Error).message}`);
    }
  }

  function chartTitle(): string | null {
    if (!chart) return null;
    if (art === 'liuyao') return (chart as LiuyaoChart).benName;
    if (art === 'meihua') return (chart as MeihuaChart).benName;
    if (art === 'bazi') {
      const b = chart as BaziChart;
      return `${b.year.gan}${b.year.zhi}年 ${b.month.gan}${b.month.zhi}月 ${b.day.gan}${b.day.zhi}日 ${b.hour.gan}${b.hour.zhi}时`;
    }
    if (art === 'qimen') {
      const c = chart as QimenChart;
      return `${c.term} · ${c.yangDun ? '阳' : '阴'}遁${c.ju}局`;
    }
    if (art === 'liuren') {
      const c = chart as LiuRenChart;
      return `月将${c.monthJiang}加占时${c.shiZhi}`;
    }
    if (art === 'jinkou') {
      const c = chart as JinKouChart;
      return `地分${c.diFen} · 贵神${c.guiShen}`;
    }
    if (art === 'xiaoliuren') {
      const c = chart as XiaoliurenChart;
      return `${c.result.name}（${c.result.short}）`;
    }
    return (chart as ZiweiChart).fiveElementsClass || '紫微命盘';
  }

  function chartSubtitle(): string | null {
    if (!chart) return null;
    if (art === 'liuyao') {
      const c = chart as LiuyaoChart;
      return `${c.bianName ? `之 ${c.bianName} · ` : ''}${c.monthPillar.gan}${c.monthPillar.zhi}月 ${c.dayPillar.gan}${c.dayPillar.zhi}日 · 空${c.xunKong.join('')}`;
    }
    if (art === 'meihua') {
      const c = chart as MeihuaChart;
      return `互卦${c.huName}${c.bianName ? ` · 变卦${c.bianName}` : ''} · 动${c.movingIndex + 1}爻`;
    }
    if (art === 'bazi') {
      const c = chart as BaziChart;
      return `${c.qiyun.direction}行大运 · ${c.qiyun.age}岁起运 · 首步${c.dayun[0] ? c.dayun[0].ganZhi.gan + c.dayun[0].ganZhi.zhi : ''}`;
    }
    if (art === 'qimen') {
      const c = chart as QimenChart;
      const dir = c.palaces.find((x) => x.num === c.hourGanPalace)?.direction ?? '';
      return `时干${c.hourGan}落${dir} · ${c.xunShou}旬 · ${c.valueStar} ${c.valueDoor}`;
    }
    if (art === 'liuren') {
      const c = chart as LiuRenChart;
      return `${c.chuChuanGate}取用神${c.chuChuan} → 三传 ${c.chuChuan}${c.zhongChuan}${c.moChuan} · ${c.isDayGui ? '昼' : '夜'}贵${c.guiRen}`;
    }
    if (art === 'jinkou') {
      const c = chart as JinKouChart;
      return `人元${c.renYuan} · 贵神${c.guiShen} · 月将${c.yueJiang} · 地分${c.diFen}`;
    }
    if (art === 'xiaoliuren') {
      const c = chart as XiaoliurenChart;
      return `${c.lunarText} · 起${c.chu.name} → 中${c.zhong.name} → 末${c.mo.name}`;
    }
    return `命主${(chart as ZiweiChart).soul} · 身主${(chart as ZiweiChart).body}`;
  }

  async function runAi() {
    const bridge = desktopBridge();
    const hasKey = bridge ? await bridge.keychain.has(aiCfg.providerId) : !!aiCfg.apiKey;
    if (!chart || !hasKey || !aiCfg.model) {
      alert('请先填写 API Key 与模型名（AI 设置）');
      return;
    }
    setAiBusy(true);
    setAiResult(null);
    try {
      const ctx = {
        art,
        chartJson: JSON.parse(JSON.stringify(chart)) as Record<string, unknown>,
        configHash: (chart as { configHash: string }).configHash,
        question,
        category,
        ruleHits: rules.map((r) => ({ ruleId: r.ruleId, text: r.text })),
        evidence: rules.flatMap((r) => r.citations).filter((c) => c.charRange).map((c) => ({ quote: c.quote, canonicalId: c.canonicalId, segId: c.segId })),
        anonymize,
      };
      const messages = buildMessages(ctx);
      let content: string;
      if (bridge) {
        // 桌面端：Key 存主进程 safeStorage，请求经主进程代理（Key 不进渲染进程 localStorage）
        const r = await bridge.ai.chat({ providerId: aiCfg.providerId, baseUrl: aiCfg.baseUrl, model: aiCfg.model, messages, temperature: aiCfg.temperature ?? 0.2, responseJson: true });
        if (!r.ok || !r.content) throw new Error(r.error ?? 'AI 代理无响应');
        content = r.content;
      } else {
        content = await chatCompletions(aiCfg, messages, { responseJson: true, temperature: aiCfg.temperature ?? 0.2 });
      }
      const result = parseJudgmentResult(content);
      setAiResult(result);
    } catch (e) {
      alert(`AI 请求失败：${(e as Error).message}`);
    } finally {
      setAiBusy(false);
    }
  }

  async function runTest() {
    const bridge = desktopBridge();
    setAiTest('测试中…');
    try {
      if (bridge) {
        const r = await bridge.ai.test({ providerId: aiCfg.providerId, baseUrl: aiCfg.baseUrl, model: aiCfg.model, messages: [] });
        setAiTest(r.ok ? `连接成功，官方模型 ${(r.models ?? []).length} 个：${(r.models ?? []).slice(0, 6).join('、')}${(r.models ?? []).length > 6 ? '…' : ''}` : `连接失败：${r.error ?? '未知错误'}`);
      } else {
        const r = await testConnection(aiCfg);
        setAiTest(r.ok ? `连接成功，官方模型 ${r.models.length} 个：${r.models.slice(0, 6).join('、')}${r.models.length > 6 ? '…' : ''}` : `连接失败：${r.message}`);
      }
    } catch (e) {
      setAiTest(`连接失败：${(e as Error).message}`);
    }
  }

  async function saveApiKey(key: string): Promise<{ message: string; persisted: boolean }> {
    const bridge = desktopBridge();
    if (platform.kind === 'desktop') {
      const policy = checkKeyWrite(platform, 'safeStorage');
      if (!policy.ok) throw new Error(policy.reason);
      if (!bridge) throw new Error('桌面安全桥不可用，未保存密钥');
      if (!await bridge.keychain.set(aiCfg.providerId, key)) throw new Error('系统安全存储拒绝了写入');
      return { message: '已存入系统安全存储（DPAPI 加密）', persisted: true };
    }
    return {
      message: `${platform.label}仅在本页内存中使用 Key，刷新或退出后需重填`,
      persisted: false,
    };
  }

  /** 联网研读：检索词默认取问句或当前盘面主题；结果仅为资料，需自行核实 */
  async function runSearch() {
    const bridge = desktopBridge();
    const q = searchQuery.trim() || question.trim() || '玄枢 术语 白话 解读';
    setSearchBusy(true);
    setSearchMsg('');
    try {
      let text: string;
      if (bridge?.search?.web) {
        const r = await bridge.search.web({ providerId: searchCfg.providerId, apiKey: searchCfg.apiKey, query: q });
        if (!r.ok) throw new Error(r.error ?? '搜索代理无响应');
        text = summarizeSearchResults(r.results ?? []);
      } else {
        text = summarizeSearchResults(await webSearch(q, searchCfg));
      }
      setSearchResults(text);
      setSearchMsg('已返回结果（联网资料，请自行核实其出处与可靠性，不进入权威证据链）');
    } catch (e) {
      const msg = (e as Error).message;
      setSearchResults('');
      setSearchMsg(msg.includes('Failed to fetch') || msg.includes('fetch')
        ? `${platform.limitation('webSearch', '联网检索')} ${platform.kind === 'desktop' ? '请检查主进程搜索代理。' : '请改用允许跨域访问的 HTTPS 检索服务。'}`
        : msg);
    } finally {
      setSearchBusy(false);
    }
  }

  const quota = chart ? quotaStatus(
    art as ArtType,
    cases.filter((item) => item.artType === art && item.status !== 'archived').length,
    cases.filter((item) => item.artType === art && item.status === 'archived').length,
  ) : null;
  const chartHash = chart ? (chart as { configHash: string }).configHash : '';

  return (
    <div className="app">
      <header className="header">
        <h1>玄枢 · 五术综合占卜工作台</h1>
        <p>排盘确定性 · 解释开放性 · 路径可学习（六爻 / 梅花 / 小六壬 / 奇门 / 大六壬 / 金口诀 / 八字 / 紫微）</p>
        <div className="chips">
          <button className={`chip ${mode === 'cast' ? 'active' : ''}`} onClick={() => setMode('cast')}>占卜工作台</button>
          <button className={`chip ${mode === 'almanac' ? 'active' : ''}`} onClick={() => setMode('almanac')}>万年历</button>
          <button className={`chip ${mode === 'destiny' ? 'active' : ''}`} onClick={() => setMode('destiny')}>命理工具</button>
          <button className={`chip ${mode === 'reader' ? 'active' : ''}`} onClick={() => setMode('reader')}>典籍阅读</button>
        </div>
      </header>

      <main>
        {mode === 'reader' ? (
          kbLoading
            ? <section className="card"><p className="meta">典籍载入中…</p></section>
            : <ReaderView corpus={readerCorpus} />
        ) : mode === 'almanac' ? (
          <Suspense fallback={<section className="card"><p className="meta">万年历载入中…</p></section>}>
            <AlmanacView />
          </Suspense>
        ) : mode === 'destiny' ? (
          <Suspense fallback={<section className="card"><p className="meta">命理工具载入中…</p></section>}>
            <DestinyToolsView />
          </Suspense>
        ) : (<>
        <section className="card">
          <h2>选择术数</h2>
          <div className="chips">
            {ARTS.map((a) => (
              <button key={a.id} className={`chip ${art === a.id ? 'active' : ''}`} onClick={() => switchArt(a.id)}>{a.label}</button>
            ))}
          </div>
          <p className="meta">内置知识库：{kbLoading ? '正在载入' : `${kb.size} 段原文${kbFromCache ? ' · IndexedDB 快照' : ''}`}{kbError ? ` · 载入失败：${kbError}` : ''}；断语引用自动回链原文，未命中显示「请导入书库」</p>
        </section>

        <section className="card">
          <h2>第一步 · 选择事项</h2>
          <label className="check">
            <input type="checkbox" checked={freeMode} onChange={(e) => setFreeMode(e.target.checked)} />
            自由占（不套断事路径，按你自己的方式来）
          </label>
          {freeMode && (
            <div className="hints">
              <div className="tip">怎么用：勾选后不再强制选「事项分类」，可以直接用下方任意方式起卦（时间 / 报数 / 摇卦 / 手动 / 字占…），问句可留空。</div>
              <div className="warn">提醒：写一句问话，方便日后存档回看与应验回标；正式问事，建议仍走事项引导（会提示「怎么问得准」和取用神方向）。</div>
            </div>
          )}
          {!freeMode && (
            <div className="chips">
              {categories().map((c) => (
                <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => pickCategory(c)}>{c}</button>
              ))}
            </div>
          )}
          {!freeMode && playbook && (
            <div className="playbook">
              <b>断事路径 · {playbook.category}</b>
              <ul>
                <li>主用术数：{artLabel(playbook.arts.primary)}（备选：{playbook.arts.alternates.map((a) => `${artLabel(a.art)}·${a.reason}`).join('；')}）</li>
                <li>怎么问：{playbook.howToAsk.goodExamples[0]}</li>
                {playbook.yongShen.length > 0 && <li>取用神：{playbook.yongShen.map((y) => `${y.condition}→${y.yongShen}`).slice(0, 3).join('；')}</li>}
                {playbook.readingList.length > 0 && <li>读哪本书：{playbook.readingList.slice(0, 2).map((r) => `《${r.book}》${r.chapter}`).join('、')}</li>}
              </ul>
            </div>
          )}
        </section>

        <section className="card">
          <h2>第二步 · 问得准（{TAXONOMY[category as CategoryId].guidance}）</h2>
          <input value={question} placeholder="如：我的身份证昨天在地铁站附近丢了，三天内能找回吗" onChange={(e) => onQuestion(e.target.value)} className="question" />
          {(quality.warnings.length > 0 || quality.suggestions.length > 0) && (
            <div className="hints">
              {quality.warnings.map((w) => <div key={w} className="warn">⚠ {w}</div>)}
              {quality.suggestions.map((s) => <div key={s} className="tip">💡 {s}</div>)}
            </div>
          )}
        </section>

        <section className="card">
          <h2>第三步 · 排盘输入（{ARTS.find((a) => a.id === art)?.label}）</h2>
          {(art === 'liuyao' || art === 'meihua' || art === 'xiaoliuren' || art === 'qimen' || art === 'liuren' || art === 'jinkou') && (
            <>
              <div className="chips">
                {METHOD_OPTIONS[art].map(([k, label]) => (
                  <button key={k} className={`chip ${method === k ? 'active' : ''}`} onClick={() => setMethod(k)}>{label}</button>
                ))}
              </div>
              {method === 'numbers' && <input value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder="报数起课，如 1,3,5（月、日、时）" className="question" />}
              {method === 'manual' && <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="6 位爻值（6/7/8/9，初→上），如 787978" className="question" />}
              {method === 'words' && <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="字占：输入汉字" className="question" />}
            </>
          )}
          {(art === 'bazi' || art === 'ziwei') && (
            <div className="birthrow">
              <label className="birth-field"><span>年</span><input type="number" min="1900" max="2100" value={birth.year} onChange={(e) => setBirth({ ...birth, year: +e.target.value })} className="num" /></label>
              <label className="birth-field"><span>月</span><input type="number" min="1" max="12" value={birth.month} onChange={(e) => setBirth({ ...birth, month: +e.target.value })} className="num" /></label>
              <label className="birth-field"><span>日</span><input type="number" min="1" max="31" value={birth.day} onChange={(e) => setBirth({ ...birth, day: +e.target.value })} className="num" /></label>
              <label className="birth-field"><span>时</span><input type="number" min="0" max="23" value={birth.hour} onChange={(e) => setBirth({ ...birth, hour: +e.target.value })} className="num" /></label>
              <label className="birth-field"><span>分</span><input type="number" min="0" max="59" value={birth.minute} onChange={(e) => setBirth({ ...birth, minute: +e.target.value })} className="num" /></label>
              <div className="chips">
                <button className={`chip ${gender === 'male' ? 'active' : ''}`} onClick={() => setGender('male')}>男</button>
                <button className={`chip ${gender === 'female' ? 'active' : ''}`} onClick={() => setGender('female')}>女</button>
              </div>
            </div>
          )}
          <button className="primary" disabled={busy} onClick={cast}>{busy ? '排盘中…' : '排盘'}</button>
        </section>

        {chart && board && (
          <section className="card">
            <h2>盘面：{chartTitle()}{chartSubtitle() ? `（${chartSubtitle()}）` : ''}</h2>
            <BoardRenderer board={board} />
            <p className="meta">configHash {chartHash.slice(0, 12)}…</p>
          </section>
        )}

        {art === 'bazi' && chart && (() => {
          const lf = baziLifeTrends(chart as BaziChart);
          const yr = baziCurrentYearNote(chart as BaziChart, new Date().getFullYear());
          return (
            <section className="card">
              <h2>一生趋势 · 白话总览（流派简化 · 自我参照）</h2>
              <p className="plain-summary">{lf.summary}</p>
              <div className="table">
                {lf.trends.map((t) => (
                  <div key={t.startAge} className="trow">
                    <span className="tlabel">{t.startAge}-{t.startAge + 9}岁</span>
                    <span className="tcontent">{t.ganZhi}（{t.nayin}）· {t.trend}运</span>
                    <span className="tsub">{t.note}</span>
                  </div>
                ))}
              </div>
              {yr && <p className="meta">{yr}</p>}
            </section>
          );
        })()}

        {rules.length > 0 && (
          <section className="card">
            <h2>断语与出处（ruleId 可回溯）</h2>
            <div className="plain-summary">{plainSummary(art, rules)}</div>
            {rules.map((r, i) => (
              <div key={`${r.ruleId}-${i}`} className="rule">
                <span className="sev" data-sev={r.severity}>{r.severity}</span>
                <span>{r.text}</span>
                <span className="rid">{r.ruleId}</span>
                {r.citations.map((c, i) => (
                  <span key={i} className="cite" style={{ borderColor: LEVEL_COLOR[c.confidenceLevel] }}>
                    〔{LEVEL_LABEL[c.confidenceLevel]}·{c.book}·{c.chapter}〕
                    {c.charRange ? <span className="origin">「{c.quote}」</span> : null}
                  </span>
                ))}
                {r.citations.length === 0 && r.severity !== '提示' && <span className="gap">〔此断语暂无内置原典依据，请导入书库〕</span>}
                <div className="plain-note">{plainRuleText(art, r)}</div>
              </div>
            ))}
          </section>
        )}

        {timing.length > 0 && (
          <section className="card">
            <h2>应期参考（D 级流派推法 · 以事后回标校准）</h2>
            {timing.map((c, i) => (
              <div key={`${c.ruleId}-${i}`} className="rule">
                <span className="sev" data-sev="提示">应期</span>
                <span>{c.text}</span>
                <span className="rid">{c.ruleId}</span>
                <span className="cite" style={{ borderColor: LEVEL_COLOR.D }}>〔窗口：{c.window}〕</span>
              </div>
            ))}
          </section>
        )}

        {timeline && <TimelineView timeline={timeline} />}

        <section className="card">
          <h2>联网研读（可选 · 结果仅供资料参考，需自行核实）</h2>
          <details>
            <summary>怎么用 / 注意事项（先看这里）</summary>
            <div className="hints">
              <div className="tip">用它做什么：查某个术语的常见解释、找古籍出处线索、对照白话解读——适合把「断语里看不懂的词」翻译成能理解的参考。</div>
              <div className="tip">三步配置：① 选搜索引擎（Serper 或必应）→ ② 填对应的 API Key → ③ 输入检索词（留空自动用当前问句），点「联网检索」。</div>
              <div className="tip">Key 在哪拿：Serper 去 google.serper.dev 注册即得；必应需 Azure 认知服务的「必应搜索 Web Search API v7」订阅。</div>
              <div className="tip">环境差异：桌面版（Electron）Key 经主进程代理发送、免跨域限制；Web 版直连需服务方允许浏览器 CORS，失败时会明确提示。</div>
              <div className="warn">注意：结果来自公网，只作自学参考，请自行核实出处与可靠性；不会进入断语权威证据链，也不会影响排盘结果。</div>
            </div>
          </details>
          <div className="airow">
            <select value={searchCfg.providerId} onChange={(e) => setSearchCfg({ ...searchCfg, providerId: e.target.value as 'bing' | 'serper' })} className="question">
              <option value="serper">Serper（Google 检索）</option>
              <option value="bing">必应 Web Search API</option>
            </select>
            <input type="password" value={searchCfg.apiKey} onChange={(e) => setSearchCfg({ ...searchCfg, apiKey: e.target.value })} placeholder={platform.kind === 'desktop' ? '检索 API Key（经主进程代理发送）' : `检索 API Key（${platform.label}仅内存）`} className="question" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="检索词（留空则用当前问句）" className="question" />
            <button className="secondary small" disabled={searchBusy} onClick={runSearch}>{searchBusy ? '检索中…' : '联网检索'}</button>
          </div>
          {searchMsg && <p className={searchMsg.includes('核实') ? 'ok' : 'warn'}>{searchMsg}</p>}
          {searchResults && <pre className="search-out">{searchResults}</pre>}
        </section>

        <section className="card">
          <h2>AI 精解（可选 · 需自备大模型 Key）</h2>
          <div className="airow">
            <select value={aiCfg.providerId} onChange={(e) => setAiCfg({ ...aiCfg, providerId: e.target.value, baseUrl: undefined })} className="question">
              {AI_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
            {aiCfg.providerId === 'custom' && <input value={aiCfg.baseUrl ?? ''} onChange={(e) => setAiCfg({ ...aiCfg, baseUrl: e.target.value })} placeholder="自定义 baseUrl，如 http://localhost:11434/v1" className="question" />}
            <input type={aiKeyVisible ? 'text' : 'password'} value={aiCfg.apiKey} onChange={(e) => setAiCfg({ ...aiCfg, apiKey: e.target.value })} placeholder={platform.kind === 'desktop' ? 'API Key（DPAPI 加密落盘，不进 localStorage）' : `API Key（${platform.label}仅保存在内存）`} className="question" />
            <input value={aiCfg.model} onChange={(e) => setAiCfg({ ...aiCfg, model: e.target.value })} placeholder="模型名（如 deepseek-chat / glm-4-flash / qwen-plus）" className="question" />
            <div className="row">
              <button className="primary small" onClick={runTest}>测试连接</button>
              <button className="secondary small" onClick={async () => {
                if (!aiCfg.apiKey) { setKeyMsg('请先输入 API Key'); return; }
                try {
                  const result = await saveApiKey(aiCfg.apiKey);
                  setKeyMsg(result.message);
                  if (result.persisted) setAiCfg({ ...aiCfg, apiKey: '' });
                } catch (e) {
                  setKeyMsg(`保存失败：${(e as Error).message}`);
                }
              }}>{platform.kind === 'desktop' ? '安全保存 Key' : '仅在本页使用'}</button>
              <label className="check"><input type="checkbox" checked={aiKeyVisible} onChange={(e) => setAiKeyVisible(e.target.checked)} /> 显示 Key</label>
              <label className="check"><input type="checkbox" checked={anonymize} onChange={(e) => setAnonymize(e.target.checked)} /> 匿名化盘面</label>
              <button className="primary small" disabled={aiBusy || !chart} onClick={runAi}>{aiBusy ? 'AI 分析中…' : 'AI 精解当前盘面'}</button>
            </div>
            {keyMsg && <p className="ok">{keyMsg}</p>}
            {aiTest && <p className="meta">{aiTest}</p>}
          </div>
          {aiResult && (
            <div className="airesult">
              {aiResult.degraded && <p className="warn">⚠ 模型未按契约返回 JSON，以下为原文摘录（需人工解读）：</p>}
              {aiResult.cards.map((c) => (
                <div key={c.claimId} className="rule">
                  <span className="sev" data-sev="变数">{c.type}</span>
                  <span>{c.text}</span>
                  <span className="rid">{c.claimId}</span>
                  <span className="cite" style={{ borderColor: LEVEL_COLOR.E }}>〔AI 生成 · 需核实〕</span>
                </div>
              ))}
              {aiResult.unsupportedClaims.length > 0 && (
                <details>
                  <summary>证据缺口（{aiResult.unsupportedClaims.length} 条）</summary>
                  <ul className="cases">{aiResult.unsupportedClaims.map((u, i) => <li key={i}>{u}</li>)}</ul>
                </details>
              )}
            </div>
          )}
          <p className="meta">隐私提示：{platform.kind === 'desktop' ? '桌面版 Key 经 DPAPI 加密后保存在当前系统用户目录，明文不进入 localStorage；' : `${platform.label} Key 仅存于本页内存，不写入浏览器存储；`}请求将发送至所选厂商，厂商按自身政策处理；请勿输入姓名/出生地等敏感信息（可开启匿名化）。</p>
        </section>

        {chart && (
          <section className="card">
            <h2>记录与标注{quota?.softReached ? <span className="warn-inline">（已用 {quota.active} 条，建议导出备份）</span> : null}</h2>
            <div className="row">
              <button className="primary" disabled={quota?.full} onClick={saveCase}>{quota?.full ? '本术案例已满' : '存档到案例本'}</button>
              <button className="secondary" onClick={() => exportCases('json')}>导出 JSON</button>
              <button className="secondary" onClick={() => exportCases('csv')}>导出 CSV</button>
              <button className="secondary" onClick={() => exportCases('md')}>导出 Markdown</button>
              <label className="secondary file-label">
                导入案例
                <input type="file" accept=".json,.xuan-case.json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void importCases(f); e.target.value = ''; }} />
              </label>
            </div>
            {saved && <p className="ok">{saved}</p>}
            {cases.length > 0 && (
              <details>
                <summary>已存 {cases.length} 条（本地持久化，点击展开后可为每条回标应验结果）</summary>
                <ul className="cases">
                  {cases.map((c) => {
                    const title = c.annotation.outcome && <span className="ok"> · 已回标：{c.annotation.outcome.result}</span>;
                    return (
                      <li key={c.caseId}>
                        <div>[{artLabel(c.artType)}] {c.question.summary} → {(c.result.chart as { benName?: string; name?: string; year?: unknown }).benName ?? (c.result.chart as { name?: string }).name ?? ''}（{c.createdAt.slice(0, 16)}）{title}</div>
                        <div className="row">
                          {OUTCOME_OPTIONS.map((o) => <button key={o} className="secondary small" onClick={() => markOutcome(c, o)}>{o}</button>)}
                          <input value={outcomeNotes[c.caseId] ?? ''} onChange={(e) => setOutcomeNotes({ ...outcomeNotes, [c.caseId]: e.target.value })} placeholder="备注（如：三天内在车站找回）" className="crossfill" />
                        </div>
                        {c.annotation.outcome?.note && <div className="meta">回标备注：{c.annotation.outcome.note}（{c.annotation.outcome.at.slice(0, 16)}）</div>}
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </section>
        )}

        <FollowupPanel rows={followups} onVerdict={(key, verdict) => void markWindowVerdict(key, verdict)} />

        <section className="card">
          <h2>个人复盘与校准（仅校准你的解释习惯，永不回写排盘）</h2>
          {!stats || cases.length === 0 ? (
            <p className="meta">存档几条案例并回标应验后，这里会给出按术数/事项的应验率提示。</p>
          ) : (
            <>
              {calibrate(cases, stats).map((i) => (
                <div key={`${i.dimension}.${i.key}`} className="rule">
                  <span className="sev" data-sev="变数">{i.dimension === 'art' ? '术数' : '事项'}</span>
                  <span>{i.message}</span>
                </div>
              ))}
              {cases.filter((c) => !c.annotation.outcome).length > 0 && (
                <p className="meta">待回标 {cases.filter((c) => !c.annotation.outcome).length} 条（回标后才能计入应验率）。</p>
              )}
            </>
          )}
        </section>
        </>)}
      </main>

      <footer className="disclaimer">{DISCLAIMER}</footer>
    </div>
  );
}

function BoardRenderer({ board }: { board: BoardSpec }) {
  return (
    <div className="board">
      {board.panels.map((panel) => (
        <div key={panel.title} className="panel">
          <div className="panel-title">{panel.title}</div>
          {panel.layout === 'grid' ? (
            <div className={`grid${panel.cells.length === 9 ? ' grid-nine' : panel.cells.length >= 12 ? ' grid-twelve' : ''}`}>
              {panel.cells.map((cell) => (
                <div key={cell.key} className="cell">
                  <div className="cell-label">{cell.label}</div>
                  <div className="cell-content">{cell.content}</div>
                  {cell.sub && <div className="cell-sub">{cell.sub}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="table">
              {panel.cells.map((cell) => (
                <div key={cell.key} className="trow">
                  <span className="tlabel">{cell.label}</span>
                  <span className="tcontent">{cell.content}</span>
                  {cell.sub && <span className="tsub">{cell.sub}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
