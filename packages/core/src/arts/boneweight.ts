import { Solar } from 'lunar-javascript';

export const YEAR_BONE: Readonly<Record<string, number>> = {
  甲子: 1.2, 乙丑: 0.9, 丙寅: 0.6, 丁卯: 0.7, 戊辰: 1.2, 己巳: 0.5, 庚午: 0.9, 辛未: 0.8, 壬申: 0.7, 癸酉: 0.8,
  甲戌: 1.5, 乙亥: 0.9, 丙子: 1.6, 丁丑: 0.8, 戊寅: 0.8, 己卯: 1.9, 庚辰: 1.2, 辛巳: 0.6, 壬午: 0.8, 癸未: 0.7,
  甲申: 0.5, 乙酉: 1.5, 丙戌: 0.6, 丁亥: 1.6, 戊子: 1.5, 己丑: 0.7, 庚寅: 0.9, 辛卯: 1.2, 壬辰: 1.0, 癸巳: 0.7,
  甲午: 1.5, 乙未: 0.6, 丙申: 0.5, 丁酉: 1.4, 戊戌: 1.4, 己亥: 0.9, 庚子: 0.7, 辛丑: 0.7, 壬寅: 0.9, 癸卯: 1.2,
  甲辰: 0.8, 乙巳: 0.7, 丙午: 1.3, 丁未: 0.5, 戊申: 1.4, 己酉: 0.5, 庚戌: 0.9, 辛亥: 1.7, 壬子: 0.5, 癸丑: 0.7,
  甲寅: 1.2, 乙卯: 0.8, 丙辰: 0.8, 丁巳: 0.6, 戊午: 1.9, 己未: 0.6, 庚申: 0.8, 辛酉: 1.6, 壬戌: 1.0, 癸亥: 0.6,
};

export const MONTH_BONE = [0.6, 0.7, 1.8, 0.9, 0.5, 1.6, 0.9, 1.5, 1.8, 0.8, 0.9, 0.5] as const;

export const DAY_BONE = [
  0.5, 1.0, 0.8, 1.5, 1.6, 1.5, 0.8, 1.6, 0.8, 1.6,
  0.9, 1.7, 0.8, 1.7, 1.0, 0.8, 0.9, 1.8, 0.5, 1.5,
  1.0, 0.9, 0.8, 0.9, 1.5, 1.8, 0.7, 0.8, 1.6, 0.6,
] as const;

export const HOUR_BONE = [1.6, 0.6, 0.7, 1.0, 0.9, 1.6, 1.0, 0.8, 0.8, 0.9, 0.6, 0.6] as const;

export interface BoneSong {
  poem: string;
  plain: string;
}

export const BONE_SONG: Readonly<Record<string, BoneSong>> = {
  '2.1': { poem: '短命非业谓大凶，平生灾难事重重；凶祸频临限逆境，终世困苦事不成。', plain: '基础较薄，早年多波折，宜安分守己、多积德行善，中年后略转。' },
  '2.2': { poem: '身寒骨冷苦伶仃，此命推来行乞人；劳劳碌碌无度日，中年打拱过平生。', plain: '辛苦劳碌，宜早定业、勤俭持家，晚景渐安。' },
  '2.3': { poem: '此命推来骨轻轻，求谋做事事难成；妻儿兄弟应难许，别处他乡作散人。', plain: '谋事多阻、六亲助力少，宜外出发展、以技艺立身。' },
  '2.4': { poem: '此命推来福禄无，门庭困苦总难荣；六亲骨肉皆无靠，流到他乡作老人。', plain: '福禄不显，宜自力更生、广结善缘，中年后渐稳。' },
  '2.5': { poem: '此命推来祖业微，门庭营度似希奇；六亲骨肉如水炭，一世勤劳自把持。', plain: '祖业薄弱、亲缘平淡，但勤恳可以自立。' },
  '2.6': { poem: '平生一路苦中求，独自营谋事不休；离祖出门宜早计，晚来衣禄自无忧。', plain: '早年劳苦，宜离家发展，晚景有保障。' },
  '2.7': { poem: '一生做事少商量，难靠祖宗作主张；独马单枪空作去，早年晚岁总无长。', plain: '自主性强但少助力，宜稳扎稳打、避免独断。' },
  '2.8': { poem: '一生作事似飘蓬，祖宗产业在梦中；若不过房并改姓，也当移徒二三通。', plain: '变动较多，宜随势而迁，守常较难。' },
  '2.9': { poem: '初年运限未曾亨，纵有功名在后成；须过四旬方可上，移居改姓使为良。', plain: '早年平平，中年后渐起，宜择地发展。' },
  '3.0': { poem: '劳劳碌碌苦中求，东走西奔何日休；若能终身勤与俭，老来稍可免忧愁。', plain: '一生劳碌，勤俭可保晚景少忧。' },
  '3.1': { poem: '忙忙碌碌苦中求，何日云开见日头；难得祖基家可立，中年衣食渐无忧。', plain: '先苦后甜，中年以后独立成家、衣食渐足。' },
  '3.2': { poem: '初年运蹇事难谋，渐有财源如水流；到得中年衣食旺，那时名利一齐收。', plain: '早年蹇滞，中年财源渐旺。' },
  '3.3': { poem: '早年做事事难成，百计徒劳枉费心；半世自如流水去，后来运到始得金。', plain: '前半生波折，后半生转机较明显，宜坚持。' },
  '3.4': { poem: '此命福气果如何，僧道门中衣禄多；离祖出家方得妙，终朝拜佛念弥陀。', plain: '偏向淡泊清静，宜从事文化、研究或安静之业。' },
  '3.5': { poem: '生平福量不周全，祖业根基觉少传；营事生涯宜守旧，时来衣食胜从前。', plain: '宜守成不宜冒进，时机到来时境遇转好。' },
  '3.6': { poem: '不须劳碌过平生，独自成家福不轻；早有福星常照命，任君行去百般成。', plain: '自立成家、福星照命，整体较为顺遂。' },
  '3.7': { poem: '此命般般事不成，弟兄少力自孤成；虽然祖业须微有，来得明时去不明。', plain: '独立孤成、祖业不多，财来财去宜重视理财。' },
  '3.8': { poem: '一身骨肉最清高，早入簧门姓氏标；待到年将三十六，蓝衫脱去换红袍。', plain: '天资聪颖，学业有成，中年前后职位或名望可提升。' },
  '3.9': { poem: '此命终身运不通，劳劳作事尽皆空；苦心竭力成家计，到得那时在梦中。', plain: '耗费心力较多，宜看淡得失、保重身体。' },
  '4.0': { poem: '平生衣禄是绵长，件件心中自主张；前面风霜多受过，后来必定享安康。', plain: '虽经风霜，但中晚年较安稳，自主性强。' },
  '4.1': { poem: '此命推来事不同，为人能干异凡庸；中年还有逍遥福，不比前年运未通。', plain: '能干过人，中年以后境遇渐开。' },
  '4.2': { poem: '得宽怀处且宽怀，何用双眉皱不开；若使中年命运济，那时名利一齐来。', plain: '心宽则福至，中年遇机遇时更易有所收获。' },
  '4.3': { poem: '为人心性最聪明，作事轩昂近贵人；衣禄一生天数定，不须劳碌过平生。', plain: '聪明干练、贵人缘较好，生活相对安稳。' },
  '4.4': { poem: '来事由天莫苦求，须知福禄胜前途；当年财帛难如意，晚景欣然便不忧。', plain: '早年财帛平平，晚景较安稳。' },
  '4.5': { poem: '福中取贵格求真，明敏才华志自伸；福禄寿全家道吉，桂兰毓秀晚荣臻。', plain: '才华与福气兼备，晚景较佳、家道有成。' },
  '4.6': { poem: '东西南北尽皆通，出姓移居更觉隆；衣禄无穷无数定，中年晚景一般同。', plain: '四方皆宜，迁居或拓展环境可能更顺。' },
  '4.7': { poem: '此命推来旺末年，妻荣子贵自怡然；平生原有滔滔福，可有财源如水源。', plain: '晚年渐旺，家庭与财务基础较稳。' },
  '4.8': { poem: '幼年运道未曾亨，若是蹉跎再不兴；兄弟六亲皆无靠，一身事业晚年成。', plain: '早年不顺、助力较少，事业往往较晚成熟。' },
  '4.9': { poem: '此命推来福不轻，自成自立显门庭；从来富贵人钦敬，使婢差奴过一生。', plain: '自立有成、受人敬重，整体福禄不轻。' },
  '5.0': { poem: '为利为名终日劳，中年福禄也多遭；老来自有财星照，不比前番目下高。', plain: '中年劳碌，晚年财务境遇渐好。' },
  '5.1': { poem: '一世荣华事事通，不须劳碌自亨通；兄弟叔侄皆如意，家业成时福禄宏。', plain: '整体顺遂，家业与亲缘基础较好。' },
  '5.2': { poem: '一世亨通事事能，不须劳苦自然宁；宗族欣然心皆好，家业丰亨自称心。', plain: '一生较为亨通，家业与宗族关系安稳。' },
  '5.3': { poem: '此格推来气象真，兴家发达在其中；一生福禄安排定，却是人间一富翁。', plain: '兴家立业的基础较好，物质生活相对丰足。' },
  '5.4': { poem: '此命推来厚且清，诗书满腹看功成；丰衣足食自然稳，正是人间有福人。', plain: '厚积而有清名，适合以学识与长期积累成事。' },
  '5.5': { poem: '走了马来了羊，早把甘霖降后场；晚年衣禄皆足够，行善之家福泽长。', plain: '运途逐渐打开，晚景较为安稳。' },
  '5.6': { poem: '此命推来福禄盈，必逢贵人和得成；兄弟六亲皆有力，家中祥瑞满门庭。', plain: '福禄较足，容易得到亲友或贵人助力。' },
  '5.7': { poem: '福禄丰盈万事全，一生荣耀显门楣；名成利就多如意，衣禄丰盈胜往年。', plain: '福禄基础较好，名利与生活条件有提升空间。' },
  '5.8': { poem: '平生福禄自然来，名利兼全福寿偕；雁塔题名为贵客，紫袍金带走金阶。', plain: '福禄较厚，传统上视为名望与事业俱佳。' },
  '5.9': { poem: '细推此格妙更奇，四海扬名福寿齐；起居安稳多如意，金玉满堂乐有余。', plain: '传统上视为上等格局，生活与名望较佳。' },
  '6.0': { poem: '一朝金榜快题名，显祖荣宗立大功；衣食定然原裕足，田园财帛更丰盈。', plain: '传统上象征功名与家业丰足。' },
  '6.1': { poem: '不做朝中金榜客，定为世上大财翁；聪明天赋经书熟，名显高科自是荣。', plain: '聪明有才，传统上视为事业或财富有成。' },
  '6.2': { poem: '此命生来福不穷，读书必定显亲宗；紫衣金带为卿相，富贵荣华皆可同。', plain: '传统上视为福厚，学业与事业潜力较好。' },
  '6.3': { poem: '命主为官福禄长，得来富贵实非常；名题金塔传金榜，定中高科天下扬。', plain: '传统上象征官禄与名望，但仍需结合现实努力。' },
  '6.4': { poem: '此格威权不可当，紫袍金带尘高堂；荣华富贵谁能及，万古留名姓氏扬。', plain: '传统上象征威望与成就，宜以文化参考理解。' },
  '6.5': { poem: '细推此命福不轻，安国富民乐太平；一生衣禄皆无忧，人间一线福寿翁。', plain: '传统上视为福分较重、生活安稳。' },
  '6.6': { poem: '此格人间一福人，堆金积玉满堂春；从来富贵由天定，正笏垂绅谒圣君。', plain: '传统上视为富贵格局，不作为现实结果保证。' },
  '6.7': { poem: '此命生来福自宏，田园家业最高隆；平生衣禄丰盈足，一世荣华万事通。', plain: '传统上视为家业丰厚、生活顺遂。' },
  '6.8': { poem: '富贵由天莫苦求，万金家计不须谋；十年不比前番事，祖业根基水上舟。', plain: '传统上视为家计殷实，也提醒顺势而为。' },
  '6.9': { poem: '君是人间福禄星，一生富贵众人钦；纵然福禄由天定，安享荣华过一生。', plain: '传统上视为福禄较厚，现实仍取决于个人选择与环境。' },
  '7.0': { poem: '此命推来福不轻，何须愁虑苦劳心；荣华富贵已天定，正笏垂绅拜紫宸。', plain: '传统上视为福重，宜保持平常心。' },
  '7.1': { poem: '此命生成大不同，公侯卿相在其中；一生自有逍遥福，富贵荣华极品隆。', plain: '传统上视为贵格，只作民俗文化参考。' },
  '7.2': { poem: '此格世界罕有生，十代积善产此人；天上紫微来照命，统治万民乐太平。', plain: '传统上视为极重骨格，只作民俗文化参考。' },
};

export interface BoneWeightPart {
  name: string;
  liang: number;
  label: string;
}

export interface BoneWeightResult {
  totalLiang: number;
  label: string;
  lunarDate: string;
  yearGanzhi: string;
  hourBranch: string;
  parts: BoneWeightPart[];
  poem: string;
  plain: string;
  disclaimer: string;
}

function liangText(value: number): string {
  const liang = Math.floor(value);
  const qian = Math.round((value - liang) * 10);
  return qian === 0 ? `${liang}两` : `${liang}两${qian}钱`;
}

function validDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
    && year >= 1900 && year <= 2100
    && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function computeBoneWeight(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): BoneWeightResult {
  if (!validDate(year, month, day)) throw new RangeError(`无效公历日期：${year}-${month}-${day}`);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new RangeError(`无效时间：${hour}:${minute}`);
  }

  const lunar = Solar.fromYmdHms(year, month, day, hour, minute, 0).getLunar();
  const yearGanzhi = lunar.getYearInGanZhi();
  const lunarMonth = Math.abs(lunar.getMonth());
  const lunarDay = Math.abs(lunar.getDay());
  const hourIndex = Math.floor((hour + 1) / 2) % 12;
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  const rawParts = [
    { name: `年（${yearGanzhi}）`, liang: YEAR_BONE[yearGanzhi] },
    { name: `月（农历${lunar.getMonthInChinese()}月）`, liang: MONTH_BONE[lunarMonth - 1] },
    { name: `日（农历${lunar.getDayInChinese()}）`, liang: DAY_BONE[lunarDay - 1] },
    { name: `时（${branches[hourIndex]}时）`, liang: HOUR_BONE[hourIndex] },
  ];
  if (rawParts.some((part) => part.liang === undefined)) throw new RangeError('农历日期超出称骨表范围');

  const parts = rawParts.map((part) => ({ ...part, liang: part.liang!, label: liangText(part.liang!) }));
  const totalLiang = Math.round(parts.reduce((sum, part) => sum + part.liang, 0) * 10) / 10;
  const song = BONE_SONG[totalLiang.toFixed(1)] ?? {
    poem: '骨重超出常见歌诀范围。',
    plain: '该组合较少见，暂不提供未经校验的扩展批语。',
  };

  return {
    totalLiang,
    label: liangText(totalLiang),
    lunarDate: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    yearGanzhi,
    hourBranch: branches[hourIndex]!,
    parts,
    poem: song.poem,
    plain: song.plain,
    disclaimer: '称骨歌属于民俗文化资料，仅供研究与娱乐，不构成对个人命运的确定性判断。',
  };
}
