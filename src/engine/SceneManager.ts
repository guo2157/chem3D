import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { CameraPreset, ColoringMode, CrystalStructure, DisplayStyle, PositionType, RenderedAtom } from '../types/crystal';
import { elementColors, elementInk, positionColors } from '../data/structures';
import { generateRenderedAtoms } from '../math/crystal';

export interface SceneOptions {
  extension: 1 | 2 | 3;
  displayStyle: DisplayStyle;
  coloring: ColoringMode;
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
  private atoms: RenderedAtom[] = [];
  private selectedOuter?: THREE.Mesh;
  private selectedInner?: THREE.Mesh;
  private structure?: CrystalStructure;
  private options?: SceneOptions;
  private cameraPreset: CameraPreset = 'textbook';
  private raf = 0;
  private dampingFrames = 0;
  private pointerStart = { x: 0, y: 0, time: 0 };

  constructor(
    private readonly container: HTMLElement,
    private readonly onSelect: (atom: RenderedAtom | null) => void,
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
    controls.addEventListener('start', () => { this.dampingFrames = 45; this.invalidate(); });
    controls.addEventListener('change', () => { this.dampingFrames = Math.max(this.dampingFrames, 4); this.invalidate(); });
    controls.addEventListener('end', () => { this.dampingFrames = 35; this.invalidate(); });
    return controls;
  }

  setStructure(structure: CrystalStructure, options: SceneOptions): void {
    this.structure = structure;
    this.options = options;
    this.rebuild();
  }

  updateOptions(options: SceneOptions): void {
    if (!this.structure) return;
    this.options = options;
    this.rebuild();
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
    const makeShell = (scale: number, color: number) => new THREE.Mesh(
      new THREE.SphereGeometry(radius * scale, 24, 18),
      new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, depthTest: false, transparent: true, opacity: 0.95 }),
    );
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

  private rebuild(): void {
    if (!this.structure || !this.options) return;
    this.disposeGroup();
    const { structure, options } = this;
    this.atoms = generateRenderedAtoms(structure, options.extension);
    const radius = this.atomRadius(structure, options.displayStyle);
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
    const grouped = new Map<string, { color: string; atoms: RenderedAtom[] }>();
    const mutedHex = '#94A3B8';
    for (const atom of this.atoms) {
      const isMuted = Boolean(options.focus && options.focus !== 'all' && atom.positionType !== options.focus);
      const atomColor = isMuted
        ? mutedHex
        : options.coloring === 'element'
          ? elementColors[atom.element] ?? '#8A94A6'
          : positionColors[atom.positionType];
      const group = grouped.get(atomColor) ?? { color: atomColor, atoms: [] };
      group.atoms.push(atom);
      grouped.set(atomColor, group);
    }
    this.atomMeshes = [];
    for (const group of grouped.values()) {
      const material = new THREE.MeshPhongMaterial({ color: group.color, shininess: 55, specular: 0x6b7280, clippingPlanes });
      const mesh = new THREE.InstancedMesh(sphere, material, group.atoms.length);
      const matrix = new THREE.Matrix4();
      group.atoms.forEach((atom, index) => {
        const position = this.worldPosition(atom, structure, options.extension);
        matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(radius, radius, radius));
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.atoms = group.atoms;
      this.atomMeshes.push(mesh);
      this.content.add(mesh);
    }
    if (options.showCell) this.buildCells(structure, options.extension, options.highContrast);
    if (options.showBodyDiagonal) this.buildBodyDiagonal(structure, options.highContrast);
    if (options.showFaceDiagonal) this.buildFaceDiagonals(structure, options.highContrast);
    if (options.showAxes) this.buildAxes(structure, options.extension);
    if (options.projection !== 'none') this.buildProjection(structure, options, radius);
    if (options.showLabels) this.buildLabels(structure, options, radius);
    this.applyCameraPreset();
    this.invalidate();
  }

  private atomRadius(structure: CrystalStructure, style: DisplayStyle): number {
    if (style === 'packing') {
      if (structure.id === 'bcc-fe') return Math.sqrt(3) * structure.cell.a / 4;
      if (structure.id === 'fcc-cu') return Math.sqrt(2) * structure.cell.a / 4;
      return structure.cell.a / 2;
    }
    return style === 'skeleton' ? structure.cell.a * 0.11 : structure.cell.a * 0.19;
  }

  private worldPosition(atom: RenderedAtom, structure: CrystalStructure, extension: number): THREE.Vector3 {
    const cx = extension * structure.cell.a / 2;
    const cy = extension * structure.cell.b / 2;
    const cz = extension * structure.cell.c / 2;
    return new THREE.Vector3(atom.cart[0] - cx, atom.cart[2] - cz, atom.cart[1] - cy);
  }

  private buildCells(structure: CrystalStructure, extension: number, highContrast: boolean): void {
    const lineMaterial = new THREE.LineBasicMaterial({
      color: highContrast ? 0x0f172a : 0x475569,
      transparent: true,
      opacity: highContrast ? 0.95 : 0.75,
      linewidth: highContrast ? 3 : 2,
    });
    const a = structure.cell.a;
    for (let i = 0; i < extension; i++) for (let j = 0; j < extension; j++) for (let k = 0; k < extension; k++) {
      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(a, a, a));
      const lines = new THREE.LineSegments(edges, lineMaterial);
      lines.position.set((i + 0.5) * a - extension * a / 2, (k + 0.5) * a - extension * a / 2, (j + 0.5) * a - extension * a / 2);
      this.content.add(lines);
    }
  }

  private buildBodyDiagonal(structure: CrystalStructure, highContrast = false): void {
    const half = structure.cell.a / 2;
    const start = new THREE.Vector3(-half, -half, -half);
    const end = new THREE.Vector3(half, half, half);
    this.content.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([start, end]),
      new THREE.LineBasicMaterial({ color: 0xe11d48, linewidth: highContrast ? 3 : 2 }),
    ));
    const labelEl = document.createElement('div');
    labelEl.className = 'diag-label diag-body';
    labelEl.innerHTML = `体对角线 √3·a = <b>${(Math.sqrt(3) * structure.cell.a).toFixed(3)} Å</b>`;
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
    const material = new THREE.LineDashedMaterial({
      color: 0x8b5cf6,
      dashSize: 0.15,
      gapSize: 0.08,
      linewidth: highContrast ? 3 : 2,
    });
    let labelDrawn = false;
    for (const t of targets) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin, t.end]), material);
      line.computeLineDistances();
      this.content.add(line);
      if (!labelDrawn) {
        const labelEl = document.createElement('div');
        labelEl.className = 'diag-label diag-face';
        labelEl.innerHTML = `面对角线 √2·a = <b>${length.toFixed(3)} Å</b>`;
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
      const labelEl = document.createElement('div');
      labelEl.className = 'axis-label';
      labelEl.style.setProperty('--axis-color', `#${axis.color.toString(16).padStart(6, '0')}`);
      labelEl.textContent = axis.letter;
      const label = new CSS2DObject(labelEl);
      label.position.copy(origin).addScaledVector(axis.dir, length + 0.18);
      this.content.add(label);
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

  private applyCameraPreset(): void {
    if (!this.structure || !this.options) return;
    const distance = this.structure.cell.a * this.options.extension * 3.8;
    const directions: Record<CameraPreset, THREE.Vector3> = {
      textbook: new THREE.Vector3(1.1, 0.85, 1.3),
      a: new THREE.Vector3(1, 0, 0),
      b: new THREE.Vector3(0, 0, 1),
      c: new THREE.Vector3(0, 1, 0),
      '110': new THREE.Vector3(1, 0, 1),
      '111': new THREE.Vector3(1, 1, 1),
    };
    this.activeCamera.position.copy(directions[this.cameraPreset].normalize().multiplyScalar(distance));
    this.activeCamera.up.set(0, 1, 0);
    if (this.cameraPreset === 'c') this.activeCamera.up.set(0, 0, -1);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.invalidate();
  }

  private resize(): void {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);
    this.perspective.aspect = width / height;
    this.perspective.updateProjectionMatrix();
    const span = (this.structure?.cell.a ?? 3) * (this.options?.extension ?? 1) * 0.8;
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

  private render = (): void => {
    this.raf = 0;
    if (this.options?.autoRotate) {
      this.content.rotation.y += 0.003;
      this.labelGroup.rotation.y = this.content.rotation.y;
      this.measureGroup.rotation.y = this.content.rotation.y;
      this.coordGroup.rotation.y = this.content.rotation.y;
      this.highlightGroup.rotation.y = this.content.rotation.y;
      this.dampingFrames = 2;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.activeCamera);
    this.labelRenderer.render(this.scene, this.activeCamera);
    if (this.dampingFrames > 0 || this.options?.autoRotate) {
      this.dampingFrames--;
      this.invalidate();
    }
  };

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
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
