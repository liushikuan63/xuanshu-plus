/**
 * 离线黄历查询。
 *
 * 传统历法字段由 lunar-javascript 提供，本模块只负责输入校验、稳定结构与白话摘要。
 * 结果属于民俗文化参考，不应替代医疗、法律、投资等专业判断。
 */
import { Solar } from 'lunar-javascript';

interface AlmanacLunar {
  toString(): string;
  getMonthInChinese(): string;
  getDayInChinese(): string;
  getYearInGanZhiByLiChun(): string;
  getMonthInGanZhi(): string;
  getDayInGanZhi(): string;
  getYearShengXiao(): string;
  getZhiXing(): string;
  getDayTianShen(): string;
  getDayYi(): string[];
  getDayJi(): string[];
  getDayChongDesc(): string;
  getDaySha(): string;
  getDayJiShen(): string[];
  getDayXiongSha(): string[];
  getPengZuGan(): string;
  getPengZuZhi(): string;
  getJieQi(): string;
  getWuHou(): string;
  getHou(): string;
  getFestivals(): string[];
  getOtherFestivals(): string[];
}

interface AlmanacSolar {
  getLunar(): AlmanacLunar;
  getXingZuo(): string;
}

export interface AlmanacDay {
  date: string;
  week: string;
  lunarText: string;
  lunarDate: string;
  yearGanzhi: string;
  monthGanzhi: string;
  dayGanzhi: string;
  zodiac: string;
  constellation: string;
  jianChu: string;
  dayGod: string;
  yi: string[];
  ji: string[];
  clash: string;
  sha: string;
  luckyGods: string[];
  unluckyGods: string[];
  pengZu: string[];
  solarTerm: string;
  wuHou: string;
  hou: string;
  festivals: string[];
}

function validDate(year: number, month: number, day: number): boolean {
  if (![year, month, day].every(Number.isInteger) || year < 1900 || year > 2100) return false;
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year
    && value.getUTCMonth() === month - 1
    && value.getUTCDate() === day;
}

function dateText(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 查询某个公历日的黄历字段。 */
export function almanacOf(year: number, month: number, day: number): AlmanacDay {
  if (!validDate(year, month, day)) throw new RangeError(`无效公历日期：${year}-${month}-${day}`);

  // lunar-javascript 的声明文件漏掉黄历扩展方法，运行时对象包含这些稳定 API。
  const solar = Solar.fromYmd(year, month, day) as unknown as AlmanacSolar;
  const lunar = solar.getLunar();
  const festivals = [...(lunar.getFestivals() ?? []), ...(lunar.getOtherFestivals() ?? [])];
  return {
    date: dateText(year, month, day),
    week: `星期${['日', '一', '二', '三', '四', '五', '六'][new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}`,
    lunarText: lunar.toString(),
    lunarDate: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    yearGanzhi: lunar.getYearInGanZhiByLiChun() ?? '',
    monthGanzhi: lunar.getMonthInGanZhi() ?? '',
    dayGanzhi: lunar.getDayInGanZhi() ?? '',
    zodiac: lunar.getYearShengXiao() ?? '',
    constellation: `${solar.getXingZuo() ?? ''}座`,
    jianChu: lunar.getZhiXing() ?? '',
    dayGod: lunar.getDayTianShen() ?? '',
    yi: lunar.getDayYi() ?? [],
    ji: lunar.getDayJi() ?? [],
    clash: lunar.getDayChongDesc() ?? '',
    sha: lunar.getDaySha() ?? '',
    luckyGods: lunar.getDayJiShen() ?? [],
    unluckyGods: lunar.getDayXiongSha() ?? [],
    pengZu: [lunar.getPengZuGan() ?? '', lunar.getPengZuZhi() ?? ''].filter(Boolean),
    solarTerm: lunar.getJieQi() || '',
    wuHou: lunar.getWuHou() ?? '',
    hou: lunar.getHou() ?? '',
    festivals,
  };
}

/** 查询整月，返回值始终按公历日升序排列。 */
export function almanacMonth(year: number, month: number): AlmanacDay[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 1900 || year > 2100 || month < 1 || month > 12) {
    throw new RangeError(`无效公历月份：${year}-${month}`);
  }
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => almanacOf(year, month, index + 1));
}

/** 供列表和移动端首屏使用的简短摘要。 */
export function almanacSummary(day: AlmanacDay): string {
  const yi = day.yi.slice(0, 3).join('、') || '无特别宜事';
  const ji = day.ji.slice(0, 3).join('、') || '无特别忌事';
  const markers = [
    `农历${day.lunarDate}`,
    `${day.dayGanzhi}日`,
    day.solarTerm ? `节气${day.solarTerm}` : '',
    day.festivals.length ? day.festivals.slice(0, 2).join('、') : '',
  ].filter(Boolean);
  return `${markers.join(' · ')}；宜${yi}，忌${ji}。`;
}
