import { describe, expect, it } from 'vitest';
import { structureById } from '../src/data/structures';
import { cellVolume, classifyPosition, density, generateRenderedAtoms, particleCount } from '../src/math/crystal';

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
