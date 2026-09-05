/**
 * playbook 完整性校验（v5 §14.1 verify-playbook）：
 * 每条 yongShen/signals/locating/timing 必须带 ruleId + citations + confidenceLevel
 */

import { ALL_PLAYBOOKS } from '../src/playbooks.ts';

const LEVELS = ['A', 'B', 'C', 'D', 'E'];

function main() {
  let errors = 0;
  for (const pb of ALL_PLAYBOOKS) {
    for (const [section, items] of Object.entries({
      yongShen: pb.yongShen,
      signals: pb.signals,
      locating: pb.locating ? [pb.locating] : [],
      timing: pb.timing.rules,
    })) {
      for (const item of items) {
        const r = item;
        if (!r.ruleId) {
          console.error(`✗ ${pb.id} ${section} 缺 ruleId`);
          errors++;
        }
        if (!r.citations || r.citations.length === 0) {
          console.error(`✗ ${pb.id} ${section} ${r.ruleId ?? r.name} 缺 citations`);
          errors++;
        }
        if (!r.confidenceLevel || !LEVELS.includes(r.confidenceLevel)) {
          console.error(`✗ ${pb.id} ${section} ${r.ruleId ?? r.name} 缺/非法 confidenceLevel`);
          errors++;
        }
      }
    }
  }
  if (errors > 0) {
    console.error(`\nverify-playbook 失败：${errors} 处问题`);
    process.exit(1);
  }
  console.log(`✓ verify-playbook 通过：${ALL_PLAYBOOKS.length} 张 playbook 全部合规`);
}

main();
