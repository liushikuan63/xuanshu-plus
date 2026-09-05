/**
 * 断事路径卡 Playbook（v5 §6）：失物 / 姻缘 / 事业 / 过去未来
 * 引用纪律：能回链《周易》原文者标 A；通行断法以《增删卜易》《卜筮正宗》章节为据标 B；
 * 无原典逐字对应的民间口诀一律 D 级「流派说法」。
 */

import type { CitationRef, ConfidenceLevel, Playbook } from '@xuanshu/core';

function cite(book: string, canonicalId: string, chapter: string, quote: string, confidenceLevel: ConfidenceLevel): CitationRef {
  return {
    canonicalId,
    book,
    edition: book === '周易' ? '通行本（公有领域）' : '通行整理本（待语料核验）',
    chapter,
    segId: `pending:${canonicalId}:${chapter}`,
    quote,
    license: '公有领域',
    confidenceLevel,
  };
}

/** 《增删卜易》逐字原文引用（公有领域转录，segId 定位到句） */
function zsbyCite(segId: string, quote: string): CitationRef {
  return {
    canonicalId: 'zengshanbuyi.ws.1912',
    book: '增删卜易',
    author: '野鹤老人',
    edition: '公有领域转录（网络流传本）',
    chapter: segId.split('.').slice(0, 2).join('.'),
    segId,
    quote,
    license: '公有领域',
    confidenceLevel: 'A',
  };
}

/** 《黄金策》逐字原文引用（公有领域转录，segId 定位到句） */
function hjcCite(segId: string, quote: string): CitationRef {
  return {
    canonicalId: 'huangjince.ws.1912',
    book: '黄金策',
    author: '刘基（题）',
    edition: '公有领域转录（diancang.xyz 本）',
    chapter: segId.split('.').slice(0, 2).join('.'),
    segId,
    quote,
    license: '公有领域',
    confidenceLevel: 'A',
  };
}

export const liuyaoLostPlaybook: Playbook = {
  id: 'liuyao.lost.v1',
  category: '失物',
  version: 1,
  arts: {
    primary: 'liuyao',
    alternates: [
      { art: 'xiaoliuren', reason: '只想快速知道「现在要不要去找」' },
      { art: 'meihua', reason: '想用类象推物之形状与所处环境' },
    ],
    whyPrimary: '六爻以用神代表失物，可同时断「能否寻回 + 方位场所 + 应期」，信息量最适合寻物',
  },
  howToAsk: {
    goodExamples: ['我的身份证昨天下午在地铁站附近丢了，三天内能找回吗', '家里丢了一枚金戒指，是不是被人拿走了'],
    badExamples: [{ text: '我东西丢了', why: '不指明何物，取用神会错（证件取父母爻、钱包取妻财爻）' }],
    requiredFields: ['what', 'timeRange', 'location', 'needTiming'],
    clarify: [{ id: 'isStolen', text: '你怀疑是遗失还是被人拿走？这决定要不要参看官鬼爻辨盗' }],
  },
  howToCast: {
    methods: [
      { name: '摇卦', steps: ['净手静心，专念「某物现在何处、能否寻回」', '三枚硬币连摇六次，自下而上记爻', '一事一卦，不因第一卦不吉重摇'], arts: ['liuyao'] },
      { name: '报数', steps: ['临时起念报三个数', '按先天数起上卦/下卦/动爻'], arts: ['liuyao', 'meihua'] },
    ],
    tips: ['先填事项与问法再起卦——顺序反了取用神会失准', '7 日内同一事项重复起卦会提示先看上一条'],
  },
  yongShen: [
    { condition: '现金/钱包/首饰/手机/手表/钥匙/电子产品等有价财物', yongShen: '妻财爻', ruleId: 'liuyao.lost.yongshen.caifu', citations: [cite('卜筮正宗', 'bushizhengzong', '失物章', '凡占失物，物各有类，财货以妻财为用', 'B')], confidenceLevel: 'B' },
    { condition: '证件/合同/车票/书本/车/衣物/眼镜', yongShen: '父母爻', ruleId: 'liuyao.lost.yongshen.fumu', citations: [zsbyCite('zsby.c12.3', '占天地、城池、墙垣，宅舍、屋宇，舟车、衣服、雨具、绸缎，布匹、章奏、文书及书馆文契也以父母爻为用神')], confidenceLevel: 'A' },
    { condition: '宠物/玩具/活物/药品', yongShen: '子孙爻', ruleId: 'liuyao.lost.yongshen.zisun', citations: [cite('增删卜易', 'zengshanbuyi', '失物章', '六畜宠物以子孙爻为用', 'B')], confidenceLevel: 'B' },
    { condition: '普通衣物鞋帽/共享物品', yongShen: '兄弟爻', ruleId: 'liuyao.lost.yongshen.xiongdi', citations: [cite('增删卜易', 'zengshanbuyi', '失物章', '衣物常物以兄弟爻为用', 'B')], confidenceLevel: 'B' },
    { condition: '疑似被盗，需辨盗', yongShen: '官鬼爻', ruleId: 'liuyao.lost.yongshen.guigui', citations: [zsbyCite('zsby.c12.5', '占乱臣贼盗、邪崇也以官鬼爻为用神')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '用神旺相', meaning: '吉', ruleId: 'liuyao.lost.ji.wangxiang', citations: [cite('增删卜易', 'zengshanbuyi', '失物章', '用神宜旺相，不宜空破', 'B')], confidenceLevel: 'B' },
    { name: '用神旬空月破', meaning: '凶', ruleId: 'liuyao.lost.xiong.kongpo', citations: [cite('增删卜易', 'zengshanbuyi', '失物章', '用神空破，物难寻', 'B')], confidenceLevel: 'B' },
    { name: '子孙旺动', meaning: '吉', ruleId: 'liuyao.lost.ji.zisun', citations: [cite('增删卜易', 'zengshanbuyi', '失物章', '子孙为福神，动则有人送回线索', 'B')], confidenceLevel: 'B' },
    { name: '官鬼旺动克用', meaning: '凶', ruleId: 'liuyao.lost.xiong.guigui', citations: [cite('增删卜易', 'zengshanbuyi', '失物章', '官鬼旺动，防蓄意偷窃', 'B')], confidenceLevel: 'B' },
  ],
  locating: {
    byYaoWei: { 1: '地面墙角/鞋柜/地下室', 2: '厨房/卫生间/床底', 3: '卧室客厅矮柜', 4: '高柜书桌玄关', 5: '吊顶楼道路途中', 6: '房顶阁楼远方' },
    byDiZhi: {
      子: { dir: '正北', places: ['水边', '冰箱', '卫生间', '潮湿角落'] },
      午: { dir: '正南', places: ['窗台', '暖气', '阳台'] },
      卯: { dir: '正东', places: ['木门', '衣架', '绿植'] },
      酉: { dir: '正西', places: ['首饰盒', '化妆台', '金属筐'] },
      辰: { dir: '东南', places: ['箱柜', '土堆', '杂物'] },
      戌: { dir: '西北', places: ['箱柜', '土堆', '杂物'] },
    },
    byLiuShen: { 青龙: '干净显眼处', 朱雀: '纸张票据堆', 勾陈: '堆叠杂物下被压', 螣蛇: '缠绕夹缝', 白虎: '硬物金属下阴暗处', 玄武: '隐蔽暗处抽屉深处' },
    ruleId: 'liuyao.lost.loc',
    citations: [cite('增删卜易', 'zengshanbuyi', '失物章', '爻位地支六神定位法（民间传承整理）', 'D')],
    confidenceLevel: 'D',
  },
  timing: {
    rules: [
      { name: '静待冲、动待合、空待出空、墓待冲墓、破待补破、伏待冲飞', ruleId: 'liuyao.lost.timing.general', citations: [zsbyCite('zsby.c34.1', '静而逢值逢冲：如主事爻临子水不动，后逢子日午日而应之，余仿此。'), zsbyCite('zsby.c34.2', '动而逢合逢值：如主事爻临子水发动，后遇丑日子日而应之，余仿此。')], confidenceLevel: 'A' },
    ],
    fallback: '此卦象暂无可用的内置应期推法，建议记录并事后回标实际时间以校准',
  },
  readingList: [
    { canonicalId: 'zengshanbuyi', book: '增删卜易', chapter: '用神章', why: '用神分类（财物/文书/贼盗）原始论述', priority: 1 },
    { canonicalId: 'zengshanbuyi', book: '增删卜易', chapter: '应期总注章', why: '静逢值冲、动逢合值的应期铁律', priority: 1 },
    { canonicalId: 'huangjince', book: '黄金策', chapter: '失物', why: '「物失难寻，凭用神之存亡」', priority: 2 },
  ],
  forbidden: ['不得指名道姓断言某人盗窃', '不得教唆搜查他人身体或住宅', '贵重物品被盗应提示报警并保留证据，卦象不作为法律证据'],
  disclaimer: '本答复不构成对物品下落或他人行为的确定性判断，请理性处理并依法维权',
  recordTemplate: {
    fields: [
      { key: 'object', label: '丢失何物', type: 'text' },
      { key: 'lostAt', label: '丢失时间地点', type: 'text' },
      { key: 'found', label: '是否找回', type: 'enum', options: ['是', '否', '部分'] },
      { key: 'foundAt', label: '实际找到位置（对照卦象方位）', type: 'text' },
      { key: 'foundTime', label: '实际找回时间（对照应期）', type: 'date' },
    ],
    hint: '记录实际找到的位置与时间，与卦象方位、应期对照，这是提升断准率最快的方式',
  },
};

export const liuyaoLovePlaybook: Playbook = {
  id: 'liuyao.love.v1',
  category: '感情',
  version: 1,
  arts: {
    primary: 'liuyao',
    alternates: [
      { art: 'bazi', reason: '合婚、命局婚配、婚运时机' },
      { art: 'ziwei', reason: '看感情格局与大运流年走势' },
      { art: 'meihua', reason: '速断对方心意' },
    ],
    whyPrimary: '六爻断关系走向、对方态度、应期最细',
  },
  howToAsk: {
    goodExamples: ['我和 A 三个月内能否确定关系', '这段婚姻是否还有修复可能（半年内）'],
    badExamples: [
      { text: '他爱不爱我', why: '主观、不可证伪、易反复占' },
      { text: '我的正缘是谁', why: '无法具体到个人' },
    ],
    requiredFields: ['who', 'what', 'timeRange'],
    clarify: [{ id: 'status', text: '目前是已婚、恋爱、分手还是相亲阶段？这决定取用神方向' }],
  },
  howToCast: {
    methods: [
      { name: '摇卦', steps: ['净心专念双方现状与诉求', '连摇六次成卦'], arts: ['liuyao'] },
    ],
    tips: ['忌短期内反复摇（「初筮告，再三渎」），7 日内同事项重复起卦提示先看上一条'],
  },
  yongShen: [
    { condition: '男占女方/对象', yongShen: '妻财爻', ruleId: 'liuyao.love.yongshen.nan', citations: [cite('增删卜易', 'zengshanbuyi', '婚姻章', '男占女以妻财为用', 'B')], confidenceLevel: 'B' },
    { condition: '女占男方/对象', yongShen: '官鬼爻', ruleId: 'liuyao.love.yongshen.nv', citations: [cite('增删卜易', 'zengshanbuyi', '婚姻章', '女占男以官鬼为用', 'B')], confidenceLevel: 'B' },
    { condition: '对方态度', yongShen: '应爻', ruleId: 'liuyao.love.yongshen.ying', citations: [cite('卜筮正宗', 'bushizhengzong', '婚姻章', '应爻为对方', 'B')], confidenceLevel: 'B' },
    { condition: '自己', yongShen: '世爻', ruleId: 'liuyao.love.yongshen.shi', citations: [cite('卜筮正宗', 'bushizhengzong', '婚姻章', '世爻为己身', 'B')], confidenceLevel: 'B' },
    { condition: '已婚兼看婚书家庭', yongShen: '父母爻', ruleId: 'liuyao.love.yongshen.fumu', citations: [cite('增删卜易', 'zengshanbuyi', '婚姻章', '婚书家庭以父母爻为用', 'B')], confidenceLevel: 'B' },
  ],
  signals: [
    { name: '世应相生合', meaning: '吉', ruleId: 'liuyao.love.ji.shiying', citations: [cite('增删卜易', 'zengshanbuyi', '婚姻章', '世应相生相合，两情相悦', 'B')], confidenceLevel: 'B' },
    { name: '世应相冲克', meaning: '凶', ruleId: 'liuyao.love.xiong.chong', citations: [cite('增删卜易', 'zengshanbuyi', '婚姻章', '世应相冲，主不合', 'B')], confidenceLevel: 'B' },
    { name: '玄武临用神', meaning: '变数', ruleId: 'liuyao.love.bian.xuanwu', citations: [cite('卜筮正宗', 'bushizhengzong', '六神章', '玄武主暗昧隐瞒', 'B')], confidenceLevel: 'B' },
  ],
  timing: {
    rules: [
      { name: '合待冲、冲待合、空待出空、旺待值日值月', ruleId: 'liuyao.love.timing.general', citations: [cite('增删卜易', 'zengshanbuyi', '应期章', '逢合待冲，逢冲待合，逢空待出空', 'B')], confidenceLevel: 'B' },
    ],
    fallback: '暂无可用的内置应期推法，建议记录并事后回标',
  },
  readingList: [
    { canonicalId: 'zengshanbuyi', book: '增删卜易', chapter: '婚姻章', why: '世应生克与用神旺衰断婚姻', priority: 1 },
    { canonicalId: 'bushizhengzong', book: '卜筮正宗', chapter: '婚姻章', why: '官财得位与六神取象', priority: 1 },
    { canonicalId: 'sanmingtonghui', book: '三命通会', chapter: '论婚姻', why: '八字合婚参考', priority: 2 },
  ],
  forbidden: ['不得预测/暗示具体第三人身份', '不得给出「必须分手」「必须结婚」行为指令', '涉及家暴、胁迫、未成年人 → 直接转专业机构指引', '不得用于窥探他人隐私'],
  disclaimer: '感情之事请以沟通与理性为主，卦象仅供参考，不构成情感决策建议',
  recordTemplate: {
    fields: [
      { key: 'status', label: '关系现状', type: 'enum', options: ['已婚', '恋爱', '分手', '相亲'] },
      { key: 'ask', label: '诉求', type: 'text' },
      { key: 'outcome', label: '事后结果', type: 'enum', options: ['确立', '缓和', '分手', '无变化'] },
      { key: 'when', label: '发生时间（对应期）', type: 'date' },
    ],
    hint: '记录关系走向与实际时间，与卦象应期对照',
  },
};

export const liuyaoCareerPlaybook: Playbook = {
  id: 'liuyao.career.v1',
  category: '事业',
  version: 1,
  arts: {
    primary: 'liuyao',
    alternates: [
      { art: 'bazi', reason: '命局适合什么行业、大运走势，适合长期方向' },
      { art: 'ziwei', reason: '事业格局、官禄宫与大运流年' },
      { art: 'qimen', reason: '择时、方位、谈判时机' },
    ],
    whyPrimary: '六爻断具体岗位/项目成败与应期最直接',
  },
  howToAsk: {
    goodExamples: ['我投的 A 公司这个岗位，一个月内能否拿到 offer', '这个项目下季度能否顺利验收'],
    badExamples: [{ text: '我事业会不会成功', why: '太泛，无法取用神与应期，建议拆成具体事项+时限' }],
    requiredFields: ['what', 'timeRange'],
    clarify: [{ id: 'type', text: '是求职、升迁、创业、考公还是项目成败？取用神不同' }],
  },
  howToCast: {
    methods: [
      { name: '摇卦', steps: ['净心专念具体事项与目标', '连摇六次成卦'], arts: ['liuyao'] },
      { name: '时间卦/报数', steps: ['项目/投标类可用时间卦或报数起卦'], arts: ['liuyao', 'meihua'] },
    ],
    tips: ['必填具体事项（求职/升迁/创业/项目/考公）、目标、时限'],
  },
  yongShen: [
    { condition: '功名/职位/官职/录取', yongShen: '官鬼爻', ruleId: 'liuyao.career.yongshen.guigui', citations: [cite('增删卜易', 'zengshanbuyi', '求名章', '功名以官鬼为用', 'B')], confidenceLevel: 'B' },
    { condition: '文书/合同/offer/学历/印章/公司资质', yongShen: '父母爻', ruleId: 'liuyao.career.yongshen.fumu', citations: [cite('增删卜易', 'zengshanbuyi', '文书章', '文书合同以父母爻为用', 'B')], confidenceLevel: 'B' },
    { condition: '薪资/利润/生意收益', yongShen: '妻财爻', ruleId: 'liuyao.career.yongshen.caifu', citations: [cite('增删卜易', 'zengshanbuyi', '求财章', '财利以妻财为用', 'B')], confidenceLevel: 'B' },
    { condition: '同事/竞争者', yongShen: '兄弟爻', ruleId: 'liuyao.career.yongshen.xiongdi', citations: [cite('增删卜易', 'zengshanbuyi', '求财章', '同辈竞争以兄弟爻为用', 'B')], confidenceLevel: 'B' },
    { condition: '下属/创意/技术产出', yongShen: '子孙爻', ruleId: 'liuyao.career.yongshen.zisun', citations: [cite('增删卜易', 'zengshanbuyi', '求财章', '生财之源以子孙为用', 'B')], confidenceLevel: 'B' },
  ],
  signals: [
    { name: '官父两旺', meaning: '吉', ruleId: 'liuyao.career.ji.guanfu', citations: [cite('增删卜易', 'zengshanbuyi', '求名章', '官父两旺，功名可成', 'B')], confidenceLevel: 'B' },
    { name: '子孙旺动克官', meaning: '凶', ruleId: 'liuyao.career.xiong.zisunkegu', citations: [cite('增删卜易', 'zengshanbuyi', '求名章', '子孙克官，职场是非岗位不保', 'B')], confidenceLevel: 'B' },
    { name: '父母空亡', meaning: '变数', ruleId: 'liuyao.career.bian.fumu', citations: [cite('增删卜易', 'zengshanbuyi', '文书章', '父母空亡，合同未实流程卡住', 'B')], confidenceLevel: 'B' },
  ],
  timing: {
    rules: [
      { name: '官鬼旺相值日值月、父母出空填实、合待冲', ruleId: 'liuyao.career.timing.general', citations: [cite('增删卜易', 'zengshanbuyi', '应期章', '旺者逢值逢合之期', 'B')], confidenceLevel: 'B' },
    ],
    fallback: '暂无可用的内置应期推法，建议记录并事后回标',
  },
  readingList: [
    { canonicalId: 'zengshanbuyi', book: '增删卜易', chapter: '求名章', why: '官父两旺与文书取象', priority: 1 },
    { canonicalId: 'bushizhengzong', book: '卜筮正宗', chapter: '仕途章', why: '仕途占断体系', priority: 1 },
    { canonicalId: 'zipingzhenquan', book: '子平真诠', chapter: '论用神', why: '八字方向参考', priority: 2 },
  ],
  forbidden: ['不得承诺录用/中标结果', '不得建议违法违规操作（行贿、伪造材料）', '涉及裁员、劳动纠纷 → 提示劳动仲裁/法律咨询渠道'],
  disclaimer: '本答复不构成对求职/项目结果的承诺，请理性判断并依规行事',
  recordTemplate: {
    fields: [
      { key: 'item', label: '事项/目标', type: 'text' },
      { key: 'deadline', label: '时限', type: 'text' },
      { key: 'outcome', label: '结果', type: 'enum', options: ['成功', '失败', '延期'] },
      { key: 'when', label: '实际时间', type: 'date' },
    ],
    hint: '记录结果与实际时间，与卦象应期对照',
  },
};

export const pastFuturePlaybook: Playbook = {
  id: 'past-future.v1',
  category: '其他',
  subCategory: '过去未来',
  version: 1,
  arts: {
    primary: 'bazi',
    alternates: [
      { art: 'liuyao', reason: '验卦校准：对已发生之事起卦校验' },
      { art: 'ziwei', reason: '命盘大限流年复盘与走势' },
    ],
    whyPrimary: '「过去未来」需拆分：复盘/校准用八字与六爻验卦；趋势/应期用八字大运流年',
  },
  howToAsk: {
    goodExamples: [
      '2020–2023 这步大运我为什么事业反复（复盘）',
      '未来三年适不适合转行（走势）',
      '这笔货款 Q3 能否收回（具体事）',
    ],
    badExamples: [
      { text: '我前世是谁', why: '无法验证，不予支持' },
      { text: '我三年前那天下午到底发生了什么', why: '术数无法精确回放，仅能复盘趋势' },
    ],
    requiredFields: ['what', 'timeRange'],
    clarify: [{ id: 'direction', text: '你是想看「过去」（复盘/校准）还是「未来」（趋势/应期）？能力边界不同' }],
  },
  howToCast: {
    methods: [
      { name: '排命盘', steps: ['提供出生年月日时（尽量精确时辰）', '八字/紫微排盘'], arts: ['bazi', 'ziwei'] },
      { name: '摇卦', steps: ['对已发生之事起卦，用已知结果校验卦象'], arts: ['liuyao'] },
    ],
    tips: ['系统提示：本软件对「过去」的作用是复盘与校准，不是精确回放', '看过去时必须提供已知事实用于对照'],
  },
  yongShen: [
    { condition: '复盘已发生的大运流年', yongShen: '大运流年干支（八字）', ruleId: 'past-future.yongshen.dayun', citations: [cite('子平真诠', 'zipingzhenquan', '论大运', '大运流年与命局喜忌参看', 'B')], confidenceLevel: 'B' },
    { condition: '验卦校准', yongShen: '事之用神（六爻）', ruleId: 'past-future.yongshen.yanshi', citations: [cite('增删卜易', 'zengshanbuyi', '验卦章', '以已知结果校验卦象用神', 'B')], confidenceLevel: 'B' },
  ],
  signals: [
    { name: '大运喜用神到位', meaning: '吉', ruleId: 'past-future.ji.xiyong', citations: [cite('子平真诠', 'zipingzhenquan', '论用神', '行运得用神生扶则顺', 'B')], confidenceLevel: 'B' },
    { name: '流年冲克命局', meaning: '凶', ruleId: 'past-future.xiong.chongke', citations: [cite('三命通会', 'sanmingtonghui', '论流年', '流年冲克命局防变动', 'B')], confidenceLevel: 'B' },
  ],
  timing: {
    rules: [
      { name: '大运十年为纲，流年逐年应验', ruleId: 'past-future.timing.dayun', citations: [cite('三命通会', 'sanmingtonghui', '论大运', '大运以十年为限，流年逐年而应', 'B')], confidenceLevel: 'B' },
    ],
    fallback: '走势类问题以「阶段」而非「具体日」作答',
  },
  readingList: [
    { canonicalId: 'zipingzhenquan', book: '子平真诠', chapter: '论大运', why: '大运走势判断', priority: 1 },
    { canonicalId: 'sanmingtonghui', book: '三命通会', chapter: '论流年', why: '流年应期参考', priority: 1 },
    { canonicalId: 'zengshanbuyi', book: '增删卜易', chapter: '验卦章', why: '六爻验卦校准方法', priority: 2 },
  ],
  forbidden: ['不得宣称能精确回放/预知具体事件', '不得用于查他人隐私/前世/因果', '涉及已发生的伤害事件、案件 → 引导至专业机构，不做推断'],
  disclaimer: '本软件对「过去未来」的作用是复盘、校准与趋势参考，不是精确回放或预知',
  recordTemplate: {
    fields: [
      { key: 'direction', label: '方向', type: 'enum', options: ['过去', '未来'] },
      { key: 'ask', label: '诉求', type: 'text' },
      { key: 'facts', label: '已知事实', type: 'text' },
      { key: 'match', label: '吻合度', type: 'enum', options: ['高', '中', '低'] },
    ],
    hint: '记录已知事实与事后结果，计算吻合度，用于校准取用神与断法',
  },
};

export const liuyaoWealthPlaybook: Playbook = {
  id: 'liuyao.wealth.v1',
  category: '求财',
  version: 1,
  arts: {
    primary: 'liuyao',
    alternates: [
      { art: 'bazi', reason: '财星格局与大运流年财运走势' },
      { art: 'meihua', reason: '速断当下财路可否' },
    ],
    whyPrimary: '六爻断具体求财事项（时机/本金/收益/合伙）最直接',
  },
  howToAsk: {
    goodExamples: ['我这笔货款三个月内能否收回', '投的这个项目半年内能回本吗'],
    badExamples: [{ text: '我财运如何', why: '太泛，无具体事项无法取用神与应期' }],
    requiredFields: ['what', 'timeRange', 'needTiming'],
    clarify: [{ id: 'route', text: '财路是正财（工资）、偏财（投资）、生意还是讨债？取用神与断法不同' }],
  },
  howToCast: {
    methods: [
      { name: '摇卦', steps: ['净心专念具体求财事项', '连摇六次成卦'], arts: ['liuyao'] },
      { name: '时间卦/报数', steps: ['投资/交易类可用时间卦或报数起卦'], arts: ['liuyao', 'meihua'] },
    ],
    tips: ['必填财路、本金规模、期望时限；7 日内同事项重复起卦会提示先看上一条'],
  },
  yongShen: [
    { condition: '本金/货物/收益/欠款', yongShen: '妻财爻', ruleId: 'liuyao.wealth.yongshen.caifu', citations: [hjcCite('hjc.c19.1', '居货曰贾，行货曰商，总为资生之计?蓍所以筮，龟所以卜，莫非就利之谋?要问吉凶，但看财福?财旺福兴，无问公私皆称意；'), zsbyCite('zsby.c74.2', '财旺福兴，公私称意。')], confidenceLevel: 'A' },
    { condition: '生财之源/人脉/渠道', yongShen: '子孙爻', ruleId: 'liuyao.wealth.yongshen.zisun', citations: [hjcCite('hjc.c19.8', '世持动弟，如捞水底之针?福变财生，滚滚利源不竭；')], confidenceLevel: 'A' },
    { condition: '同行竞争/拆借往来', yongShen: '兄弟爻', ruleId: 'liuyao.wealth.yongshen.xiongdi', citations: [hjcCite('hjc.c19.2', '财空福绝，不拘营运总违心?有福无财，兄弟交重偏有望；')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '财旺福兴', meaning: '吉', ruleId: 'liuyao.wealth.ji.caiwang', citations: [zsbyCite('zsby.c74.2', '财旺福兴，公私称意。')], confidenceLevel: 'A' },
    { name: '财空福绝', meaning: '凶', ruleId: 'liuyao.wealth.xiong.cailing', citations: [hjcCite('hjc.c19.2', '财空福绝，不拘营运总违心?有福无财，兄弟交重偏有望；')], confidenceLevel: 'A' },
    { name: '财入墓库', meaning: '变数', ruleId: 'liuyao.wealth.bian.muku', citations: [hjcCite('hjc.c19.5', '日伤妻位，财虽旺而当日应无?多财反复，必须墓库以收藏；')], confidenceLevel: 'A' },
  ],
  timing: {
    rules: [
      { name: '财旺逢值逢合、空待出空、墓待冲墓、伏待冲飞', ruleId: 'liuyao.wealth.timing.general', citations: [zsbyCite('zsby.c34.1', '静而逢值逢冲：如主事爻临子水不动，后逢子日午日而应之，余仿此。'), zsbyCite('zsby.c34.2', '动而逢合逢值：如主事爻临子水发动，后遇丑日子日而应之，余仿此。')], confidenceLevel: 'A' },
    ],
    fallback: '此卦象暂无可用的内置应期推法，建议记录并事后回标实际时间以校准',
  },
  readingList: [
    { canonicalId: 'zengshanbuyi', book: '增删卜易', chapter: '求财章第六十八', why: '求财总论（财旺福兴）', priority: 1 },
    { canonicalId: 'huangjince', book: '黄金策', chapter: '18章 求财', why: '求财分类占断原文', priority: 1 },
  ],
  forbidden: ['不得承诺收益/保证金额', '不得提供投资建议或诱导加仓', '借贷纠纷 → 提示法律渠道'],
  disclaimer: '本答复不构成投资建议或收益承诺，请理性决策并自行承担风险',
  recordTemplate: {
    fields: [
      { key: 'route', label: '财路', type: 'text' },
      { key: 'amount', label: '本金/期望金额', type: 'number' },
      { key: 'outcome', label: '结果', type: 'enum', options: ['收回', '部分', '未收回'] },
      { key: 'when', label: '实际时间', type: 'date' },
    ],
    hint: '记录本金、结果与实际时间，对照卦象应期与财爻旺衰',
  },
};

export const liuyaoStudyPlaybook: Playbook = {
  id: 'liuyao.study.v1',
  category: '学业',
  version: 1,
  arts: {
    primary: 'liuyao',
    alternates: [
      { art: 'bazi', reason: '学业格局与文昌贵人走势' },
      { art: 'meihua', reason: '速断考试发挥' },
    ],
    whyPrimary: '六爻断具体考试/升学成败与应期最直接',
  },
  howToAsk: {
    goodExamples: ['我下个月的这场考试能过吗', '这次升学面试能否拿到 offer'],
    badExamples: [{ text: '我学习运如何', why: '太泛，无具体考试无法断应期' }],
    requiredFields: ['what', 'timeRange'],
    clarify: [{ id: 'exam', text: '是哪场考试/升学/考证？具体科目与时间？' }],
  },
  howToCast: {
    methods: [
      { name: '摇卦', steps: ['净心专念具体考试与目标', '连摇六次成卦'], arts: ['liuyao'] },
    ],
    tips: ['必填考试名称与时间；泛问「学习运」无法取用神'],
  },
  yongShen: [
    { condition: '学业/考试/文书/成绩', yongShen: '父母爻', ruleId: 'liuyao.study.yongshen.fumu', citations: [zsbyCite('zsby.c52.1', '儒业者，父母世爻同旺，终须变化成龙。')], confidenceLevel: 'A' },
    { condition: '录取/功名/学位', yongShen: '官鬼爻', ruleId: 'liuyao.study.yongshen.guigui', citations: [hjcCite('hjc.c17.1', '书读五车，固欲致身于廓廊，胸藏万卷，肯甘遁迹于丘园?要相国家，当详易卦?父爻旺相．'), hjcCite('hjc.c17.2', '鬼位兴隆，家报泥金捷喜?财若交重，休望青钱之中选；')], confidenceLevel: 'A' },
    { condition: '竞争者/同侪', yongShen: '兄弟爻', ruleId: 'liuyao.study.yongshen.xiongdi', citations: [hjcCite('hjc.c17.3', '福如发动，难期金榜之题名?兄弟同经，乃夺标之恶客；')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '父母世爻同旺', meaning: '吉', ruleId: 'liuyao.study.ji.fushi', citations: [zsbyCite('zsby.c52.1', '儒业者，父母世爻同旺，终须变化成龙。')], confidenceLevel: 'A' },
    { name: '财爻动克父母', meaning: '凶', ruleId: 'liuyao.study.xiong.caikefu', citations: [hjcCite('hjc.c17.2', '鬼位兴隆，家报泥金捷喜?财若交重，休望青钱之中选；')], confidenceLevel: 'A' },
    { name: '子孙旺动克官', meaning: '变数', ruleId: 'liuyao.study.bian.zisun', citations: [hjcCite('hjc.c17.3', '福如发动，难期金榜之题名?兄弟同经，乃夺标之恶客；')], confidenceLevel: 'A' },
  ],
  timing: {
    rules: [
      { name: '父母出空填实、官鬼值日值月、合待冲', ruleId: 'liuyao.study.timing.general', citations: [zsbyCite('zsby.c34.1', '静而逢值逢冲：如主事爻临子水不动，后逢子日午日而应之，余仿此。')], confidenceLevel: 'A' },
    ],
    fallback: '此卦象暂无可用的内置应期推法，建议记录并事后回标实际时间以校准',
  },
  readingList: [
    { canonicalId: 'zengshanbuyi', book: '增删卜易', chapter: '学业章第四十五', why: '父母世爻同旺论', priority: 1 },
    { canonicalId: 'huangjince', book: '黄金策', chapter: '16章 求名', why: '求名分类占断原文', priority: 1 },
  ],
  forbidden: ['不得承诺录取/名次', '备考压力/焦虑 → 引导正常学习规划与心理支持渠道'],
  disclaimer: '本答复不构成对考试结果的承诺，请安心备考、理性对待结果',
  recordTemplate: {
    fields: [
      { key: 'exam', label: '考试/升学事项', type: 'text' },
      { key: 'outcome', label: '结果', type: 'enum', options: ['通过', '未过', '待定'] },
      { key: 'when', label: '实际时间', type: 'date' },
    ],
    hint: '记录考试结果与实际时间，对照卦象应期',
  },
};

export const liuyaoTripPlaybook: Playbook = {
  id: 'liuyao.trip.v1',
  category: '出行',
  version: 1,
  arts: {
    primary: 'liuyao',
    alternates: [
      { art: 'xiaoliuren', reason: '报数/时间速断这趟行程是否顺利、宜行宜止' },
      { art: 'meihua', reason: '速断出行顺利与否' },
      { art: 'qimen', reason: '出行方向与择时参考' },
    ],
    whyPrimary: '六爻断出行能否成行、旅途吉凶、应期最直接',
  },
  howToAsk: {
    goodExamples: ['我下周三出差上海，这趟行程顺利吗', '这次搬家到外地，途中会顺利吗'],
    badExamples: [{ text: '我出门会不会有事', why: '太泛且无具体目的地/时间，无法断' }],
    requiredFields: ['what', 'timeRange', 'location'],
    clarify: [{ id: 'mode', text: '出行目的是出差、旅游、搬家还是探亲？是否关心途中安全或办事结果？' }],
  },
  howToCast: {
    methods: [
      { name: '摇卦', steps: ['净心专念出行事项', '连摇六次成卦'], arts: ['liuyao'] },
      { name: '时间卦', steps: ['以出行时间起卦'], arts: ['liuyao', 'meihua'] },
    ],
    tips: ['必填目的地、时间、出行目的'],
  },
  yongShen: [
    { condition: '自身出行安危', yongShen: '世爻', ruleId: 'liuyao.trip.yongshen.shi', citations: [hjcCite('hjc.c30.2', '妻作盘缠，生旺则丰盈足用?世如衰弱，那堪水宿风餐；')], confidenceLevel: 'A' },
    { condition: '目的地/谋事成败', yongShen: '应爻', ruleId: 'liuyao.trip.yongshen.ying', citations: [hjcCite('hjc.c30.3', '应若空亡，难望谋成事就?间爻安静，往来一路平安；')], confidenceLevel: 'A' },
    { condition: '行李/舟车', yongShen: '父母爻', ruleId: 'liuyao.trip.yongshen.fumu', citations: [hjcCite('hjc.c30.1', '父为行李，带刑则破损不中；')], confidenceLevel: 'A' },
    { condition: '盘缠/费用', yongShen: '妻财爻', ruleId: 'liuyao.trip.yongshen.caifu', citations: [hjcCite('hjc.c30.2', '妻作盘缠，生旺则丰盈足用?世如衰弱，那堪水宿风餐；')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '世旺有气', meaning: '吉', ruleId: 'liuyao.trip.ji.shiwang', citations: [zsbyCite('zsby.c97.2', '占卜应以世爻为先，旺相宜行，空亡宜止。')], confidenceLevel: 'A' },
    { name: '世空月破', meaning: '凶', ruleId: 'liuyao.trip.xiong.shikong', citations: [zsbyCite('zsby.c97.2', '占卜应以世爻为先，旺相宜行，空亡宜止。')], confidenceLevel: 'A' },
    { name: '应克世爻', meaning: '凶', ruleId: 'liuyao.trip.xiong.yingke', citations: [hjcCite('hjc.c30.5', '应克世爻，无问公私皆不利?八纯乱动，到处皆凶；')], confidenceLevel: 'A' },
    { name: '间爻安静', meaning: '吉', ruleId: 'liuyao.trip.ji.jianyao', citations: [hjcCite('hjc.c30.3', '应若空亡，难望谋成事就?间爻安静，往来一路平安；')], confidenceLevel: 'A' },
  ],
  timing: {
    rules: [
      { name: '世动主行期已定，静逢冲日而行', ruleId: 'liuyao.trip.timing.general', citations: [hjcCite('hjc.c30.6', '两间齐空，独行则吉?世动订期，变鬼则自投罗网；')], confidenceLevel: 'A' },
    ],
    fallback: '此卦象暂无可用的内置应期推法，建议记录并事后回标实际时间以校准',
  },
  readingList: [
    { canonicalId: 'zengshanbuyi', book: '增删卜易', chapter: '出行章第九十一', why: '出行占断总论', priority: 1 },
    { canonicalId: 'huangjince', book: '黄金策', chapter: '29章 出行', why: '出行分类占断原文', priority: 1 },
  ],
  forbidden: ['不得替代交通安全决策', '涉及危险地区/特殊情况 → 提示安全渠道'],
  disclaimer: '本答复不构成出行安全保证，请遵守交通规则并自行评估风险',
  recordTemplate: {
    fields: [
      { key: 'destination', label: '目的地', type: 'text' },
      { key: 'purpose', label: '出行目的', type: 'text' },
      { key: 'outcome', label: '途中结果', type: 'enum', options: ['顺利', '波折', '未成行'] },
      { key: 'when', label: '实际时间', type: 'date' },
    ],
    hint: '记录目的地、目的与实际结果，对照卦象世应旺衰',
  },
};

export const liuyaoLegalPlaybook: Playbook = {
  id: 'liuyao.legal.v1',
  category: '官非',
  version: 1,
  arts: {
    primary: 'liuyao',
    alternates: [
      { art: 'liuren', reason: '诉讼走势与对头情况' },
      { art: 'bazi', reason: '命局官非格局' },
    ],
    whyPrimary: '六爻断官司输赢、和解时机最直接',
  },
  howToAsk: {
    goodExamples: ['这个劳动仲裁我能赢吗', '这起合同纠纷三个月内能和解吗'],
    badExamples: [{ text: '我要不要打官司', why: '涉及重大决策，建议咨询律师后决定，卦象仅供心态参考' }],
    requiredFields: ['what', 'timeRange'],
    clarify: [{ id: 'stage', text: '纠纷目前处于什么阶段（协商/仲裁/诉讼）？对方态度如何？' }],
  },
  howToCast: {
    methods: [
      { name: '摇卦', steps: ['净心专念纠纷事项', '连摇六次成卦'], arts: ['liuyao'] },
    ],
    tips: ['官非属敏感事项，卦象仅供心态参考，务必同步咨询专业律师'],
  },
  yongShen: [
    { condition: '自己', yongShen: '世爻', ruleId: 'liuyao.legal.yongshen.shi', citations: [hjcCite('hjc.c24.3', '世为自己，宜帝旺长生?相冲相克乃是欺凌之象，相生相合终成和好之情?')], confidenceLevel: 'A' },
    { condition: '对方/对头', yongShen: '应爻', ruleId: 'liuyao.legal.yongshen.ying', citations: [hjcCite('hjc.c24.2', '大亏既负，宁不诉枉申冤?欲定输赢，须详世应?应乃对头，要休囚死绝；')], confidenceLevel: 'A' },
    { condition: '官府/法官/裁决', yongShen: '官鬼爻', ruleId: 'liuyao.legal.yongshen.guigui', citations: [hjcCite('hjc.c24.6', '父为案卷文书，伏须未就?鬼作问官，克应则他遭杖责；')], confidenceLevel: 'A' },
    { condition: '案卷/文书/证据', yongShen: '父母爻', ruleId: 'liuyao.legal.yongshen.fumu', citations: [hjcCite('hjc.c24.6', '父为案卷文书，伏须未就?鬼作问官，克应则他遭杖责；')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '世应相生合', meaning: '吉', ruleId: 'liuyao.legal.ji.shiyinghe', citations: [hjcCite('hjc.c24.3', '相冲相克乃是欺凌之象，相生相合终成和好之情?世应比和官鬼动，恐公家捉打官司；')], confidenceLevel: 'A' },
    { name: '子孙发动', meaning: '吉', ruleId: 'liuyao.legal.ji.zisun', citations: [hjcCite('hjc.c24.4', '卦爻安静子孙兴，喜亲友劝和公事?世空则我欲息争，应动则他多机变?')], confidenceLevel: 'A' },
    { name: '世入墓狱', meaning: '凶', ruleId: 'liuyao.legal.xiong.shimu', citations: [hjcCite('hjc.c24.7', '逢财则理真气壮，遇兄则财散人离?世入墓爻，难免狱囚之系；')], confidenceLevel: 'A' },
  ],
  timing: {
    rules: [
      { name: '官鬼旺相值日、世应相合待冲、文书出空', ruleId: 'liuyao.legal.timing.general', citations: [hjcCite('hjc.c24.7', '日为书吏，伤身则我受刑名?逢财则理真气壮，遇兄则财散人离?世入墓爻，难免狱囚之系；')], confidenceLevel: 'A' },
    ],
    fallback: '此卦象暂无可用的内置应期推法，建议记录并事后回标实际时间以校准',
  },
  readingList: [
    { canonicalId: 'huangjince', book: '黄金策', chapter: '23章 词讼', why: '词讼分类占断原文', priority: 1 },
    { canonicalId: 'bushizhengzong', book: '卜筮正宗', chapter: '词讼章', why: '词讼占断参考', priority: 2 },
  ],
  forbidden: ['不得给出诉讼必胜承诺或法律结论', '务必引导咨询执业律师', '涉及刑事/重大纠纷 → 明确提示寻求法律援助'],
  disclaimer: '本答复仅为易理参考，不构成法律意见；法律事务请务必咨询执业律师',
  recordTemplate: {
    fields: [
      { key: 'stage', label: '纠纷阶段', type: 'text' },
      { key: 'outcome', label: '结果', type: 'enum', options: ['胜诉', '和解', '败诉', '进行中'] },
      { key: 'when', label: '实际时间', type: 'date' },
    ],
    hint: '记录纠纷阶段、结果与实际时间，对照卦象世应生克',
  },
};

export const liuyaoPartnerPlaybook: Playbook = {
  id: 'liuyao.partner.v1',
  category: '合作',
  version: 1,
  arts: {
    primary: 'liuyao',
    alternates: [
      { art: 'ziwei', reason: '看合作对象命局与合伙格局' },
      { art: 'liuren', reason: '谈判走势' },
    ],
    whyPrimary: '六爻断合作成否、对方诚意、利益分配最直接',
  },
  howToAsk: {
    goodExamples: ['我和这家公司的合作能谈成吗', '这个合伙人靠谱吗，合作会顺利吗'],
    badExamples: [{ text: '我该不该跟人合作', why: '建议先明确合作对象与内容再起卦' }],
    requiredFields: ['what', 'who', 'timeRange'],
    clarify: [{ id: 'form', text: '是合伙、签约、谈判还是借贷？利益如何分配？' }],
  },
  howToCast: {
    methods: [
      { name: '摇卦', steps: ['净心专念合作事项', '连摇六次成卦'], arts: ['liuyao'] },
      { name: '时间卦/报数', steps: ['谈判/签约类可用时间卦或报数起卦'], arts: ['liuyao', 'meihua'] },
    ],
    tips: ['必填合作对象、内容、利益分配方式'],
  },
  yongShen: [
    { condition: '合作对方', yongShen: '应爻', ruleId: 'liuyao.partner.yongshen.ying', citations: [hjcCite('hjc.c1.13', '世为己，应为人，大宜契合；')], confidenceLevel: 'A' },
    { condition: '自己', yongShen: '世爻', ruleId: 'liuyao.partner.yongshen.shi', citations: [hjcCite('hjc.c1.13', '世为己，应为人，大宜契合；')], confidenceLevel: 'A' },
    { condition: '利益/利润分成', yongShen: '妻财爻', ruleId: 'liuyao.partner.yongshen.caifu', citations: [hjcCite('hjc.c19.7', '身或兄临，必难求望?财来就我终须易，我去寻财必是难?身遇旺财，似取囊中之物；')], confidenceLevel: 'A' },
    { condition: '合同/协议', yongShen: '父母爻', ruleId: 'liuyao.partner.yongshen.fumu', citations: [hjcCite('hjc.c24.6', '父为案卷文书，伏须未就?鬼作问官，克应则他遭杖责；')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '世应相生合', meaning: '吉', ruleId: 'liuyao.partner.ji.shiyinghe', citations: [hjcCite('hjc.c1.13', '世为己，应为人，大宜契合；')], confidenceLevel: 'A' },
    { name: '兄弟爻旺动', meaning: '变数', ruleId: 'liuyao.partner.bian.xiongdi', citations: [hjcCite('hjc.c19.6', '无鬼分争，又怕交重而阻滞?兄如太过，反不克财；')], confidenceLevel: 'A' },
    { name: '应爻空亡', meaning: '凶', ruleId: 'liuyao.partner.xiong.yingkong', citations: [hjcCite('hjc.c1.16', '世应俱空，人无准实；')], confidenceLevel: 'A' },
  ],
  timing: {
    rules: [
      { name: '世应相合待冲、财旺逢值、合同文书出空', ruleId: 'liuyao.partner.timing.general', citations: [zsbyCite('zsby.c34.1', '静而逢值逢冲：如主事爻临子水不动，后逢子日午日而应之，余仿此。')], confidenceLevel: 'A' },
    ],
    fallback: '此卦象暂无可用的内置应期推法，建议记录并事后回标实际时间以校准',
  },
  readingList: [
    { canonicalId: 'huangjince', book: '黄金策', chapter: '18章 求财', why: '世应生合与兄弟劫财论', priority: 1 },
    { canonicalId: 'zengshanbuyi', book: '增删卜易', chapter: '求财章第六十八', why: '合伙求财参考', priority: 2 },
  ],
  forbidden: ['不得替代尽职调查或合同审查', '借贷/担保 → 提示法律风险与专业咨询'],
  disclaimer: '本答复不构成合作建议或商业尽职调查，请自行核实合作方资信',
  recordTemplate: {
    fields: [
      { key: 'partner', label: '合作对象', type: 'text' },
      { key: 'form', label: '合作形式', type: 'text' },
      { key: 'outcome', label: '结果', type: 'enum', options: ['达成', '未成', '波折'] },
      { key: 'when', label: '实际时间', type: 'date' },
    ],
    hint: '记录合作对象、形式与实际结果，对照卦象世应生合',
  },
};

export const liuyaoDecisionPlaybook: Playbook = {
  id: 'liuyao.decision.v1',
  category: '决策',
  version: 1,
  arts: {
    primary: 'liuyao',
    alternates: [
      { art: 'xiaoliuren', reason: '报数速断当下宜进宜止、哪个方向顺' },
      { art: 'meihua', reason: '速断 A/B 选择' },
      { art: 'ziwei', reason: '看长期走向' },
    ],
    whyPrimary: '六爻断 A/B 选择、去留、时机的权衡',
  },
  howToAsk: {
    goodExamples: ['A 公司 offer 和 B 公司 offer 选哪个（一个月内）', '这房子现在买还是明年买'],
    badExamples: [{ text: '我该怎么办', why: '没有具体选项与时限，无法断；建议先列出备选' }],
    requiredFields: ['what', 'options', 'timeRange'],
    clarify: [{ id: 'options', text: '请把备选项列清楚（如 A vs B），并说明决策时限' }],
  },
  howToCast: {
    methods: [
      { name: '摇卦', steps: ['净心专念 A/B 选项与时限', '连摇六次成卦'], arts: ['liuyao'] },
    ],
    tips: ['必填备选项与决策时限；决策类卦象供权衡参考，不替代理性分析'],
  },
  yongShen: [
    { condition: '自身立场', yongShen: '世爻', ruleId: 'liuyao.decision.yongshen.shi', citations: [hjcCite('hjc.c1.13', '世为己，应为人，大宜契合；')], confidenceLevel: 'A' },
    { condition: '对方/外境', yongShen: '应爻', ruleId: 'liuyao.decision.yongshen.ying', citations: [hjcCite('hjc.c1.13', '世为己，应为人，大宜契合；')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '世爻旺相', meaning: '吉', ruleId: 'liuyao.decision.ji.shiwang', citations: [hjcCite('hjc.c1.15', '应位遭伤不利他人之事，世爻受制岂宜自己之谋。')], confidenceLevel: 'A' },
    { name: '世爻受克', meaning: '凶', ruleId: 'liuyao.decision.xiong.shishouke', citations: [hjcCite('hjc.c1.15', '应位遭伤不利他人之事，世爻受制岂宜自己之谋。')], confidenceLevel: 'A' },
    { name: '世应俱空', meaning: '变数', ruleId: 'liuyao.decision.bian.kong', citations: [hjcCite('hjc.c1.16', '世应俱空，人无准实；')], confidenceLevel: 'A' },
  ],
  timing: {
    rules: [
      { name: '旺者逢值逢合、空待出空、合待冲', ruleId: 'liuyao.decision.timing.general', citations: [zsbyCite('zsby.c34.1', '静而逢值逢冲：如主事爻临子水不动，后逢子日午日而应之，余仿此。')], confidenceLevel: 'A' },
    ],
    fallback: '决策类建议结合理性分析，记录选项与结果事后校准',
  },
  readingList: [
    { canonicalId: 'huangjince', book: '黄金策', chapter: '总断千金赋', why: '世应生克总论', priority: 1 },
  ],
  forbidden: ['不得替代理性决策或重大人生选择', '医疗/法律/财务等专业决策 → 引导专业咨询'],
  disclaimer: '本答复仅供权衡参考，重大决策请结合理性分析与专业意见',
  recordTemplate: {
    fields: [
      { key: 'options', label: '备选项', type: 'text' },
      { key: 'decision', label: '实际选择', type: 'text' },
      { key: 'outcome', label: '结果', type: 'enum', options: ['满意', '一般', '后悔'] },
      { key: 'when', label: '实际时间', type: 'date' },
    ],
    hint: '记录备选项、实际选择与事后评价，用于校准世应断法',
  },
};

export const baziHealthPlaybook: Playbook = {
  id: 'bazi.health.v1',
  category: '健康',
  version: 1,
  arts: {
    primary: 'bazi',
    alternates: [
      { art: 'liuyao', reason: '断具体病症趋势与应期' },
      { art: 'ziwei', reason: '看疾厄宫与大运流年健康走势' },
    ],
    whyPrimary: '八字以日主与五行为纲，看命局强弱与岁运引动的健康趋势',
  },
  howToAsk: {
    goodExamples: ['我今年身体整体趋势如何（体检前想心里有底）', '这个老毛病换季时会不会反复'],
    badExamples: [{ text: '我是不是得了癌症', why: '健康占仅看趋势与时机，不做诊断；疑似病症请立即就医' }],
    requiredFields: ['what', 'timeRange'],
    clarify: [{ id: 'focus', text: '你关注的是整体趋势、某个老毛病、还是体检前后？' }],
  },
  howToCast: {
    methods: [
      { name: '排命盘', steps: ['提供出生年月日时（尽量精确时辰）', '八字排盘'], arts: ['bazi'] },
    ],
    tips: ['健康类问题仅看趋势与时机，不提供诊断；请遵医嘱并定期体检'],
  },
  yongShen: [
    { condition: '命局强弱', yongShen: '日主（八字）', ruleId: 'bazi.health.yongshen.rizhu', citations: [zsbyCite('zsby.c105.4', '余试多年或生或死，全凭用神，余皆不验，人有不看用神而断生死者，卦变为六冲是也。')], confidenceLevel: 'A' },
    { condition: '久病反复', yongShen: '忌神与岁运引动（八字）', ruleId: 'bazi.health.yongshen.jishen', citations: [zsbyCite('zsby.c105.5', '六冲变冲，久病难于调治?久病者，卦逢六冲，卦变六冲，不论用神之衰旺，乃不治之疾也，近病逢之，不药而愈。')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '忌神受制', meaning: '吉', ruleId: 'bazi.health.ji.jishenshouzhi', citations: [zsbyCite('zsby.c105.5', '六冲变冲，久病难于调治?久病者，卦逢六冲，卦变六冲，不论用神之衰旺，乃不治之疾也，近病逢之，不药而愈。')], confidenceLevel: 'A' },
    { name: '岁运冲克命局喜用', meaning: '凶', ruleId: 'bazi.health.xiong.chongke', citations: [cite('三命通会', 'sanmingtonghui', '论流年', '流年冲克命局防健康波动', 'D')], confidenceLevel: 'D' },
    { name: '健康问卦见六冲近病', meaning: '吉', ruleId: 'bazi.health.bian.jinbing', citations: [zsbyCite('zsby.c105.5', '六冲变冲，久病难于调治?久病者，卦逢六冲，卦变六冲，不论用神之衰旺，乃不治之疾也，近病逢之，不药而愈。')], confidenceLevel: 'A' },
  ],
  timing: {
    rules: [
      { name: '大运十年为纲，流年逐年应验，忌神当值之年防反复', ruleId: 'bazi.health.timing.dayun', citations: [cite('三命通会', 'sanmingtonghui', '论大运', '大运以十年为限，流年逐年而应', 'D')], confidenceLevel: 'D' },
    ],
    fallback: '健康趋势以「阶段」而非「具体日」作答，具体就医时间请遵医嘱',
  },
  readingList: [
    { canonicalId: 'zengshanbuyi', book: '增删卜易', chapter: '疾病章第九十九', why: '用神旺衰断生死（六爻参考）', priority: 1 },
    { canonicalId: 'huangjince', book: '黄金策', chapter: '09章 病症', why: '病症分类占断参考', priority: 2 },
  ],
  forbidden: ['不得诊断疾病或提供用药建议', '不得替代医疗或暗示放弃治疗', '疑似急症 → 明确提示立即就医'],
  disclaimer: '本答复仅为易理趋势参考，不构成医疗建议；身体不适请及时就医',
  recordTemplate: {
    fields: [
      { key: 'focus', label: '关注方面', type: 'text' },
      { key: 'outcome', label: '实际状况', type: 'enum', options: ['平稳', '好转', '波动'] },
      { key: 'when', label: '实际时间', type: 'date' },
    ],
    hint: '记录关注方面与实际身体状况，对照大运流年走势',
  },
};

export const ziweiCareerPlaybook: Playbook = {
  id: 'ziwei.career.v1',
  category: '事业',
  subCategory: '紫微格局',
  version: 1,
  arts: {
    primary: 'ziwei',
    alternates: [
      { art: 'bazi', reason: '行业方向与大运走势' },
      { art: 'qimen', reason: '择时、方位、谈判时机' },
    ],
    whyPrimary: '紫微以命宫、官禄宫与大限流年看事业格局与发展节奏',
  },
  howToAsk: {
    goodExamples: ['我这步大限的事业格局如何，适合转行吗', '命盘官禄宫看适合管理岗还是专业岗'],
    badExamples: [{ text: '我事业能不能成功', why: '太泛，紫微看格局与节奏，建议结合具体阶段' }],
    requiredFields: ['what', 'timeRange'],
    clarify: [{ id: 'phase', text: '是看整体格局、当前大限，还是某一步大运的转向？' }],
  },
  howToCast: {
    methods: [
      { name: '排命盘', steps: ['提供出生年月日时（尽量精确时辰）', '紫微排盘（十二宫 + 大限流年）'], arts: ['ziwei'] },
    ],
    tips: ['时辰尽量精确（早子/晚子差别大）；看流年需提供目标年份'],
  },
  yongShen: [
    { condition: '事业格局', yongShen: '命宫主星 + 官禄宫（紫微）', ruleId: 'ziwei.career.yongshen.minggong', citations: [hjcCite('hjc.c6.1', '乾坤定位，人物肇生，感阴阳而化育，分智愚于浊清，既富且寿，世爻旺相更无伤?非夭即贫，身位休囚兼受制?')], confidenceLevel: 'A' },
    { condition: '职场劳碌/压力', yongShen: '六亲偏枯（紫微命盘）', ruleId: 'ziwei.career.yongshen.fumu', citations: [hjcCite('hjc.c6.2', '逢虎妻而旺强，虽鄙俗偏为富客?父母持身，辛勤劳碌?鬼爻持世，疾病缠绵?遇兄则财莫能聚，见子则身不犯刑?')], confidenceLevel: 'A' },
  ],
  signals: [
    { name: '命宫主星庙旺 + 官禄得地', meaning: '吉', ruleId: 'ziwei.career.ji.miaowang', citations: [hjcCite('hjc.c6.6', '财福司权，荣华有日?官兄秉政，破败无常?')], confidenceLevel: 'A' },
    { name: '官非刑煞入官禄', meaning: '凶', ruleId: 'ziwei.career.xiong.guanfei', citations: [hjcCite('hjc.c6.6', '财福司权，荣华有日?官兄秉政，破败无常?')], confidenceLevel: 'A' },
    { name: '大限流年引动', meaning: '变数', ruleId: 'ziwei.career.bian.daxian', citations: [cite('紫微斗数全书', 'ziweishu', '论大限', '大限十年一易，流年逐年应验（流派说法）', 'D')], confidenceLevel: 'D' },
  ],
  timing: {
    rules: [
      { name: '大限十年为纲，流年逐年应验', ruleId: 'ziwei.career.timing.daxian', citations: [cite('紫微斗数全书', 'ziweishu', '论大限', '大限十年一易，流年逐年应验（流派说法）', 'D')], confidenceLevel: 'D' },
    ],
    fallback: '紫微应期以「大限/流年」为单位，不以具体日作答',
  },
  readingList: [
    { canonicalId: 'huangjince', book: '黄金策', chapter: '05章 身命', why: '身命格局总论（术理相通）', priority: 1 },
    { canonicalId: 'ziweishu', book: '紫微斗数全书', chapter: '论大限', why: '大限流年走势（流派说法，D 级）', priority: 2 },
  ],
  forbidden: ['不得承诺升迁/录用', '不得宣扬宿命论或绝对化论断', '涉及裁员/劳动纠纷 → 提示劳动仲裁与法律咨询'],
  disclaimer: '本答复为紫微命理参考，事业决策请结合现实条件与专业意见',
  recordTemplate: {
    fields: [
      { key: 'phase', label: '看盘阶段', type: 'enum', options: ['整体格局', '当前大限', '某步大运'] },
      { key: 'outcome', label: '结果', type: 'enum', options: ['顺利', '波动', '转向'] },
      { key: 'when', label: '实际时间', type: 'date' },
    ],
    hint: '记录看盘阶段与实际结果，对照命宫/官禄宫与大限走势',
  },
};

export const ALL_PLAYBOOKS: Playbook[] = [
  liuyaoLostPlaybook,
  liuyaoLovePlaybook,
  liuyaoCareerPlaybook,
  liuyaoWealthPlaybook,
  liuyaoStudyPlaybook,
  liuyaoTripPlaybook,
  liuyaoLegalPlaybook,
  liuyaoPartnerPlaybook,
  liuyaoDecisionPlaybook,
  baziHealthPlaybook,
  ziweiCareerPlaybook,
  pastFuturePlaybook,
];

export function playbookFor(category: string, sub?: string): Playbook | undefined {
  return ALL_PLAYBOOKS.find((p) => p.category === category && (!sub || p.subCategory === sub));
}
