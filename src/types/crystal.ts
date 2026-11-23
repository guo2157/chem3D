export type LengthUnit = 'angstrom' | 'pm' | 'nm';
export type CrystalCategory = 'basic-lattice' | 'metallic' | 'ionic' | 'covalent' | 'molecular' | 'mixed';
export type PositionType = 'vertex' | 'edge' | 'face' | 'interior';
export type DisplayStyle = 'ball-stick' | 'packing' | 'skeleton';
export type ColoringMode = 'element' | 'position';
export type AppMode = 'explore' | 'teach' | 'classroom';
export type CameraPreset = 'textbook' | 'a' | 'b' | 'c' | '110' | '111';

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
