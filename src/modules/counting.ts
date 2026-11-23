import type { CrystalStructure, PositionType } from '../types/crystal';
import { classifyPosition, contributionFor } from '../math/crystal';

export interface CountingPhase {
  /** 该阶段高亮的位置类型，null 表示汇总阶段 */
  focus: PositionType | null;
  label: string;       // "顶点" / "棱心" / "面心" / "体内" / "总计"
  siteCount: number;   // 唯一位点数
  contribution: number; // 每个位点对晶胞的贡献
  partial: number;     // 该阶段累计数
  formula: string;     // 该阶段显示的累计式
}

const POSITION_LABEL: Record<PositionType, string> = {
  vertex: '顶点',
  edge: '棱心',
  face: '面心',
  interior: '体内',
};

const CONTRIBUTION_FRACTION: Record<PositionType, string> = {
  vertex: '1/8',
  edge: '1/4',
  face: '1/2',
  interior: '1',
};

/**
 * 把结构的 unique sites 按 "位置类型 × 占有率" 展开成分步演示所需的阶段。
 * 每个出现过的位置类型生成一段，最后追加"总计"段。
 */
export function buildCountingPhases(structure: CrystalStructure): CountingPhase[] {
  const bucket = new Map<PositionType, number>(); // 该位置类型的位点"总占有率"
  for (const site of structure.sites) {
    const type = classifyPosition(site.frac);
    bucket.set(type, (bucket.get(type) ?? 0) + site.occupancy);
  }
  const order: PositionType[] = ['vertex', 'edge', 'face', 'interior'];
  const phases: CountingPhase[] = [];
  const partials: string[] = [];
  let total = 0;
  for (const type of order) {
    const siteOcc = bucket.get(type);
    if (!siteOcc) continue;
    const contrib = contributionFor(type);
    // 真实"物理副本数" ≈ 独立 unique sites 在 1×1×1 中生成的等效副本数。
    // 对立方晶胞：顶点=8, 棱心=12, 面心=6, 体内=1 — 用对应贡献的倒数近似。
    const copiesPerSite = Math.round(1 / contrib);
    const copies = Math.round(copiesPerSite * siteOcc);
    const partial = copies * contrib;
    total += partial;
    partials.push(`${copies} × ${CONTRIBUTION_FRACTION[type]}`);
    phases.push({
      focus: type,
      label: POSITION_LABEL[type],
      siteCount: copies,
      contribution: contrib,
      partial,
      formula: partials.join(' + ') + ` = ${formatPartial(total)}`,
    });
  }
  phases.push({
    focus: null,
    label: '总计',
    siteCount: Math.round(total),
    contribution: 1,
    partial: total,
    formula: `${partials.join(' + ')} = ${formatPartial(total)}`,
  });
  return phases;
}

function formatPartial(value: number): string {
  if (Math.abs(value - Math.round(value)) < 1e-6) return String(Math.round(value));
  return value.toFixed(2);
}
