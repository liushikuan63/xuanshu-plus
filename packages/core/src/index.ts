/**
 * @xuanshu/core 入口
 * 玄枢核心：历法内核 + 插件框架 + 术数引擎（纯 TS）
 */

// 天文
export * from './astronomy/jde.js';
export * from './astronomy/solarLongitude.js';
export * from './astronomy/equationOfTime.js';

// 历法
export * from './calendar/ganzhi.js';
export * from './calendar/solarTerms.js';
export * from './calendar/lunar.js';
export * from './calendar/solarTime.js';
export * from './calendar/calibrate.js';
export * from './calendar/monthPillar.js';

// 契约与盘面
export * from './types.js';
export * from './plugins/contract.js';
export * from './plugins/registry.js';
export * from './board/schema.js';
export * from './artLabels.js';
export * from './timing.js';

// 术数引擎
export * from './arts/liuyao/trigrams.js';
export * from './arts/liuyao/hexagramTexts.js';
export * from './arts/liuyao/engine.js';
export * from './arts/liuyao/rules.js';
export * from './arts/liuyao/yongshen.js';
export * from './arts/i18n/plain.js';
export * from './arts/liuyao/plugin.js';
export * from './arts/bazi/engine.js';
export * from './arts/bazi/lifetrend.js';
export * from './arts/bazi/plugin.js';
export * from './arts/meihua/engine.js';
export * from './arts/meihua/plugin.js';
export * from './arts/xiaoliuren/engine.js';
export * from './arts/xiaoliuren/plugin.js';
export * from './arts/qimen/engine.js';
export * from './arts/qimen/plugin.js';
export * from './arts/liuren/engine.js';
export * from './arts/liuren/plugin.js';
export * from './arts/jinkou/engine.js';
export * from './arts/jinkou/plugin.js';
export * from './arts/ziwei/adapter.js';
export * from './arts/ziwei/plugin.js';

// 预加载引擎（可选）
import { preloadSolarEngine } from './calendar/solarTerms.js';
export async function preloadEngines(): Promise<void> {
  await preloadSolarEngine();
}
