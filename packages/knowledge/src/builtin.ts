/**
 * 内置知识库：预导入的公有领域原典语料
 *  - 《周易》64 卦卦辞/爻辞（448 段，core 内嵌数据）
 *  - 《增删卜易》（清·野鹤老人，公有领域转录；130 卷章 3565 段）
 *  - 《卜筮正宗》（清·王洪绪，清光绪宏道堂刻本转录；2076 段）
 *  - 《黄金策》（明·刘基题撰，公有领域转录；34 章 3579 段）
 *  - 《易冒》（清·程良玉，公有领域转录；83 章 + 3 序 3349 段）
 *  - 参考工程语料库采纳（scripts/migrate-corpus.mjs 迁移）：滴天髓阐微、渊海子平、三命通会、神峰通考、
 *    紫微斗数全书、大六壬大全、六壬毕法赋、梅花易数、烟波钓叟歌、易传（十翼）、斗数骨髓赋、太微赋、周易注（外编）等
 * 应用启动时自动预导入，无需手动导入；扩充用 scripts/kb-build.mjs / scripts/migrate-corpus.mjs。
 */

import { HEXAGRAM_TEXTS } from '@xuanshu/core';
import type { CorpusSection } from './retriever.js';
import { zengshanbuyiCorpus } from './corpus/zengshanbuyi.js';
import { bushizhengzongCorpus } from './corpus/bushizhengzong.js';
import { huangjinceCorpus } from './corpus/huangjince.js';
import { yimaoCorpus } from './corpus/yimao.js';
import { ditiansuiCorpus } from './corpus/ditiansui.js';
import { biantaCorpus } from './corpus/bianta.js';
import { liurendaquanCorpus } from './corpus/liurendaquan.js';
import { meihuaCorpus } from './corpus/meihua.js';
import { sanmingtonghuiCorpus } from './corpus/sanmingtonghui.js';
import { shenfengtongkaoCorpus } from './corpus/shenfengtongkao.js';
import { suidifuCorpus } from './corpus/suidifu.js';
import { taiweifuCorpus } from './corpus/taiweifu.js';
import { yanbodiaosougeCorpus } from './corpus/yanbodiaosouge.js';
import { yizhuanCorpus } from './corpus/yizhuan.js';
import { yuanhaizipingCorpus } from './corpus/yuanhaiziping.js';
import { zhouyiextCorpus } from './corpus/zhouyiext.js';
import { ziweiquanshuCorpus } from './corpus/ziweiquanshu.js';

export function builtinZhouyiCorpus(): CorpusSection[] {
  const sections: CorpusSection[] = [];
  for (const [name, text] of Object.entries(HEXAGRAM_TEXTS)) {
    sections.push({
      segId: `zhouyi.${name}.guaci`,
      text: text.guaci,
      chapter: `${name}·卦辞`,
      book: '周易',
      canonicalId: 'zhouyi.guaci',
      confidenceLevel: 'A',
      license: '公有领域',
    });
    text.yaoci.forEach((yao, i) => {
      const pos = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][i]!;
      sections.push({
        segId: `zhouyi.${name}.${i + 1}`,
        text: yao,
        chapter: `${name}·${pos}`,
        book: '周易',
        canonicalId: 'zhouyi.yaoci',
        confidenceLevel: 'A',
        license: '公有领域',
      });
    });
  }
  return sections;
}

/** 全量内置语料（启动即预导入；含参考工程语料库采纳部分） */
export function builtinCorpus(): CorpusSection[] {
  return [
    ...builtinZhouyiCorpus(),
    ...zengshanbuyiCorpus,
    ...bushizhengzongCorpus,
    ...huangjinceCorpus,
    ...yimaoCorpus,
    ...ditiansuiCorpus,
    ...biantaCorpus,
    ...liurendaquanCorpus,
    ...meihuaCorpus,
    ...sanmingtonghuiCorpus,
    ...shenfengtongkaoCorpus,
    ...suidifuCorpus,
    ...taiweifuCorpus,
    ...yanbodiaosougeCorpus,
    ...yizhuanCorpus,
    ...yuanhaizipingCorpus,
    ...zhouyiextCorpus,
    ...ziweiquanshuCorpus,
  ];
}

/** 内置语料规模统计 */
export function builtinStats(): { books: string[]; segments: number } {
  const corpus = builtinCorpus();
  return { books: [...new Set(corpus.map((c) => c.book).filter((b): b is string => !!b))], segments: corpus.length };
}
