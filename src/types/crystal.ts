export type LengthUnit = 'angstrom' | 'pm' | 'nm';
export type CrystalCategory = 'basic-lattice' | 'metallic' | 'ionic' | 'covalent' | 'molecular' | 'mixed';
export type PositionType = 'vertex' | 'edge' | 'face' | 'interior';
export type DisplayStyle = 'ball-stick' | 'packing' | 'skeleton';
export type ColoringMode = 'element' | 'position';
export type AppMode = 'explore' | 'teach' | 'classroom';
export type CameraPreset = 'textbook' | 'a' | 'b' | 'c' | '110' | '111';
export type AppearancePreset = 'standard' | 'reference';

export interface CellParameters {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
  lengthUnit: LengthUnit;
}

export interface AtomSite {
  id: string;
  element: string;
  frac: [number, number, number];
  occupancy: number;
}

export interface CrystalStructure {
  id: string;
  version: string;
  name: string;
  shortName: string;
  formula: string;
  aliases?: string[];
  Z: number;
  category: CrystalCategory;
  crystalSystem: 'cubic';
  cell: CellParameters;
  sites: AtomSite[];
  atomicMass: number;
  coordinationNumber: number;
  packingEfficiency: number;
  teaching: { summary: string; notes: string[] };
  metadata: {
    status: 'verified' | 'experimental';
    source: string;
    sourceUrl?: string;
    notes?: string;
  };
}

export interface RenderedAtom {
  key: string;
  siteId: string;
  element: string;
  frac: [number, number, number];
  positionType: PositionType;
  contribution: number;
  cart: [number, number, number];
  equivalentCopies: number;
}

/** 两个已渲染原子之间的化学键（最近邻连线）。 */
export interface RenderedBond {
  /** 起点原子在 RenderedAtom[] 中的下标 */
  from: number;
  /** 终点原子在 RenderedAtom[] 中的下标 */
  to: number;
  /** 两原子中心距离，单位与晶胞参数一致（Å） */
  length: number;
}

export interface TeachingStep {
  id: string;
  title: string;
  narration: string;
  camera: CameraPreset;
  focus?: PositionType | 'all';
  display?: Partial<{
    coloring: ColoringMode;
    displayStyle: DisplayStyle;
    truncate: boolean;
    showBodyDiagonal: boolean;
    extension: 1 | 2 | 3;
  }>;
  calculation?: string;
}
