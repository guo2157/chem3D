import type { CrystalStructure } from '../types/crystal';

/**
 * Cubic crystal structures organised for Chinese high-school / introductory
 * crystallography teaching. Fractional coordinates follow conventional cubic
 * settings. All lattice parameters use ångströms.
 */
export const structures: CrystalStructure[] = [
  // ============== 常见离子/共价立方晶体 ==============
  {
    id: 'nacl',
    version: '1.0.0',
    name: '氯化钠（NaCl）',
    shortName: '氯化钠',
    formula: 'NaCl',
    aliases: ['氯化钠', 'NaCl', '食盐', '岩盐', 'rocksalt'],
    Z: 4,
    category: 'ionic',
    crystalSystem: 'cubic',
    cell: { a: 5.64, b: 5.64, c: 5.64, alpha: 90, beta: 90, gamma: 90, lengthUnit: 'angstrom' },
    sites: [
      // Na⁺ FCC 子格
      { id: 'Na1', element: 'Na', frac: [0, 0, 0], occupancy: 1 },
      { id: 'Na2', element: 'Na', frac: [0.5, 0.5, 0], occupancy: 1 },
      { id: 'Na3', element: 'Na', frac: [0.5, 0, 0.5], occupancy: 1 },
      { id: 'Na4', element: 'Na', frac: [0, 0.5, 0.5], occupancy: 1 },
      // Cl⁻ FCC 子格（整体平移 1/2 a）
      { id: 'Cl1', element: 'Cl', frac: [0.5, 0, 0], occupancy: 1 },
      { id: 'Cl2', element: 'Cl', frac: [0, 0.5, 0], occupancy: 1 },
      { id: 'Cl3', element: 'Cl', frac: [0, 0, 0.5], occupancy: 1 },
      { id: 'Cl4', element: 'Cl', frac: [0.5, 0.5, 0.5], occupancy: 1 },
    ],
    atomicMass: 58.44,
    coordinationNumber: 6,
    packingEfficiency: 74,
    teaching: { summary: 'Na⁺ 与 Cl⁻ 相互穿插的面心立方（NaCl 型）。', notes: ['Na⁺、Cl⁻ 配位数均为 6。', '每个晶胞含 4 个 Na⁺、4 个 Cl⁻。'] },
    metadata: { status: 'verified', source: '人教版《物质结构与性质》离子晶体', notes: '室温参数 a ≈ 5.640 Å（Fm-3m）。' },
  },
  {
    id: 'cscl',
    version: '1.0.0',
    name: '氯化铯（CsCl）',
    shortName: '氯化铯',
    formula: 'CsCl',
    aliases: ['氯化铯', 'CsCl'],
    Z: 1,
    category: 'ionic',
    crystalSystem: 'cubic',
    cell: { a: 4.123, b: 4.123, c: 4.123, alpha: 90, beta: 90, gamma: 90, lengthUnit: 'angstrom' },
    sites: [
      { id: 'Cs1', element: 'Cs', frac: [0, 0, 0], occupancy: 1 },
      { id: 'Cl1', element: 'Cl', frac: [0.5, 0.5, 0.5], occupancy: 1 },
    ],
    atomicMass: 168.36,
    coordinationNumber: 8,
    packingEfficiency: 68,
    teaching: { summary: 'Cs⁺ 占顶点，Cl⁻ 占体心（互为简单立方子格）。', notes: ['Cs⁺、Cl⁻ 配位数均为 8。', '每个晶胞含 1 个 Cs⁺、1 个 Cl⁻。'] },
    metadata: { status: 'verified', source: '人教版《物质结构与性质》离子晶体', notes: 'CsCl 型（Pm-3m），a ≈ 4.12 Å。' },
  },
  {
    id: 'diamond',
    version: '1.0.0',
    name: '金刚石（C）',
    shortName: '金刚石',
    formula: 'C',
    aliases: ['金刚石', '钻石', '碳', 'C', 'diamond'],
    Z: 8,
    category: 'covalent',
    crystalSystem: 'cubic',
    cell: { a: 3.567, b: 3.567, c: 3.567, alpha: 90, beta: 90, gamma: 90, lengthUnit: 'angstrom' },
    sites: [
      // FCC 子格
      { id: 'C1', element: 'C', frac: [0, 0, 0], occupancy: 1 },
      { id: 'C2', element: 'C', frac: [0.5, 0.5, 0], occupancy: 1 },
      { id: 'C3', element: 'C', frac: [0.5, 0, 0.5], occupancy: 1 },
      { id: 'C4', element: 'C', frac: [0, 0.5, 0.5], occupancy: 1 },
      // 四面体空隙（整体位移 1/4,1/4,1/4）
      { id: 'C5', element: 'C', frac: [0.25, 0.25, 0.25], occupancy: 1 },
      { id: 'C6', element: 'C', frac: [0.75, 0.75, 0.25], occupancy: 1 },
      { id: 'C7', element: 'C', frac: [0.75, 0.25, 0.75], occupancy: 1 },
      { id: 'C8', element: 'C', frac: [0.25, 0.75, 0.75], occupancy: 1 },
    ],
    atomicMass: 12.011,
    coordinationNumber: 4,
    packingEfficiency: 34,
    teaching: {
      summary: '每个 C 原子以 sp³ 杂化与周围 4 个 C 形成正四面体共价网络。',
      notes: ['配位数 4，一个晶胞含 8 个 C 原子。', 'C–C 键长 ≈ √3·a/4 ≈ 1.54 Å。'],
    },
    metadata: { status: 'verified', source: '人教版《物质结构与性质》共价晶体', notes: '金刚石型（Fd-3m），a ≈ 3.567 Å。' },
  },
  {
    id: 'caf2',
    version: '1.0.0',
    name: '氟化钙（CaF₂，萤石型）',
    shortName: '萤石（CaF₂）',
    formula: 'CaF2',
    aliases: ['氟化钙', '萤石', 'CaF2', '氯化钙', '氯化钙（示意）', 'fluorite', 'AB2'],
    Z: 4,
    category: 'ionic',
    crystalSystem: 'cubic',
    cell: { a: 5.463, b: 5.463, c: 5.463, alpha: 90, beta: 90, gamma: 90, lengthUnit: 'angstrom' },
    sites: [
      // Ca²⁺ FCC
      { id: 'Ca1', element: 'Ca', frac: [0, 0, 0], occupancy: 1 },
      { id: 'Ca2', element: 'Ca', frac: [0.5, 0.5, 0], occupancy: 1 },
      { id: 'Ca3', element: 'Ca', frac: [0.5, 0, 0.5], occupancy: 1 },
      { id: 'Ca4', element: 'Ca', frac: [0, 0.5, 0.5], occupancy: 1 },
      // F⁻ 全部正四面体空隙
      { id: 'F1', element: 'F', frac: [0.25, 0.25, 0.25], occupancy: 1 },
      { id: 'F2', element: 'F', frac: [0.75, 0.25, 0.25], occupancy: 1 },
      { id: 'F3', element: 'F', frac: [0.25, 0.75, 0.25], occupancy: 1 },
      { id: 'F4', element: 'F', frac: [0.25, 0.25, 0.75], occupancy: 1 },
      { id: 'F5', element: 'F', frac: [0.75, 0.75, 0.25], occupancy: 1 },
      { id: 'F6', element: 'F', frac: [0.75, 0.25, 0.75], occupancy: 1 },
      { id: 'F7', element: 'F', frac: [0.25, 0.75, 0.75], occupancy: 1 },
      { id: 'F8', element: 'F', frac: [0.75, 0.75, 0.75], occupancy: 1 },
    ],
    atomicMass: 78.07,
    coordinationNumber: 8,
    packingEfficiency: 65,
    teaching: {
      summary: 'Ca²⁺ 构成面心立方，F⁻ 填入全部正四面体空隙。',
      notes: [
        'Ca²⁺ 配位数 8，F⁻ 配位数 4，离子比 1:2。',
        '注意：CaCl₂ 自身是正交晶系；教学中常用萤石（CaF₂）演示 AB₂ 型立方离子晶体结构。',
      ],
    },
    metadata: { status: 'verified', source: '人教版《物质结构与性质》离子晶体', notes: '萤石型（Fm-3m），a ≈ 5.463 Å。' },
  },
  {
    id: 'zns',
    version: '1.0.0',
    name: '闪锌矿（ZnS）',
    shortName: '闪锌矿',
    formula: 'ZnS',
    aliases: ['闪锌矿', '硫化锌', 'ZnS', 'sphalerite', 'zinc blende'],
    Z: 4,
    category: 'covalent',
    crystalSystem: 'cubic',
    cell: { a: 5.41, b: 5.41, c: 5.41, alpha: 90, beta: 90, gamma: 90, lengthUnit: 'angstrom' },
    sites: [
      { id: 'Zn1', element: 'Zn', frac: [0, 0, 0], occupancy: 1 },
      { id: 'Zn2', element: 'Zn', frac: [0.5, 0.5, 0], occupancy: 1 },
      { id: 'Zn3', element: 'Zn', frac: [0.5, 0, 0.5], occupancy: 1 },
      { id: 'Zn4', element: 'Zn', frac: [0, 0.5, 0.5], occupancy: 1 },
      { id: 'S1', element: 'S', frac: [0.25, 0.25, 0.25], occupancy: 1 },
      { id: 'S2', element: 'S', frac: [0.75, 0.75, 0.25], occupancy: 1 },
      { id: 'S3', element: 'S', frac: [0.75, 0.25, 0.75], occupancy: 1 },
      { id: 'S4', element: 'S', frac: [0.25, 0.75, 0.75], occupancy: 1 },
    ],
    atomicMass: 97.47,
    coordinationNumber: 4,
    packingEfficiency: 34,
    teaching: { summary: 'Zn、S 各自构成面心立方，相互占据对方的正四面体空隙。', notes: ['Zn、S 配位数均为 4。', '每个晶胞含 4 个 Zn、4 个 S。'] },
    metadata: { status: 'verified', source: '《无机化学》共价晶体章节', notes: '立方闪锌矿型（F-43m），a ≈ 5.410 Å。' },
  },

  // ============== 基础金属晶体与点阵模型 ==============
  {
    id: 'sc-po',
    version: '1.0.0',
    name: '简单立方（Po）',
    shortName: '简单立方',
    formula: 'Po',
    aliases: ['简单立方', 'Po', 'simple cubic', 'SC'],
    Z: 1,
    category: 'basic-lattice',
    crystalSystem: 'cubic',
    cell: { a: 3.359, b: 3.359, c: 3.359, alpha: 90, beta: 90, gamma: 90, lengthUnit: 'angstrom' },
    sites: [{ id: 'Po1', element: 'Po', frac: [0, 0, 0], occupancy: 1 }],
    atomicMass: 209,
    coordinationNumber: 6,
    packingEfficiency: 52,
    teaching: { summary: '八个顶点构成立方点阵。', notes: ['顶点原子被 8 个晶胞共享。'] },
    metadata: { status: 'experimental', source: '公开晶体学资料汇总', notes: '教学模型，晶格参数待双源复核。' },
  },
  {
    id: 'bcc-fe',
    version: '1.0.0',
    name: '体心立方（α-Fe）',
    shortName: '体心立方',
    formula: 'Fe',
    aliases: ['体心立方', '铁', 'Fe', 'BCC', 'alpha-Fe'],
    Z: 2,
    category: 'metallic',
    crystalSystem: 'cubic',
    cell: { a: 2.866, b: 2.866, c: 2.866, alpha: 90, beta: 90, gamma: 90, lengthUnit: 'angstrom' },
    sites: [
      { id: 'Fe1', element: 'Fe', frac: [0, 0, 0], occupancy: 1 },
      { id: 'Fe2', element: 'Fe', frac: [0.5, 0.5, 0.5], occupancy: 1 },
    ],
    atomicMass: 55.845,
    coordinationNumber: 8,
    packingEfficiency: 68,
    teaching: { summary: '八个顶点原子围绕一个体心原子。', notes: ['原子沿体对角线相切。', '一个晶胞含 2 个 Fe 原子。'] },
    metadata: {
      status: 'verified',
      source: 'Lattice Parameter of Alpha Iron by Divergent Beam Diffraction',
      sourceUrl: 'https://doi.org/10.1063/1.1708081',
      notes: '采用室温常见教学值 a = 2.866 Å。',
    },
  },
  {
    id: 'fcc-cu',
    version: '1.0.0',
    name: '面心立方（Cu）',
    shortName: '面心立方',
    formula: 'Cu',
    aliases: ['面心立方', '铜', 'Cu', 'FCC'],
    Z: 4,
    category: 'metallic',
    crystalSystem: 'cubic',
    cell: { a: 3.615, b: 3.615, c: 3.615, alpha: 90, beta: 90, gamma: 90, lengthUnit: 'angstrom' },
    sites: [
      { id: 'Cu1', element: 'Cu', frac: [0, 0, 0], occupancy: 1 },
      { id: 'Cu2', element: 'Cu', frac: [0, 0.5, 0.5], occupancy: 1 },
      { id: 'Cu3', element: 'Cu', frac: [0.5, 0, 0.5], occupancy: 1 },
      { id: 'Cu4', element: 'Cu', frac: [0.5, 0.5, 0], occupancy: 1 },
    ],
    atomicMass: 63.546,
    coordinationNumber: 12,
    packingEfficiency: 74,
    teaching: { summary: '顶点与六个面心共同构成密堆积结构。', notes: ['一个晶胞含 4 个 Cu 原子。'] },
    metadata: { status: 'verified', source: '通用金属学教材', notes: '室温参数 a ≈ 3.615 Å。' },
  },
];

export const structureById = (id: string) =>
  structures.find((item) => item.id === id) ?? structures.find((item) => item.id === 'nacl') ?? structures[0];

/**
 * 常见教学化学式一键快捷。保持简短，用于 ModelLibrary 顶部的 chip 列表。
 */
export const popularStructureIds = ['nacl', 'cscl', 'diamond', 'caf2', 'sc-po', 'bcc-fe', 'fcc-cu', 'zns'] as const;

/**
 * CPK（Corey-Pauling-Koltun）元素配色，覆盖常见无机化学教学元素。
 * 对比度上适当压暗部分过亮色（如 Cl），保证在浅色画布上也能辨认。
 */
export const elementColors: Record<string, string> = {
  H: '#E3E6EA',
  Li: '#CC80FF', Na: '#AB5CF2', K: '#8F40D4', Rb: '#702EB0', Cs: '#57178F',
  Be: '#C2FF00', Mg: '#8AFF00', Ca: '#3DD900', Sr: '#00C900', Ba: '#00A100',
  B: '#FFB5B5', Al: '#BFA6A6', Ga: '#C28F8F',
  C: '#4D4D4D', Si: '#D9A86B', Ge: '#668F8F',
  N: '#3050F8', P: '#FF8000',
  O: '#E53E3E', S: '#E6C532', Se: '#FFA100',
  F: '#8FD35F', Cl: '#2EB82E', Br: '#A62929', I: '#7A007A',
  Fe: '#E06633', Co: '#F090A0', Ni: '#50D050', Cu: '#C88033', Zn: '#7D80B0',
  Ag: '#BFBFBF', Au: '#D4A017', Hg: '#B8B8D0', Pb: '#575961',
  Po: '#AB5C00',
};

export const positionColors = {
  vertex: '#4C8DF6',
  edge: '#22B07D',
  face: '#E8579A',
  interior: '#F2A516',
} as const;

/**
 * 对部分 CPK 原色较浅（如 F、H、Mg）的元素，给一个用于标签文字的"墨色"派生，
 * 保证在白底浅圆点上的标签文字始终可读。
 */
export function elementInk(color: string): string {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return '#0f172a';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? '#0f172a' : '#ffffff';
}
