import { create } from 'zustand';
import type { AppMode, AppearancePreset, CameraPreset, ColoringMode, DisplayStyle, RenderedAtom } from '../types/crystal';

export type MeasurePair = [RenderedAtom | null, RenderedAtom | null];
export type ProjectionPlane = 'none' | 'xy' | 'xz' | 'yz';

interface AppState {
  modelId: string;
  mode: AppMode;
  theme: 'light' | 'dark';
  highContrast: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  inspectorTab: 'observe' | 'analyze' | 'calculate';
  displayStyle: DisplayStyle;
  coloring: ColoringMode;
  truncate: boolean;
  showCell: boolean;
  showLabels: boolean;
  showBodyDiagonal: boolean;
  showFaceDiagonal: boolean;
  showAxes: boolean;
  projection: ProjectionPlane;
  autoRotate: boolean;
  extension: 1 | 2 | 3;
  cameraPreset: CameraPreset;
  appearancePreset: AppearancePreset;
  orthographic: boolean;
  selectedAtom: RenderedAtom | null;
  lessonStep: number;
  // 测量距离：两段式点选
  measureMode: boolean;
  measurePair: MeasurePair;
  // 配位关系：高亮选中原子的最近邻壳
  showCoordination: boolean;
  // 高亮某个位点的所有等效副本（按 siteId 匹配）
  highlightSite: string | null;
  // 教学步骤自动播放（Space 快捷键驱动）
  lessonPlaying: boolean;
  // 帮助浮层（? 快捷键驱动）
  helpOpen: boolean;
  // 粒子计数分步演示，null 表示未在演示；0/1/2 分别对应"顶点亮起 / +体心 / 汇总"
  countingStage: number | null;
  setModel: (id: string) => void;
  setMode: (mode: AppMode) => void;
  toggleTheme: () => void;
  toggleContrast: () => void;
  setLeftOpen: (value: boolean) => void;
  setRightOpen: (value: boolean) => void;
  setInspectorTab: (tab: AppState['inspectorTab']) => void;
  setDisplayStyle: (style: DisplayStyle) => void;
  setColoring: (mode: ColoringMode) => void;
  setTruncate: (value: boolean) => void;
  setShowCell: (value: boolean) => void;
  setShowLabels: (value: boolean) => void;
  setShowBodyDiagonal: (value: boolean) => void;
  setShowFaceDiagonal: (value: boolean) => void;
  setShowAxes: (value: boolean) => void;
  setProjection: (value: ProjectionPlane) => void;
  setAutoRotate: (value: boolean) => void;
  setExtension: (value: 1 | 2 | 3) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setAppearancePreset: (preset: AppearancePreset) => void;
  setOrthographic: (value: boolean) => void;
  setSelectedAtom: (atom: RenderedAtom | null) => void;
  setLessonStep: (step: number) => void;
  toggleMeasureMode: () => void;
  pushMeasureAtom: (atom: RenderedAtom) => void;
  clearMeasure: () => void;
  setShowCoordination: (value: boolean) => void;
  setHighlightSite: (siteId: string | null) => void;
  setLessonPlaying: (value: boolean) => void;
  toggleLessonPlaying: () => void;
  setHelpOpen: (value: boolean) => void;
  setCountingStage: (stage: number | null) => void;
  // 一次性关闭所有浮层/临时状态；返回是否关掉了东西，用于 Esc 多级退出
  dismissTopOverlay: () => boolean;
}

const storage = typeof localStorage === 'undefined' ? null : localStorage;
const savedTheme = storage?.getItem('chem3d-theme') === 'dark' ? 'dark' : 'light';
const savedContrast = storage?.getItem('chem3d-contrast') === 'high';

export const useAppStore = create<AppState>((set) => ({
  modelId: 'nacl',
  mode: 'explore',
  theme: savedTheme,
  highContrast: savedContrast,
  leftOpen: typeof window === 'undefined' ? true : window.innerWidth >= 1024,
  rightOpen: true,
  inspectorTab: 'observe',
  displayStyle: 'ball-stick',
  coloring: 'element',
  truncate: false,
  showCell: true,
  showLabels: true,
  showBodyDiagonal: false,
  showFaceDiagonal: false,
  showAxes: true,
  projection: 'none',
  autoRotate: false,
  extension: 1,
  cameraPreset: 'textbook',
  appearancePreset: 'standard',
  orthographic: false,
  selectedAtom: null,
  lessonStep: 0,
  measureMode: false,
  measurePair: [null, null],
  showCoordination: false,
  highlightSite: null,
  lessonPlaying: false,
  helpOpen: false,
  countingStage: null,
  setModel: (modelId) => set({
    modelId,
    selectedAtom: null,
    lessonStep: 0,
    cameraPreset: 'textbook',
    measureMode: false,
    measurePair: [null, null],
    showCoordination: false,
    highlightSite: null,
    lessonPlaying: false,
    countingStage: null,
  }),
  setMode: (mode) => set({ mode, leftOpen: mode !== 'classroom', rightOpen: mode !== 'classroom' }),
  toggleTheme: () => set((state) => {
    const theme = state.theme === 'light' ? 'dark' : 'light';
    storage?.setItem('chem3d-theme', theme);
    return { theme };
  }),
  toggleContrast: () => set((state) => {
    const highContrast = !state.highContrast;
    storage?.setItem('chem3d-contrast', highContrast ? 'high' : 'normal');
    return { highContrast };
  }),
  setLeftOpen: (leftOpen) => set({ leftOpen }),
  setRightOpen: (rightOpen) => set({ rightOpen }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setDisplayStyle: (displayStyle) => set({ displayStyle }),
  setColoring: (coloring) => set({ coloring }),
  setTruncate: (truncate) => set({ truncate }),
  setShowCell: (showCell) => set({ showCell }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setShowBodyDiagonal: (showBodyDiagonal) => set({ showBodyDiagonal }),
  setShowFaceDiagonal: (showFaceDiagonal) => set({ showFaceDiagonal }),
  setShowAxes: (showAxes) => set({ showAxes }),
  setProjection: (projection) => set({ projection }),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setExtension: (extension) => set({ extension, selectedAtom: null, measurePair: [null, null] }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setAppearancePreset: (appearancePreset) => set({ appearancePreset }),
  setOrthographic: (orthographic) => set({ orthographic }),
  setSelectedAtom: (selectedAtom) => set({ selectedAtom }),
  setLessonStep: (lessonStep) => set({ lessonStep }),
  toggleMeasureMode: () => set((state) => {
    const next = !state.measureMode;
    return { measureMode: next, measurePair: next ? [null, null] : state.measurePair };
  }),
  pushMeasureAtom: (atom) => set((state) => {
    const [a, b] = state.measurePair;
    if (!a) return { measurePair: [atom, null] };
    if (!b) {
      // 同一原子双击视为取消第一个选择
      if (a.key === atom.key) return { measurePair: [null, null] };
      return { measurePair: [a, atom] };
    }
    // 两点已满，重新从第一个开始
    return { measurePair: [atom, null] };
  }),
  clearMeasure: () => set({ measurePair: [null, null] }),
  setShowCoordination: (showCoordination) => set({ showCoordination }),
  setHighlightSite: (highlightSite) => set({ highlightSite }),
  setLessonPlaying: (lessonPlaying) => set({ lessonPlaying }),
  toggleLessonPlaying: () => set((state) => ({ lessonPlaying: !state.lessonPlaying })),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setCountingStage: (countingStage) => set({ countingStage }),
  dismissTopOverlay: () => {
    const state = useAppStore.getState();
    if (state.helpOpen) { set({ helpOpen: false }); return true; }
    if (state.countingStage !== null) { set({ countingStage: null }); return true; }
    if (state.measureMode) { set({ measureMode: false, measurePair: [null, null] }); return true; }
    if (state.showCoordination) { set({ showCoordination: false }); return true; }
    if (state.highlightSite) { set({ highlightSite: null }); return true; }
    if (state.selectedAtom) { set({ selectedAtom: null }); return true; }
    if (state.leftOpen && window.innerWidth < 1024) { set({ leftOpen: false }); return true; }
    return false;
  },
}));
