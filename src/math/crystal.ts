import type { CrystalStructure, PositionType, RenderedAtom, RenderedBond } from '../types/crystal';

const EPSILON = 1e-8;

export function classifyPosition(frac: [number, number, number]): PositionType {
  const boundaryCount = frac.filter((value) => Math.abs(value - Math.round(value)) < EPSILON).length;
  if (boundaryCount === 3) return 'vertex';
  if (boundaryCount === 2) return 'edge';
  if (boundaryCount === 1) return 'face';
  return 'interior';
}

export function contributionFor(position: PositionType): number {
  return { vertex: 1 / 8, edge: 1 / 4, face: 1 / 2, interior: 1 }[position];
}

function axisPositions(value: number, extension: number): number[] {
  if (Math.abs(value) < EPSILON) {
    return Array.from({ length: extension + 1 }, (_, index) => index);
  }
  return Array.from({ length: extension }, (_, index) => index + value);
}

export function generateRenderedAtoms(structure: CrystalStructure, extension: 1 | 2 | 3): RenderedAtom[] {
  const atoms: RenderedAtom[] = [];
  for (const site of structure.sites) {
    const xs = axisPositions(site.frac[0], extension);
    const ys = axisPositions(site.frac[1], extension);
    const zs = axisPositions(site.frac[2], extension);
    const equivalentCopies = xs.length * ys.length * zs.length;
    for (const x of xs) for (const y of ys) for (const z of zs) {
      const positionType = classifyPosition([x, y, z]);
      atoms.push({
        key: `${site.id}@${x},${y},${z}`,
        siteId: site.id,
        element: site.element,
        frac: [x, y, z],
        positionType,
        contribution: contributionFor(positionType),
        cart: [x * structure.cell.a, y * structure.cell.b, z * structure.cell.c],
        equivalentCopies,
      });
    }
  }
  return atoms;
}

/**
 * 在已渲染的原子之间找出最近邻键。
 *
 * 规则：取所有原子对中的最短间距 dMin，间距 ≤ dMin × (1 + tolerance) 的原子对视为成键。
 * 对本项目的立方晶体，成键距离在各模型内是唯一的，且与次近邻间距相差 >10%，因此
 * 5% 的容差既能容纳浮点误差，又不会误连次近邻：
 *   - BCC / CsCl：体心原子 ↔ 8 个顶点原子（√3·a/2）
 *   - 金刚石 / ZnS / CaF₂：√3·a/4
 *   - NaCl / SC：a/2 或 a（沿棱）
 *   - FCC：面心 ↔ 顶点与相邻面心（√2·a/2）
 * 只在传入的原子之间成键，因此 1×1×1 时不会产生伸出晶胞之外的键。
 */
export function computeNearestNeighborBonds(atoms: RenderedAtom[], tolerance = 0.05): RenderedBond[] {
  const distance = (a: RenderedAtom, b: RenderedAtom) =>
    Math.hypot(a.cart[0] - b.cart[0], a.cart[1] - b.cart[1], a.cart[2] - b.cart[2]);

  let shortest = Infinity;
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const d = distance(atoms[i], atoms[j]);
      if (d > EPSILON && d < shortest) shortest = d;
    }
  }
  if (!Number.isFinite(shortest)) return [];

  const limit = shortest * (1 + tolerance);
  const bonds: RenderedBond[] = [];
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const d = distance(atoms[i], atoms[j]);
      if (d > EPSILON && d <= limit) bonds.push({ from: i, to: j, length: d });
    }
  }
  return bonds;
}

export function particleCount(structure: CrystalStructure): number {
  return structure.sites.reduce((sum, site) => sum + site.occupancy, 0);
}

export function cellVolume(structure: CrystalStructure): number {
  const { a, b, c, alpha, beta, gamma } = structure.cell;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const [ca, cb, cg] = [alpha, beta, gamma].map((angle) => Math.cos(toRadians(angle)));
  return a * b * c * Math.sqrt(1 + 2 * ca * cb * cg - ca ** 2 - cb ** 2 - cg ** 2);
}

export function density(structure: CrystalStructure): number {
  const avogadro = 6.02214076e23;
  const volumeCm3 = cellVolume(structure) * 1e-24;
  return structure.Z * structure.atomicMass / (avogadro * volumeCm3);
}

export function formatFraction(value: number): string {
  const normalized = value - Math.floor(value);
  if (Math.abs(normalized) < EPSILON) return String(Math.round(value));
  if (Math.abs(normalized - 0.5) < EPSILON) return `${Math.floor(value) ? `${Math.floor(value)}+` : ''}1/2`;
  if (Math.abs(normalized - 0.25) < EPSILON) return `${Math.floor(value) ? `${Math.floor(value)}+` : ''}1/4`;
  if (Math.abs(normalized - 0.75) < EPSILON) return `${Math.floor(value) ? `${Math.floor(value)}+` : ''}3/4`;
  return value.toFixed(3);
}
