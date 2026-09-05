/**
 * 盘面描述 BoardSpec：plate|grid|table|ring|stack|list
 * 由插件 board() 产出，UI 的 BoardRenderer 按此渲染，保证「盘面 JSON 可复现」。
 */

export type BoardLayout = 'plate' | 'grid' | 'table' | 'ring' | 'stack' | 'list';

export interface BoardCell {
  /** 定位键，如爻序 1-6、宫位地支、九宫格等 */
  key: string;
  label: string;
  /** 主内容（如爻的干支+六亲） */
  content?: string;
  sub?: string;
  /** 状态（用于样式：如动爻/空亡/月破） */
  state?: string[];
  /** 关联规则 id（点击展示） */
  ruleIds?: string[];
  children?: BoardCell[];
}

export interface BoardPanel {
  title: string;
  layout: BoardLayout;
  cells: BoardCell[];
}

export interface BoardSpec {
  art: string;
  title: string;
  configHash: string;
  panels: BoardPanel[];
}

export function makeBoard(art: string, title: string, configHash: string, panels: BoardPanel[]): BoardSpec {
  return { art, title, configHash, panels };
}
