import { describe, expect, it } from 'vitest';
import { structureById } from '../src/data/structures';
import { cellVolume, classifyPosition, computeNearestNeighborBonds, density, generateRenderedAtoms, particleCount } from '../src/math/crystal';

describe('晶体数学模块', () => {
  it('按边界分量推导位置类型', () => {
    expect(classifyPosition([0, 0, 0])).toBe('vertex');
    expect(classifyPosition([0, 0, 0.5])).toBe('edge');
    expect(classifyPosition([0, 0.5, 0.5])).toBe('face');
    expect(classifyPosition([0.5, 0.5, 0.5])).toBe('interior');
  });

  it('SC、BCC、FCC 粒子数分别为 1、2、4', () => {
    expect(particleCount(structureById('sc-po'))).toBe(1);
    expect(particleCount(structureById('bcc-fe'))).toBe(2);
    expect(particleCount(structureById('fcc-cu'))).toBe(4);
  });

  it('生成 BCC 1×1×1 的八个顶点副本和一个体心原子', () => {
    const atoms = generateRenderedAtoms(structureById('bcc-fe'), 1);
    expect(atoms).toHaveLength(9);
    expect(atoms.filter((atom) => atom.positionType === 'vertex')).toHaveLength(8);
    expect(atoms.filter((atom) => atom.positionType === 'interior')).toHaveLength(1);
  });

  it('正确计算立方晶胞体积', () => {
    const bcc = structureById('bcc-fe');
    expect(cellVolume(bcc)).toBeCloseTo(2.866 ** 3, 10);
  });

  it('α-Fe 理论密度接近室温常见值', () => {
    expect(density(structureById('bcc-fe'))).toBeCloseTo(7.88, 1);
  });
});

describe('最近邻化学键', () => {
  const bondsOf = (id: string, extension: 1 | 2 | 3 = 1) => {
    const structure = structureById(id);
    const atoms = generateRenderedAtoms(structure, extension);
    return { structure, atoms, bonds: computeNearestNeighborBonds(atoms) };
  };

  it('BCC 体心原子与 8 个顶点原子各连一条键，键长 √3·a/2', () => {
    const { structure, atoms, bonds } = bondsOf('bcc-fe');
    expect(bonds).toHaveLength(8);
    const centerIndex = atoms.findIndex((atom) => atom.positionType === 'interior');
    expect(bonds.every((bond) => bond.from === centerIndex || bond.to === centerIndex)).toBe(true);
    for (const bond of bonds) {
      expect(bond.length).toBeCloseTo(Math.sqrt(3) * structure.cell.a / 2, 8);
    }
  });

  it('不会把顶点—顶点（晶胞棱）误认为键', () => {
    const { atoms, bonds } = bondsOf('bcc-fe');
    for (const bond of bonds) {
      const kinds = [atoms[bond.from].positionType, atoms[bond.to].positionType];
      expect(kinds).toContain('interior');
    }
  });

  it('CsCl 体心 Cl⁻ 与 8 个顶点 Cs⁺ 相连', () => {
    const { atoms, bonds } = bondsOf('cscl');
    expect(bonds).toHaveLength(8);
    for (const bond of bonds) {
      expect(new Set([atoms[bond.from].element, atoms[bond.to].element])).toEqual(new Set(['Cs', 'Cl']));
    }
  });

  it('金刚石 1×1×1 有 16 条 C–C 键，键长 √3·a/4', () => {
    const { structure, bonds } = bondsOf('diamond');
    expect(bonds).toHaveLength(16);
    for (const bond of bonds) {
      expect(bond.length).toBeCloseTo(Math.sqrt(3) * structure.cell.a / 4, 8);
    }
  });

  it('NaCl、SC、FCC 的键数与最近邻几何一致', () => {
    expect(bondsOf('nacl').bonds).toHaveLength(54); // 3×3×3 个 a/2 网格点上的相邻对
    expect(bondsOf('sc-po').bonds).toHaveLength(12); // 立方体 12 条棱
    expect(bondsOf('fcc-cu').bonds).toHaveLength(36); // 24 条顶点—面心 + 12 条面心—面心
  });

  it('扩展晶胞后同样成键，且所有键长相等', () => {
    const { bonds } = bondsOf('bcc-fe', 2);
    expect(bonds.length).toBeGreaterThan(8);
    const first = bonds[0].length;
    expect(bonds.every((bond) => Math.abs(bond.length - first) < 1e-8)).toBe(true);
  });

  it('原子少于两个时不产生键', () => {
    expect(computeNearestNeighborBonds([])).toEqual([]);
  });
});
