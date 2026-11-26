import type { AppearancePreset } from '../types/crystal';

// ---------------------------------------------------------------------------
// 元素视觉参数 profile —— 仅影响显示外观，不参与晶体学计算
// ---------------------------------------------------------------------------
export interface ElementVisualProfile {
  color: string;
  radiusScale: number;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
}

export interface CrystalVisualProfile {
  elements: Record<string, ElementVisualProfile>;
  bondColor: string;
  bondRoughness: number;
  bondMetalness: number;
  cellEdgeColor: string;
  cellEdgeRadiusScale: number;
}

// ===========================
// 参考图 (reference) 风格 profile
// ===========================

/** 通用 reference fallback：偏暖灰球体，深灰杆件 */
const DEFAULT_REFERENCE_ELEMENT: ElementVisualProfile = {
  color: '#8A94A6',
  radiusScale: 1.0,
  roughness: 0.25,
  metalness: 0.02,
  clearcoat: 0.7,
  clearcoatRoughness: 0.12,
};

const REFERENCE_BOND_COLOR = '#4B4B4B';
const REFERENCE_BOND_ROUGHNESS = 0.5;
const REFERENCE_BOND_METALNESS = 0.6;
const REFERENCE_CELL_COLOR = '#3A3A3A';
const REFERENCE_CELL_RADIUS_SCALE = 1.0;

/** ZnS 闪锌矿参考图 profile（Zn 金黄、S 红色球体，深灰杆件） */
const ZNS_REFERENCE: CrystalVisualProfile = {
  elements: {
    Zn: {
      color: '#F5C33E',
      radiusScale: 1.08,
      roughness: 0.2,
      metalness: 0.02,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
    },
    S: {
      color: '#E0533E',
      radiusScale: 1.0,
      roughness: 0.22,
      metalness: 0.02,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
    },
  },
  bondColor: REFERENCE_BOND_COLOR,
  bondRoughness: REFERENCE_BOND_ROUGHNESS,
  bondMetalness: REFERENCE_BOND_METALNESS,
  cellEdgeColor: REFERENCE_CELL_COLOR,
  cellEdgeRadiusScale: REFERENCE_CELL_RADIUS_SCALE,
};

// 按模型 id 映射的 reference profile；未列出的模型使用通用 fallback
const REFERENCE_PROFILES: Record<string, CrystalVisualProfile> = {
  zns: ZNS_REFERENCE,
};

// ===========================
// 标准 (standard) 风格 profile
// ===========================

const STANDARD_BOND_COLOR = '#999';
const STANDARD_BOND_ROUGHNESS = 0.6;
const STANDARD_BOND_METALNESS = 0.1;
const STANDARD_CELL_COLOR = '#666';
const STANDARD_CELL_RADIUS_SCALE = 0.6;

/** 标准模式下各元素相对于基础半径的缩放比例（基于离子/共价半径归一化） */
const STANDARD_RADIUS_SCALE: Record<string, number> = {
  Na: 0.57,   // Na⁺  ~1.02Å
  Cs: 0.92,   // Cs⁺  ~1.67Å
  Ca: 0.55,   // Ca²⁺ ~1.00Å
  Cl: 1.00,   // Cl⁻  ~1.81Å (基准)
  F:  0.73,   // F⁻   ~1.33Å
  Cu: 0.71,   // Cu    ~1.28Å (金属半径)
  Fe: 0.70,   // Fe    ~1.26Å (金属半径)
  Zn: 0.41,   // Zn²⁺ ~0.74Å
  S:  1.02,   // S²⁻  ~1.84Å
  C:  0.42,   // C     ~0.77Å (共价半径)
  Po: 0.93,   // Po    ~1.68Å (金属半径)
};

/** 通用标准 fallback（不覆盖元素颜色，由 elementColors 控制） */
const DEFAULT_STANDARD_ELEMENT: ElementVisualProfile = {
  color: '', // 空表示使用外部 elementColors
  radiusScale: 1.0,
  roughness: 0.55,
  metalness: 0.05,
  clearcoat: 0,
  clearcoatRoughness: 0,
};

/** 获取指定模型和外观的视觉 profile */
export function getVisualProfile(
  modelId: string,
  appearance: AppearancePreset,
): CrystalVisualProfile {
  if (appearance === 'reference') {
    return REFERENCE_PROFILES[modelId] ?? makeFallbackReferenceProfile();
  }
  return makeStandardProfile();
}

/** 获取单个元素在 reference/standard 下的视觉参数 */
export function getElementVisualProfile(
  modelId: string,
  appearance: AppearancePreset,
  element: string,
): ElementVisualProfile {
  const profile = getVisualProfile(modelId, appearance);
  if (appearance === 'reference') {
    return profile.elements[element] ?? { ...DEFAULT_REFERENCE_ELEMENT };
  }
  return {
    ...DEFAULT_STANDARD_ELEMENT,
    color: profile.elements[element]?.color ?? '',
    radiusScale: STANDARD_RADIUS_SCALE[element] ?? 1.0,
  };
}

/** 将通用 reference fallback 元素置换为仅使用默认配色 */
function makeFallbackReferenceProfile(): CrystalVisualProfile {
  return {
    elements: Object.create(null),
    bondColor: REFERENCE_BOND_COLOR,
    bondRoughness: REFERENCE_BOND_ROUGHNESS,
    bondMetalness: REFERENCE_BOND_METALNESS,
    cellEdgeColor: REFERENCE_CELL_COLOR,
    cellEdgeRadiusScale: REFERENCE_CELL_RADIUS_SCALE,
  };
}

/** 标准 profile：不覆盖元素颜色 */
function makeStandardProfile(): CrystalVisualProfile {
  return {
    elements: Object.create(null),
    bondColor: STANDARD_BOND_COLOR,
    bondRoughness: STANDARD_BOND_ROUGHNESS,
    bondMetalness: STANDARD_BOND_METALNESS,
    cellEdgeColor: STANDARD_CELL_COLOR,
    cellEdgeRadiusScale: STANDARD_CELL_RADIUS_SCALE,
  };
}
