import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { AppearancePreset, CameraPreset, ColoringMode, CrystalStructure, DisplayStyle, PositionType, RenderedAtom } from '../types/crystal';
import { elementColors, elementInk, positionColors } from '../data/structures';
import { getElementVisualProfile, getVisualProfile } from './renderProfiles';
import { computeNearestNeighborBonds, generateRenderedAtoms } from '../math/crystal';

export interface SceneOptions {
  extension: 1 | 2 | 3;
  displayStyle: DisplayStyle;
  coloring: ColoringMode;
  appearancePreset: AppearancePreset;
  truncate: boolean;
  showCell: boolean;
  showBodyDiagonal: boolean;
  showFaceDiagonal: boolean;
  showAxes: boolean;
  projection: 'none' | 'xy' | 'xz' | 'yz';
  showLabels: boolean;
  autoRotate: boolean;
  highContrast: boolean;
  focus?: PositionType | 'all';
}

export class SceneManager {
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly labelRenderer: CSS2DRenderer;
  private readonly perspective = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private readonly orthographic = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
  private activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera = this.perspective;
  private controls: OrbitControls;
  private readonly content = new THREE.Group();
  private readonly labelGroup = new THREE.Group();
  private readonly measureGroup = new THREE.Group();
  private readonly coordGroup = new THREE.Group();
  private readonly highlightGroup = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private atomMeshes: THREE.InstancedMesh[] = [];
  /** 化学键使用的几何体与材质，每次重建场景时需要手动释放。 */
  private bondResources: { dispose(): void }[] = [];
  private atoms: RenderedAtom[] = [];
  private selectedOuter?: THREE.Mesh;
  private selectedInner?: THREE.Mesh;
  private structure?: CrystalStructure;
  private options?: SceneOptions;
  private cameraPreset: CameraPreset = 'textbook';
  private raf = 0;
  private dampingFrames = 0;
  private pointerStart = { x: 0, y: 0, time: 0 };
  // ── 晶体学方向自动旋转 ──
  private autoRotationActive = false;
  private autoRotationState: 'idle' | 'transitioning' | 'dwelling' = 'idle';
  private autoRotationTimer = 0;
  private autoRotationIndex = 0;
  private readonly autoRotationSequence: CameraPreset[] = ['a', 'b', 'c', '110', '111'];
  private autoRotationDwellMs = 2000;
  private readonly autoRotationTransitionMs = 2000;
  // ── 相机动画插值 ──
  private cameraAnimDuration = 0;
  private cameraAnimElapsed = 0;
  private cameraAnimStartPos = new THREE.Vector3();
  private cameraAnimEndPos = new THREE.Vector3();
  private cameraAnimStartTarget = new THREE.Vector3();
  private cameraAnimEndTarget = new THREE.Vector3();
  private cameraAnimStartUp = new THREE.Vector3();
  private cameraAnimEndUp = new THREE.Vector3();
  private lastRenderTimestamp = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly onSelect: (atom: RenderedAtom | null) => void,
    private readonly onAutoRotationChange?: (active: boolean) => void,
    private readonly onDirectionChange?: (preset: CameraPreset) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.5 : 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'scene-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'scene-labels';
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.inset = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.labelRenderer.domElement);

    this.scene.add(this.content);
    this.scene.add(this.labelGroup);
    this.scene.add(this.measureGroup);
    this.scene.add(this.coordGroup);
    this.scene.add(this.highlightGroup);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xbad7ff, 0.55);
    fill.position.set(-5, 2, -4);
    this.scene.add(fill);

    this.perspective.position.set(6, 5, 7);
    this.orthographic.position.copy(this.perspective.position);
    this.controls = this.createControls(this.activeCamera);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerleave', this.handlePointerLeave);
    this.resize();
  }

  private createControls(camera: THREE.Camera): OrbitControls {
    const controls = new OrbitControls(camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2;
    controls.maxDistance = 40;
    controls.addEventListener('start', () => {
      if (this.autoRotationActive) this.stopAutoRotation();
      this.dampingFrames = 45;
      this.invalidate();
    });
    controls.addEventListener('change', () => { this.dampingFrames = Math.max(this.dampingFrames, 4); this.invalidate(); });
    controls.addEventListener('end', () => { this.dampingFrames = 35; this.invalidate(); });
    return controls;
  }

  setStructure(structure: CrystalStructure, options: SceneOptions): void {
    if (this.autoRotationActive) this.stopAutoRotation();
    this.structure = structure;
    this.options = options;
    this.rebuild(false);
  }

  updateOptions(options: SceneOptions): void {
    if (!this.structure) return;
    this.options = options;
    this.rebuild(true);
  }

  setCamera(orthographic: boolean, preset: CameraPreset): void {
    const nextCamera = orthographic ? this.orthographic : this.perspective;
    if (nextCamera !== this.activeCamera) {
      const position = this.activeCamera.position.clone();
      const target = this.controls.target.clone();
      this.controls.dispose();
      this.activeCamera = nextCamera;
      this.activeCamera.position.copy(position);
      this.controls = this.createControls(nextCamera);
      this.controls.target.copy(target);
    }
    this.cameraPreset = preset;
    this.applyCameraPreset();
  }

  resetView(): void {
    this.applyCameraPreset();
  }

  selectAtom(atom: RenderedAtom | null): void {
    if (!atom || !this.structure || !this.options) {
      this.selectedOuter?.removeFromParent();
      this.selectedInner?.removeFromParent();
      this.selectedOuter = undefined;
      this.selectedInner = undefined;
      this.invalidate();
      return;
    }
    const radius = this.atomRadius(this.structure, this.options.displayStyle);
    const position = this.worldPosition(atom, this.structure, this.options.extension);
    const makeShell = (scale: number, color: number) => {
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, depthTest: true, transparent: true, opacity: 0.95 });
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -2;
      mat.polygonOffsetUnits = -2;
      return new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 24, 18), mat);
    };
    this.selectedOuter?.removeFromParent();
    this.selectedInner?.removeFromParent();
    this.selectedOuter = makeShell(1.18, 0x0f766e);
    this.selectedInner = makeShell(1.1, 0xffffff);
    this.selectedOuter.position.copy(position);
    this.selectedInner.position.copy(position);
    this.content.add(this.selectedOuter, this.selectedInner);
    this.invalidate();
  }

  /**
   * 渲染两点之间的测量距离：虚线连线 + CSS2D 距离标签。
   */
  setMeasure(a: RenderedAtom | null, b: RenderedAtom | null): void {
    this.clearGroup(this.measureGroup);
    if (!this.structure || !this.options) { this.invalidate(); return; }
    const radius = this.atomRadius(this.structure, this.options.displayStyle);
    const marker = (atom: RenderedAtom) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.25, radius * 0.1, 10, 36),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false, transparent: true, opacity: 0.95 }),
      );
      ring.renderOrder = 10;
      ring.position.copy(this.worldPosition(atom, this.structure!, this.options!.extension));
      ring.lookAt(this.activeCamera.position);
      this.measureGroup.add(ring);
    };
    if (a) marker(a);
    if (b) marker(b);
    if (a && b) {
      const pa = this.worldPosition(a, this.structure, this.options.extension);
      const pb = this.worldPosition(b, this.structure, this.options.extension);
      const distance = Math.hypot(a.cart[0] - b.cart[0], a.cart[1] - b.cart[1], a.cart[2] - b.cart[2]);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([pa, pb]),
        new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: 0.2, gapSize: 0.12, depthTest: false }),
      );
      line.computeLineDistances();
      line.renderOrder = 10;
      this.measureGroup.add(line);
      const labelEl = document.createElement('div');
      labelEl.className = 'measure-label';
      labelEl.textContent = `${distance.toFixed(3)} Å`;
      labelEl.title = `两个原子中心之间的直线距离 ${distance.toFixed(3)} Å（埃）。1 Å = 10⁻¹⁰ m = 0.1 nm。`;
      const label = new CSS2DObject(labelEl);
      label.position.copy(pa).add(pb).multiplyScalar(0.5);
      this.measureGroup.add(label);
    }
    this.invalidate();
  }

  /**
   * 高亮某个中心原子及其配位壳：第一近邻按距离阈值聚合。
   */
  setCoordination(center: RenderedAtom | null): void {
    this.clearGroup(this.coordGroup);
    if (!center || !this.structure || !this.options) { this.invalidate(); return; }
    const neighbors = this.neighborsOf(center);
    if (neighbors.length === 0) { this.invalidate(); return; }
    const centerPos = this.worldPosition(center, this.structure, this.options.extension);
    const radius = this.atomRadius(this.structure, this.options.displayStyle);
    for (const neighbor of neighbors) {
      const np = this.worldPosition(neighbor.atom, this.structure, this.options.extension);
      const bond = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([centerPos, np]),
        new THREE.LineBasicMaterial({ color: 0x0f766e, transparent: true, opacity: 0.9, depthTest: false }),
      );
      bond.renderOrder = 9;
      this.coordGroup.add(bond);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.22, radius * 0.08, 10, 32),
        new THREE.MeshBasicMaterial({ color: 0x0f766e, depthTest: false, transparent: true, opacity: 0.85 }),
      );
      halo.position.copy(np);
      halo.lookAt(this.activeCamera.position);
      halo.renderOrder = 9;
      this.coordGroup.add(halo);
    }
    const info = document.createElement('div');
    info.className = 'coord-label';
    info.innerHTML = `配位数 <b>${neighbors.length}</b> · ${neighbors[0].distance.toFixed(3)} Å`;
    info.title = `配位数 = 离中心原子最近的原子个数（共 ${neighbors.length} 个），最近邻距离 ${neighbors[0].distance.toFixed(3)} Å。`;
    const label = new CSS2DObject(info);
    label.position.copy(centerPos).add(new THREE.Vector3(0, radius * 2.2, 0));
    this.coordGroup.add(label);
    this.invalidate();
  }

  /**
   * 以 center 为参考，在当前渲染的 atoms 中找出"第一配位壳"。
   * 规则：按笛卡尔距离升序，取与最短距离差异在 5% 以内的所有原子。
   */
  private neighborsOf(center: RenderedAtom): { atom: RenderedAtom; distance: number }[] {
    const list: { atom: RenderedAtom; distance: number }[] = [];
    for (const atom of this.atoms) {
      if (atom.key === center.key) continue;
      const d = Math.hypot(atom.cart[0] - center.cart[0], atom.cart[1] - center.cart[1], atom.cart[2] - center.cart[2]);
      if (d < 1e-6) continue;
      list.push({ atom, distance: d });
    }
    list.sort((a, b) => a.distance - b.distance);
    if (list.length === 0) return list;
    const dMin = list[0].distance;
    return list.filter((item) => item.distance <= dMin * 1.05);
  }

  /**
   * 高亮指定 siteId 对应的所有等效副本。siteId 为 null 时清除高亮。
   */
  setSiteHighlight(siteId: string | null): void {
    this.clearGroup(this.highlightGroup);
    if (!siteId || !this.structure || !this.options) { this.invalidate(); return; }
    const radius = this.atomRadius(this.structure, this.options.displayStyle);
    const matches = this.atoms.filter((atom) => atom.siteId === siteId);
    for (const atom of matches) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.3, radius * 0.1, 10, 36),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false, transparent: true, opacity: 0.95 }),
      );
      halo.position.copy(this.worldPosition(atom, this.structure, this.options.extension));
      halo.lookAt(this.activeCamera.position);
      halo.renderOrder = 11;
      this.highlightGroup.add(halo);
    }
    this.invalidate();
  }

  private clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof CSS2DObject) child.element.remove();
      else if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose?.();
    }
  }

  private rebuild(preserveCamera = true): void {
    if (!this.structure || !this.options) return;
    const savedCameraPos = preserveCamera ? this.activeCamera.position.clone() : null;
    const savedTarget = preserveCamera ? this.controls.target.clone() : null;
    this.disposeGroup();
    const { structure, options } = this;
    this.atoms = generateRenderedAtoms(structure, options.extension);
    const isReference = options.appearancePreset === 'reference';
    const baseRadius = this.atomRadius(structure, options.displayStyle);
    const sphere = new THREE.SphereGeometry(1, window.innerWidth < 768 ? 20 : 32, window.innerWidth < 768 ? 14 : 24);
    const half = options.extension * structure.cell.a / 2;
    const clippingPlanes = options.truncate ? [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), half),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), half),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), half),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), half),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), half),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), half),
    ] : [];
    const grouped = new Map<string, { color: string; radiusScale: number; atoms: RenderedAtom[] }>();
    for (const atom of this.atoms) {
      const color = this.atomColor(atom, options);
      const vp = getElementVisualProfile(structure.id, options.appearancePreset, atom.element);
      const key = `${color}|${vp.radiusScale.toFixed(3)}`;
      const group = grouped.get(key) ?? { color, radiusScale: vp.radiusScale, atoms: [] };
      group.atoms.push(atom);
      grouped.set(key, group);
    }
    this.atomMeshes = [];
    for (const group of grouped.values()) {
      const material = isReference
        ? new THREE.MeshPhysicalMaterial({
            color: group.color,
            metalness: 0.02,
            roughness: 0.22,
            clearcoat: 0.8,
            clearcoatRoughness: 0.12,
            clippingPlanes,
          })
        : new THREE.MeshPhongMaterial({ color: group.color, shininess: 55, specular: 0x6b7280, clippingPlanes });
      const mesh = new THREE.InstancedMesh(sphere, material, group.atoms.length);
      this.bondResources.push(material);
      const matrix = new THREE.Matrix4();
      const visualRadius = baseRadius * group.radiusScale;
      group.atoms.forEach((atom, index) => {
        const position = this.worldPosition(atom, structure, options.extension);
        matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(visualRadius, visualRadius, visualRadius));
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.atoms = group.atoms;
      this.atomMeshes.push(mesh);
      this.content.add(mesh);
    }
    // 堆积样式下原子球相切/相叠，键会被完全遮住，因此只在球棍与骨架样式下绘制。
    if (options.displayStyle !== 'packing') this.buildBonds(structure, options, clippingPlanes);
    if (options.showCell) this.buildCells(structure, options.extension, options.highContrast, options.appearancePreset);
    if (options.showBodyDiagonal) this.buildBodyDiagonal(structure, options.highContrast);
    if (options.showFaceDiagonal) this.buildFaceDiagonals(structure, options.highContrast);
    if (options.showAxes) this.buildAxes(structure, options.extension);
    if (options.projection !== 'none') this.buildProjection(structure, options, baseRadius);
    if (options.showLabels) this.buildLabels(structure, options, baseRadius);
    if (preserveCamera && savedCameraPos && savedTarget) {
      this.activeCamera.position.copy(savedCameraPos);
      this.controls.target.copy(savedTarget);
      this.controls.update();
    } else {
      this.applyCameraPreset();
    }
    // reference 外观：近白色背景
    if (isReference) {
      this.scene.background = new THREE.Color(0xf8f8f8);
    } else {
      this.scene.background = null;
    }
    this.invalidate();
  }

  /** 原子球（以及与之相连的键半段）的显示颜色：聚焦模式下非聚焦位置统一置灰。 */
  private atomColor(atom: RenderedAtom, options: SceneOptions): string {
    const isMuted = Boolean(options.focus && options.focus !== 'all' && atom.positionType !== options.focus);
    if (isMuted) return '#94A3B8';
    return options.coloring === 'element'
      ? elementColors[atom.element] ?? '#8A94A6'
      : positionColors[atom.positionType];
  }

  /**
   * 绘制最近邻化学键（球棍 / 骨架样式）。
   * 每条键是一根圆柱，从中点分为两半，每半取所连原子的颜色（双色分段）。
   * 例如 BCC 的体心原子会与 8 个顶点原子各连一条键。
   * 同色的键半段合并为一个 InstancedMesh，与原子球的绘制方式一致。
   */
  private buildBonds(structure: CrystalStructure, options: SceneOptions, clippingPlanes: THREE.Plane[]): void {
    const bonds = computeNearestNeighborBonds(this.atoms);
    if (bonds.length === 0) return;

    const radius = this.bondRadius(structure, options.displayStyle);
    const geometry = new THREE.CylinderGeometry(1, 1, 1, window.innerWidth < 768 ? 8 : 14, 1, false);
    this.bondResources.push(geometry);

    const segmentsByColor = new Map<string, { start: THREE.Vector3; end: THREE.Vector3 }[]>();
    const addSegment = (color: string, start: THREE.Vector3, end: THREE.Vector3) => {
      const list = segmentsByColor.get(color) ?? [];
      list.push({ start, end });
      segmentsByColor.set(color, list);
    };
    const isRef = options.appearancePreset === 'reference';
    const refProfile = isRef ? getVisualProfile(structure.id, options.appearancePreset) : null;
    const refBondColor = refProfile?.bondColor ?? '#4B4B4B';
    for (const bond of bonds) {
      const atomA = this.atoms[bond.from];
      const atomB = this.atoms[bond.to];
      const pa = this.worldPosition(atomA, structure, options.extension);
      const pb = this.worldPosition(atomB, structure, options.extension);
      if (isRef) {
        addSegment(refBondColor, pa, pb);
      } else {
        const mid = pa.clone().add(pb).multiplyScalar(0.5);
        addSegment(this.atomColor(atomA, options), pa, mid);
        addSegment(this.atomColor(atomB, options), pb, mid);
      }
    }

    const yAxis = new THREE.Vector3(0, 1, 0);
    const direction = new THREE.Vector3();
    const center = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const matrix = new THREE.Matrix4();
    for (const [color, segments] of segmentsByColor) {
      const material: THREE.Material = isRef
        ? new THREE.MeshPhysicalMaterial({
            color,
            metalness: refProfile?.bondMetalness ?? 0.6,
            roughness: refProfile?.bondRoughness ?? 0.5,
            clippingPlanes,
          })
        : new THREE.MeshPhongMaterial({ color, shininess: 40, specular: 0x6b7280, clippingPlanes });
      this.bondResources.push(material);
      const mesh = new THREE.InstancedMesh(geometry, material, segments.length);
      segments.forEach((segment, index) => {
        direction.subVectors(segment.end, segment.start);
        const length = direction.length();
        quaternion.setFromUnitVectors(yAxis, direction.divideScalar(length));
        center.addVectors(segment.start, segment.end).multiplyScalar(0.5);
        matrix.compose(center, quaternion, scale.set(radius, length, radius));
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.content.add(mesh);
    }
  }

  private atomRadius(structure: CrystalStructure, style: DisplayStyle): number {
    if (style === 'packing') {
      if (structure.id === 'bcc-fe') return Math.sqrt(3) * structure.cell.a / 4;
      if (structure.id === 'fcc-cu') return Math.sqrt(2) * structure.cell.a / 4;
      return structure.cell.a / 2;
    }
    // 球径略收小：金刚石 / ZnS / CaF₂ 的最近邻间距只有 0.433a，球太大会把键完全遮住。
    return style === 'skeleton' ? structure.cell.a * 0.12 : structure.cell.a * 0.22;
  }

  /**
   * 键半径与原子球半径成比例，保证"细棍连球"的层级：
   * 球棍约为球半径的 9%，骨架约 13%（骨架球本身更小，键相对略粗以保持可见）。
   * 之前固定取 a×0.04 / a×0.03，约为球半径的 21% / 27%，视觉上偏粗。
   */
  private bondRadius(structure: CrystalStructure, style: DisplayStyle): number {
    return this.atomRadius(structure, style) * (style === 'skeleton' ? 0.13 : 0.09);
  }

  private worldPosition(atom: RenderedAtom, structure: CrystalStructure, extension: number): THREE.Vector3 {
    const cx = extension * structure.cell.a / 2;
    const cy = extension * structure.cell.b / 2;
    const cz = extension * structure.cell.c / 2;
    return new THREE.Vector3(atom.cart[0] - cx, atom.cart[2] - cz, atom.cart[1] - cy);
  }

  private buildCells(structure: CrystalStructure, extension: number, highContrast: boolean, appearance: AppearancePreset = 'standard'): void {
    const a = structure.cell.a;
    const isReference = appearance === 'reference';
    if (!isReference) {
      const lineMaterial = new THREE.LineBasicMaterial({
        color: highContrast ? 0x0f172a : 0x475569,
        transparent: true,
        opacity: highContrast ? 0.95 : 0.75,
        linewidth: highContrast ? 3 : 2,
      });
      for (let i = 0; i < extension; i++) for (let j = 0; j < extension; j++) for (let k = 0; k < extension; k++) {
        const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(a, a, a));
        const lines = new THREE.LineSegments(edges, lineMaterial);
        lines.position.set((i + 0.5) * a - extension * a / 2, (k + 0.5) * a - extension * a / 2, (j + 0.5) * a - extension * a / 2);
        this.content.add(lines);
      }
      return;
    }
    const profile = getVisualProfile(structure.id, appearance);
    const edgeRadius = a * 0.045 * profile.cellEdgeRadiusScale;
    const edgeColor = profile.cellEdgeColor;
    const edgeSet = new Set();
    const segments: [THREE.Vector3, THREE.Vector3][] = [];
    const key = (x: number, y: number, z: number) => x.toFixed(6) + ',' + y.toFixed(6) + ',' + z.toFixed(6);
    const addEdge = (p1: THREE.Vector3, p2: THREE.Vector3) => {
      const k1 = key(p1.x, p1.y, p1.z);
      const k2 = key(p2.x, p2.y, p2.z);
      const ek = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
      if (edgeSet.has(ek)) return;
      edgeSet.add(ek);
      segments.push([p1.clone(), p2.clone()]);
    };
    for (let ix = 0; ix <= extension; ix++) {
      for (let iy = 0; iy <= extension; iy++) {
        for (let iz = 0; iz <= extension; iz++) {
          const x = (ix - extension / 2) * a;
          const y = (iy - extension / 2) * a;
          const z = (iz - extension / 2) * a;
          if (ix < extension) {
            addEdge(new THREE.Vector3(x, z, y), new THREE.Vector3(x + a, z, y));
          }
          if (iy < extension) {
            addEdge(new THREE.Vector3(x, z, y), new THREE.Vector3(x, z, y + a));
          }
          if (iz < extension) {
            addEdge(new THREE.Vector3(x, z, y), new THREE.Vector3(x, z + a, y));
          }
        }
      }
    }
    if (segments.length === 0) return;
    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, window.innerWidth < 768 ? 6 : 10, 1, false);
    this.bondResources.push(cylGeo);
    const cylMat = new THREE.MeshPhysicalMaterial({
      color: edgeColor,
      metalness: 0.6,
      roughness: 0.5,
    });
    this.bondResources.push(cylMat);
    const mesh = new THREE.InstancedMesh(cylGeo, cylMat, segments.length);
    const yAxis = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const cen = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const mat4 = new THREE.Matrix4();
    segments.forEach((seg: [THREE.Vector3, THREE.Vector3], index: number) => {
      const start = seg[0];
      const end = seg[1];
      dir.subVectors(end, start);
      var len = dir.length();
      quat.setFromUnitVectors(yAxis, dir.divideScalar(len));
      cen.addVectors(start, end).multiplyScalar(0.5);
      mat4.compose(cen, quat, scl.set(edgeRadius, len, edgeRadius));
      mesh.setMatrixAt(index, mat4);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.content.add(mesh);
  }

  private buildBodyDiagonal(structure: CrystalStructure, highContrast = false): void {
    const half = structure.cell.a / 2;
    const start = new THREE.Vector3(-half, -half, -half);
    const end = new THREE.Vector3(half, half, half);
    // 体对角线与体心—顶点的键共线，关闭深度测试并后绘制，避免被键的圆柱遮住。
    const diagonal = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([start, end]),
      new THREE.LineBasicMaterial({ color: 0xe11d48, linewidth: highContrast ? 3 : 2, depthTest: false }),
    );
    diagonal.renderOrder = 8;
    this.content.add(diagonal);
    const labelEl = document.createElement('div');
    labelEl.className = 'diag-label diag-body';
    labelEl.innerHTML = `体对角线 √3·a = <b>${(Math.sqrt(3) * structure.cell.a).toFixed(3)} Å</b>`;
    labelEl.title = `立方晶胞体对角线 = √3·a = √3 × ${structure.cell.a} ≈ ${(Math.sqrt(3) * structure.cell.a).toFixed(3)} Å。体心立方中原子沿体对角线相切，故 4r = √3·a。`;
    const label = new CSS2DObject(labelEl);
    label.position.copy(start).add(end).multiplyScalar(0.5);
    this.content.add(label);
  }

  /**
   * 从一角(0,0,0) 向另外三个面上的对角顶点各画一条面对角线：
   * (0,0,0) → (1,1,0)  底面 (c=0)
   * (0,0,0) → (1,0,1)  侧面 (b=0)
   * (0,0,0) → (0,1,1)  侧面 (a=0)
   * 每条标注 √2·a。
   */
  private buildFaceDiagonals(structure: CrystalStructure, highContrast = false): void {
    const half = structure.cell.a / 2;
    const length = Math.sqrt(2) * structure.cell.a;
    // scene: X=a, Y=c, Z=b
    const origin = new THREE.Vector3(-half, -half, -half);
    const targets: { label: string; end: THREE.Vector3 }[] = [
      { label: '底面 (ab)', end: new THREE.Vector3(+half, -half, +half) },
      { label: '侧面 (ac)', end: new THREE.Vector3(+half, +half, -half) },
      { label: '侧面 (bc)', end: new THREE.Vector3(-half, +half, +half) },
    ];
    // 面对角线在 FCC 中与顶点—面心的键共线，同样关闭深度测试避免被遮住。
    const material = new THREE.LineDashedMaterial({
      color: 0x8b5cf6,
      dashSize: 0.15,
      gapSize: 0.08,
      linewidth: highContrast ? 3 : 2,
      depthTest: false,
    });
    let labelDrawn = false;
    for (const t of targets) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin, t.end]), material);
      line.computeLineDistances();
      line.renderOrder = 8;
      this.content.add(line);
      if (!labelDrawn) {
        const labelEl = document.createElement('div');
        labelEl.className = 'diag-label diag-face';
        labelEl.innerHTML = `面对角线 √2·a = <b>${length.toFixed(3)} Å</b>`;
        labelEl.title = `立方晶胞面对角线 = √2·a = √2 × ${structure.cell.a} ≈ ${length.toFixed(3)} Å。面心立方中原子沿面对角线相切，故 4r = √2·a。`;
        const label = new CSS2DObject(labelEl);
        label.position.copy(origin).add(t.end).multiplyScalar(0.5);
        this.content.add(label);
        labelDrawn = true;
      }
    }
  }

  /**
   * 在晶胞一角建立 3D 坐标轴（a=红，b=绿，c=蓝）。箭头长度 = cell.a × extension × 0.55，
   * 原点贴在立方体的近下左角（- half），轴线指向 +a / +b / +c。
   */
  private buildAxes(structure: CrystalStructure, extension: number): void {
    const half = extension * structure.cell.a / 2;
    const length = structure.cell.a * extension * 0.55;
    // scene mapping: sceneX=a, sceneY=c, sceneZ=b
    const origin = new THREE.Vector3(-half - 0.15, -half - 0.15, -half - 0.15);
    const axes: { dir: THREE.Vector3; color: number; letter: string }[] = [
      { dir: new THREE.Vector3(1, 0, 0), color: 0xdc2626, letter: 'a' }, // 红
      { dir: new THREE.Vector3(0, 0, 1), color: 0x15803d, letter: 'b' }, // 绿 (sceneZ=b)
      { dir: new THREE.Vector3(0, 1, 0), color: 0x2563eb, letter: 'c' }, // 蓝 (sceneY=c)
    ];
    for (const axis of axes) {
      const arrow = new THREE.ArrowHelper(axis.dir, origin, length, axis.color, length * 0.18, length * 0.1);
      (arrow.line.material as THREE.LineBasicMaterial).linewidth = 2;
      this.content.add(arrow);
    }
  }

  /**
   * 把所有原子向指定坐标平面（底面/侧面）做正投影：
   * - 平面上出一个淡色阴影圆盘
   * - 从原子向投影位置画一条竖向虚线
   * 平面位置取立方体负半轴面（- half）。
   */
  private buildProjection(structure: CrystalStructure, options: SceneOptions, radius: number): void {
    if (options.projection === 'none') return;
    const half = options.extension * structure.cell.a / 2;
    // scene: X=a, Y=c, Z=b
    // 用户语义：xy 平面 = a-b 平面（即 scene 的 X-Z，底面，c 轴垂直）
    //           xz 平面 = a-c 平面（即 scene 的 X-Y，侧面，b 轴垂直）
    //           yz 平面 = b-c 平面（即 scene 的 Z-Y，侧面，a 轴垂直）
    const planes = {
      xy: { axis: 'y' as const, value: -half, normal: new THREE.Vector3(0, 1, 0) }, // 底面
      xz: { axis: 'z' as const, value: -half, normal: new THREE.Vector3(0, 0, 1) }, // 后面
      yz: { axis: 'x' as const, value: -half, normal: new THREE.Vector3(1, 0, 0) }, // 左面
    };
    const plane = planes[options.projection];

    // 半透明投影平面（让投影面可见）
    const planeSize = options.extension * structure.cell.a * 1.02;
    const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
    const planeMat = new THREE.MeshBasicMaterial({ color: 0x0f766e, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    if (plane.axis === 'y') { planeMesh.rotation.x = -Math.PI / 2; planeMesh.position.y = plane.value; }
    else if (plane.axis === 'z') { planeMesh.position.z = plane.value; }
    else { planeMesh.rotation.y = Math.PI / 2; planeMesh.position.x = plane.value; }
    this.content.add(planeMesh);

    const discGeo = new THREE.CircleGeometry(radius * 0.9, 24);
    const dashMat = new THREE.LineDashedMaterial({ color: 0x475569, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.6 });

    for (const atom of this.atoms) {
      const world = this.worldPosition(atom, structure, options.extension);
      const projected = world.clone();
      projected[plane.axis] = plane.value + 0.001;
      const color = options.coloring === 'element'
        ? elementColors[atom.element] ?? '#8A94A6'
        : positionColors[atom.positionType];
      const discMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.position.copy(projected);
      if (plane.axis === 'y') disc.rotation.x = -Math.PI / 2;
      else if (plane.axis === 'z') { /* already facing */ }
      else { disc.rotation.y = Math.PI / 2; }
      this.content.add(disc);
      const connector = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([world, projected]),
        dashMat,
      );
      connector.computeLineDistances();
      this.content.add(connector);
    }
  }

  /**
   * 为每个原子生成 "元素 + 元素内序号" 的 CSS2D 标签。
   * 序号按渲染顺序对每种元素独立计数（Na¹ Na² … Cl¹ Cl² …）。
   */
  private buildLabels(structure: CrystalStructure, options: SceneOptions, radius: number): void {
    this.clearLabels();
    const counters = new Map<string, number>();
    const offset = radius * 0.95 + 0.08;
    for (const atom of this.atoms) {
      const nextIndex = (counters.get(atom.element) ?? 0) + 1;
      counters.set(atom.element, nextIndex);
      const isMuted = Boolean(options.focus && options.focus !== 'all' && atom.positionType !== options.focus);
      const bg = isMuted
        ? '#94A3B8'
        : options.coloring === 'element'
          ? elementColors[atom.element] ?? '#8A94A6'
          : positionColors[atom.positionType];
      const ink = elementInk(bg);
      const el = document.createElement('div');
      el.className = 'atom-label';
      el.style.setProperty('--label-bg', bg);
      el.style.setProperty('--label-ink', ink);
      if (isMuted) el.setAttribute('data-muted', 'true');
      el.innerHTML = `${atom.element}<sup>${nextIndex}</sup>`;
      const object = new CSS2DObject(el);
      const position = this.worldPosition(atom, structure, options.extension);
      object.position.set(position.x, position.y + offset, position.z);
      this.labelGroup.add(object);
    }
  }

  private clearLabels(): void {
    while (this.labelGroup.children.length > 0) {
      const child = this.labelGroup.children[0];
      this.labelGroup.remove(child);
      if (child instanceof CSS2DObject) child.element.remove();
    }
  }

  /** 计算给定预设的相机目标位置、up 向量和观察中心 */
  private computeCameraPosition(preset: CameraPreset): { position: THREE.Vector3; up: THREE.Vector3; target: THREE.Vector3 } {
    if (!this.structure || !this.options) throw new Error('No structure set');
    const distance = this.structure.cell.a * this.options.extension * 4.5;
    const directions: Record<CameraPreset, THREE.Vector3> = {
      textbook: new THREE.Vector3(1.1, 0.85, 1.3),
      a: new THREE.Vector3(1, 0, 0),
      b: new THREE.Vector3(0, 0, 1),
      c: new THREE.Vector3(0, 1, 0),
      '110': new THREE.Vector3(1, 0, 1),
      '111': new THREE.Vector3(1, 1, 1),
    };
    const position = directions[preset].clone().normalize().multiplyScalar(distance);
    const target = new THREE.Vector3(0, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);
    if (preset === 'c') up.set(0, 0, -1);
    return { position, up, target };
  }

  /** 同步 OrbitControls 状态到相机当前位置 */
  private syncControls(): void {
    this.controls.target.copy(new THREE.Vector3(0, 0, 0));
    this.controls.update();
  }

  private applyCameraPreset(animated = true): void {
    if (!this.structure || !this.options) return;
    const distance = this.structure.cell.a * this.options.extension * 4.5;
    this.controls.maxDistance = Math.max(40, distance * 2);
    const { position, up, target } = this.computeCameraPosition(this.cameraPreset);
    if (animated) {
      this.startCameraAnimation(position, up, target);
    } else {
      this.activeCamera.position.copy(position);
      this.activeCamera.up.copy(up);
      this.controls.target.copy(target);
      this.syncControls();
      this.invalidate();
    }
  }

  /** 启动相机平滑动画 */
  private startCameraAnimation(endPos: THREE.Vector3, endUp: THREE.Vector3, endTarget: THREE.Vector3): void {
    this.cameraAnimStartPos.copy(this.activeCamera.position);
    this.cameraAnimStartUp.copy(this.activeCamera.up);
    this.cameraAnimStartTarget.copy(this.controls.target);
    this.cameraAnimEndPos.copy(endPos);
    this.cameraAnimEndUp.copy(endUp);
    this.cameraAnimEndTarget.copy(endTarget);
    this.cameraAnimDuration = this.autoRotationActive ? this.autoRotationTransitionMs : 800;
    this.cameraAnimElapsed = 0;
    this.lastRenderTimestamp = 0;
    this.invalidate();
  }

  /** 每帧更新相机动画 */
  private updateCameraAnimation(dt: number): boolean {
    if (this.cameraAnimElapsed >= this.cameraAnimDuration) return false;
    this.cameraAnimElapsed += dt;
    const t = this.cameraAnimElapsed >= this.cameraAnimDuration ? 1 : this.cameraAnimElapsed / this.cameraAnimDuration;
    // easeInOutCubic
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    this.activeCamera.position.lerpVectors(this.cameraAnimStartPos, this.cameraAnimEndPos, ease);
    this.activeCamera.up.copy(this.cameraAnimStartUp).lerp(this.cameraAnimEndUp, ease).normalize();
    this.controls.target.lerpVectors(this.cameraAnimStartTarget, this.cameraAnimEndTarget, ease);
    if (t >= 1) {
      this.activeCamera.position.copy(this.cameraAnimEndPos);
      this.activeCamera.up.copy(this.cameraAnimEndUp);
      this.controls.target.copy(this.cameraAnimEndTarget);
    }
    this.syncControls();
    return t < 1;
  }

  private resize(): void {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);
    this.perspective.aspect = width / height;
    this.perspective.updateProjectionMatrix();
    // 立方体投影后对角线可达 √3·a ≈ 1.73a，半高取 1.05a 才不会在正交视图里裁切晶胞。
    const span = (this.structure?.cell.a ?? 3) * (this.options?.extension ?? 1) * 1.05;
    this.orthographic.left = -span * width / height;
    this.orthographic.right = span * width / height;
    this.orthographic.top = span;
    this.orthographic.bottom = -span;
    this.orthographic.updateProjectionMatrix();
    this.invalidate();
  }

  private invalidate(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(this.render);
  }

  private render = (timestamp: number): void => {
    this.raf = 0;
    // 计算帧间隔
    const dt = this.lastRenderTimestamp ? timestamp - this.lastRenderTimestamp : 0;
    this.lastRenderTimestamp = timestamp;
    // 相机动画
    const animating = this.updateCameraAnimation(dt);
    // 自动旋转状态机
    if (this.autoRotationActive) this.updateAutoRotation(dt);
    // 持续渲染条件：相机动画中 / 自动旋转中 / 阻尼衰减中
    const needsLoop = animating || this.autoRotationActive || this.dampingFrames > 0;
    this.controls.update();
    this.renderer.render(this.scene, this.activeCamera);
    this.labelRenderer.render(this.scene, this.activeCamera);
    if (needsLoop) {
      if (this.dampingFrames > 0) this.dampingFrames--;
      this.invalidate();
    }
  };

  // ── 晶体学方向自动旋转公共接口 ──

  /** 启动自动旋转序列 */
  startAutoRotation(): void {
    this.autoRotationActive = true;
    this.autoRotationIndex = 0;
    this.autoRotationState = 'idle';
    this.autoRotationTimer = 0;
    // 先过渡到序列第一个方向
    this.cameraPreset = this.autoRotationSequence[0];
    this.applyCameraPreset(true);
    this.autoRotationState = 'transitioning';
    this.onAutoRotationChange?.(true);
    this.onDirectionChange?.(this.autoRotationSequence[0]);
  }

  /** 停止自动旋转 */
  stopAutoRotation(): void {
    if (!this.autoRotationActive) return;
    this.autoRotationActive = false;
    this.autoRotationState = 'idle';
    this.autoRotationTimer = 0;
    this.onAutoRotationChange?.(false);
  }

  get isAutoRotating(): boolean {
    return this.autoRotationActive;
  }

  /** 设置停留时间（毫秒），范围 500~10000 */
  setDwellMs(ms: number): void {
    this.autoRotationDwellMs = Math.max(500, Math.min(10000, ms));
  }

  get dwellMs(): number {
    return this.autoRotationDwellMs;
  }

  /** 自动旋转状态机：transitioning → dwelling → transitioning → … */
  private updateAutoRotation(dt: number): void {
    this.autoRotationTimer += dt;
    if (this.autoRotationState === 'transitioning') {
      if (this.autoRotationTimer >= this.autoRotationTransitionMs) {
        this.autoRotationTimer = 0;
        this.autoRotationState = 'dwelling';
        // 同步控制器，确保停留期间 OrbitControls 知道当前相机状态
        this.syncControls();
      }
    } else if (this.autoRotationState === 'dwelling') {
      if (this.autoRotationTimer >= this.autoRotationDwellMs) {
        this.autoRotationTimer = 0;
        this.autoRotationIndex = (this.autoRotationIndex + 1) % this.autoRotationSequence.length;
        this.cameraPreset = this.autoRotationSequence[this.autoRotationIndex];
        this.applyCameraPreset(true);
        this.autoRotationState = 'transitioning';
        this.onDirectionChange?.(this.autoRotationSequence[this.autoRotationIndex]);
      }
    }
  }

  private pick(event: PointerEvent): { atom: RenderedAtom; index: number } | null {
    if (this.atomMeshes.length === 0) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.activeCamera);
    const hit = this.raycaster.intersectObjects(this.atomMeshes, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    const meshAtoms = (hit.object as THREE.InstancedMesh).userData.atoms as RenderedAtom[];
    return { atom: meshAtoms[hit.instanceId], index: hit.instanceId };
  }

  private handlePointerDown = (event: PointerEvent): void => {
    this.pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() };
  };

  private handlePointerUp = (event: PointerEvent): void => {
    const moved = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
    if (moved >= 5 || performance.now() - this.pointerStart.time >= 300) return;
    const picked = this.pick(event);
    this.onSelect(picked?.atom ?? null);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    this.renderer.domElement.style.cursor = this.pick(event) ? 'pointer' : 'grab';
  };

  private handlePointerLeave = (): void => {
    this.renderer.domElement.style.cursor = 'grab';
  };

  private disposeGroup(): void {
    this.content.traverse((child) => {
      if (child instanceof CSS2DObject) child.element.remove();
    });
    this.content.clear();
    this.atomMeshes = [];
    this.bondResources.forEach((resource) => resource.dispose());
    this.bondResources = [];
    this.content.rotation.set(0, 0, 0);
    this.labelGroup.rotation.set(0, 0, 0);
    this.measureGroup.rotation.set(0, 0, 0);
    this.coordGroup.rotation.set(0, 0, 0);
    this.highlightGroup.rotation.set(0, 0, 0);
    this.clearLabels();
    this.clearGroup(this.measureGroup);
    this.clearGroup(this.coordGroup);
    this.clearGroup(this.highlightGroup);
  }

  dispose(): void {
    this.stopAutoRotation();
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerleave', this.handlePointerLeave);
    this.clearLabels();
    this.clearGroup(this.measureGroup);
    this.clearGroup(this.coordGroup);
    this.bondResources.forEach((resource) => resource.dispose());
    this.bondResources = [];
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
