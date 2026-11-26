import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Cuboid, Grid3X3, Pause, Play, RotateCcw, ScanLine, Tags, X } from 'lucide-react';
import type { CrystalStructure, PositionType } from '../../types/crystal';
import { SceneManager } from '../../engine/SceneManager';
import { useAppStore } from '../../store/useAppStore';
import { elementColors, positionColors } from '../../data/structures';
import { bccLesson } from '../../data/lessons';
import { StepPlayer } from '../teaching/StepPlayer';
import { Narration } from '../teaching/Narration';
import { buildCountingPhases } from '../../modules/counting';

function QuickToggle({ label, hint, pressed, onToggle, children }: { label: string; hint?: string; pressed: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} aria-label={`${label}${pressed ? '，已开启' : ''}`} title={hint ? `${label}：${hint}` : label} onClick={onToggle}>
      {children}
      <span>{label}</span>
      {pressed && <span className="toggle-corner" aria-hidden="true"><Check /></span>}
    </button>
  );
}

function CountingOverlay({ structure }: { structure: CrystalStructure }) {
  const stage = useAppStore((state) => state.countingStage);
  const setStage = useAppStore((state) => state.setCountingStage);
  const phases = useMemo(() => buildCountingPhases(structure), [structure]);
  if (stage === null) return null;
  const phase = phases[Math.min(stage, phases.length - 1)];
  const totalStages = phases.length;
  return (
    <div className="counting-overlay" role="status" aria-live="polite">
      <header>
        <span>粒子计数演示</span>
        <button className="icon-button" aria-label="结束演示" onClick={() => setStage(null)}><X /></button>
      </header>
      <ol className="counting-stages">
        {phases.map((p, index) => (
          <li key={p.label} data-active={index === stage} data-done={index < stage}>
            <strong>{p.label}</strong>
            <small>{p.siteCount} × {p.contribution === 1 ? '1' : `1/${Math.round(1 / p.contribution)}`}</small>
          </li>
        ))}
      </ol>
      <p className="counting-formula">{phase.formula}</p>
      <nav>
        <button disabled={stage === 0} onClick={() => setStage(Math.max(0, stage - 1))}>上一步</button>
        <button
          onClick={() => {
            if (stage >= totalStages - 1) setStage(null);
            else setStage(stage + 1);
          }}
        >{stage >= totalStages - 1 ? '完成' : '下一步'}</button>
      </nav>
    </div>
  );
}

export function CrystalViewport({ structure }: { structure: CrystalStructure }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<SceneManager>();
  const store = useAppStore();
  const [autoRotating, setAutoRotating] = useState(false);
  const [dwellMs, setDwellMsState] = useState(2000);
  const lesson = bccLesson[store.lessonStep];
  const countingPhases = useMemo(() => buildCountingPhases(structure), [structure]);
  const focus: PositionType | 'all' = useMemo(() => {
    if (store.mode === 'teach' || store.mode === 'classroom') return lesson.focus ?? 'all';
    if (store.countingStage !== null) {
      const phase = countingPhases[Math.min(store.countingStage, countingPhases.length - 1)];
      return phase.focus ?? 'all';
    }
    return 'all';
  }, [store.mode, store.countingStage, countingPhases, lesson.focus]);
  const sceneOptions = useMemo(() => ({
    extension: store.extension,
    displayStyle: store.displayStyle,
    coloring: store.coloring,
    appearancePreset: store.appearancePreset,
    truncate: store.truncate,
    showCell: store.showCell,
    showBodyDiagonal: store.showBodyDiagonal,
    showFaceDiagonal: store.showFaceDiagonal,
    showAxes: store.showAxes,
    projection: store.projection,
    showLabels: store.showLabels,
    autoRotate: store.autoRotate,
    highContrast: store.highContrast,
    focus,
  }), [store.extension, store.displayStyle, store.coloring, store.appearancePreset, store.truncate, store.showCell, store.showBodyDiagonal, store.showFaceDiagonal, store.showAxes, store.projection, store.showLabels, store.autoRotate, store.highContrast, focus]);

  useEffect(() => {
    if (!hostRef.current) return;
    managerRef.current = new SceneManager(hostRef.current, (atom) => {
      const state = useAppStore.getState();
      if (state.measureMode && atom) state.pushMeasureAtom(atom);
      else state.setSelectedAtom(atom);
    }, (active) => setAutoRotating(active), (preset) => {
      const state = useAppStore.getState();
      state.setCameraPreset(preset);
    });
    return () => managerRef.current?.dispose();
  }, []);

  useEffect(() => managerRef.current?.setStructure(structure, sceneOptions), [structure]);
  useEffect(() => { managerRef.current?.updateOptions(sceneOptions); }, [sceneOptions]);
  useEffect(() => managerRef.current?.setCamera(store.orthographic, store.cameraPreset), [store.orthographic, store.cameraPreset]);
  useEffect(() => managerRef.current?.selectAtom(store.selectedAtom), [store.selectedAtom, sceneOptions]);
  useEffect(() => managerRef.current?.setMeasure(store.measurePair[0], store.measurePair[1]), [store.measurePair, sceneOptions]);
  useEffect(() => {
    managerRef.current?.setCoordination(store.showCoordination ? store.selectedAtom : null);
  }, [store.showCoordination, store.selectedAtom, sceneOptions]);
  useEffect(() => {
    managerRef.current?.setSiteHighlight(store.highlightSite);
  }, [store.highlightSite, sceneOptions, structure.id]);

  // 计数演示启动时自动切换到位置着色 + 截断显示；结束时不强制回滚，由用户决定。
  useEffect(() => {
    if (store.countingStage === 0) {
      store.setColoring('position');
      store.setTruncate(true);
    }
  }, [store.countingStage === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const legendItems = store.coloring === 'element'
    ? Array.from(new Set(structure.sites.map((site) => site.element)))
        .map((element) => ({ key: element, color: elementColors[element] ?? '#8A94A6', label: `${element} 元素` }))
    : [
      { key: 'vertex', color: positionColors.vertex, label: '顶点 · 1/8' },
      { key: 'face', color: positionColors.face, label: '面心 · 1/2' },
      { key: 'interior', color: positionColors.interior, label: '体内 · 1' },
    ];

  const classroom = store.mode === 'classroom';
  const teaching = store.mode === 'teach';

  return (
    <main
      className="viewport"
      data-mode={store.mode}
      data-appearance={store.appearancePreset}
      data-measure={store.measureMode ? 'true' : undefined}
      aria-label={`${structure.name} 三维晶胞画布。可拖动旋转，滚轮缩放，点击原子查看信息。`}
    >
      <div ref={hostRef} className="scene-host" />
      {store.measureMode && (
        <div className="measure-banner" role="status">
          <strong>测量距离</strong>
          <span title="测量两个原子中心之间的直线距离，结果单位为 Å（埃）：1 Å = 10⁻¹⁰ m = 0.1 nm。">
            {!store.measurePair[0] && '点击第 1 个原子'}
            {store.measurePair[0] && !store.measurePair[1] && '点击第 2 个原子'}
            {store.measurePair[0] && store.measurePair[1] && '再次点击可重新测量'}
          </span>
          <button onClick={store.clearMeasure} aria-label="清除测量">清除</button>
          <button onClick={store.toggleMeasureMode} aria-label="退出测量">退出</button>
        </div>
      )}
      {!classroom && !teaching && !store.measureMode && store.countingStage === null && <div className="viewport-hint">拖动旋转 · 滚轮缩放 · 点击选择原子</div>}
      {!classroom && !teaching && (
        <div className="camera-controls">
          <div className="camera-row">
            <div className="direction-buttons" role="group" aria-label="晶体学观察方向">
              {([
                { value: 'a' as const, label: '[100]' },
                { value: 'b' as const, label: '[010]' },
                { value: 'c' as const, label: '[001]' },
                { value: '110' as const, label: '[110]' },
                { value: '111' as const, label: '[111]' },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={store.cameraPreset === value}
                  aria-label={`观察方向 ${label}`}
                  title={`沿 ${label} 方向观察晶胞`}
                  onClick={() => {
                    managerRef.current?.stopAutoRotation();
                    store.setCameraPreset(value);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="view-controls">
              <button
                type="button"
                aria-pressed={autoRotating}
                aria-label={autoRotating ? '停止自动旋转' : '开始自动旋转'}
                title={autoRotating ? '停止自动旋转' : `自动旋转：${['[100]','[010]','[001]','[110]','[111]'].join(' → ')} → …`}
                onClick={() => {
                  if (autoRotating) {
                    managerRef.current?.stopAutoRotation();
                  } else {
                    store.setCameraPreset('a');
                    setTimeout(() => managerRef.current?.startAutoRotation(), 50);
                  }
                }}
              >
                {autoRotating ? <Pause /> : <Play />}
                <span>{autoRotating ? '停止' : '旋转'}</span>
              </button>
              <button
                aria-pressed={store.orthographic}
                aria-label="切换透视与正交"
                title={store.orthographic ? '正交投影：平行线保持平行，适合读几何关系' : '透视投影：近大远小，接近人眼观感'}
                onClick={() => store.setOrthographic(!store.orthographic)}
              >
                {store.orthographic ? '正交' : '透视'}
              </button>
            </div>
          </div>
          <div className="dwell-control" title="自动旋转时每个方向的停留时间">
            <label htmlFor="dwell-slider">停留</label>
            <input
              id="dwell-slider"
              type="range"
              min={500}
              max={10000}
              step={500}
              value={dwellMs}
              onChange={(e) => {
                const ms = Number(e.target.value);
                setDwellMsState(ms);
                managerRef.current?.setDwellMs(ms);
              }}
            />
            <span className="dwell-value">{(dwellMs / 1000).toFixed(1)}s</span>
          </div>
        </div>
      )}
      {!classroom && teaching && (
        <div className="camera-controls">
          <select aria-label="观察方向" title="沿某个晶轴或晶向观察晶胞" value={store.cameraPreset} onChange={(event) => store.setCameraPreset(event.target.value as typeof store.cameraPreset)}>
            <option value="textbook">教材斜视</option><option value="a">正视 [100]</option><option value="b">侧视 [010]</option><option value="c">俯视 [001]</option><option value="110">对角视角 [110]</option><option value="111">体对角视角 [111]</option>
          </select>
        </div>
      )}
      {!classroom && (
        <div className="legend"><strong>{store.coloring === 'element' ? '元素图例' : '位置与贡献'}</strong>{legendItems.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}</div>
      )}
      {!classroom && store.showLabels && store.selectedAtom && (
        <div className="selected-label"><i style={{ background: elementColors[store.selectedAtom.element] }} />{store.selectedAtom.siteId} · ({store.selectedAtom.frac.join(', ')})</div>
      )}
      {!classroom && !teaching && (
        <div className="quick-toolbar" aria-label="画布快捷工具">
          <QuickToggle label="标签" hint="在每个原子旁显示位点名称" pressed={store.showLabels} onToggle={() => store.setShowLabels(!store.showLabels)}><Tags /></QuickToggle>
          <QuickToggle label="晶胞" hint="显示晶胞的 12 条棱" pressed={store.showCell} onToggle={() => store.setShowCell(!store.showCell)}><Cuboid /></QuickToggle>
          <QuickToggle label="截断" hint="把边界上的原子按 1/8、1/4、1/2 比例截断" pressed={store.truncate} onToggle={() => store.setTruncate(!store.truncate)}><Grid3X3 /></QuickToggle>
          <QuickToggle label="对角线" hint="显示体对角线 √3·a" pressed={store.showBodyDiagonal} onToggle={() => store.setShowBodyDiagonal(!store.showBodyDiagonal)}><ScanLine /></QuickToggle>
          <button type="button" aria-label="重置视角" title="重置视角" onClick={() => managerRef.current?.resetView()}><RotateCcw /><span>重置</span></button>
        </div>
      )}
      {teaching && (
        <>
          <div className="lesson-caption">
            <header><span>第 {store.lessonStep + 1} 步</span><strong>{lesson.title}</strong></header>
            <p><Narration text={lesson.narration} /></p>
            {lesson.calculation && <em>{lesson.calculation}</em>}
          </div>
          <StepPlayer />
        </>
      )}
      {!classroom && <CountingOverlay structure={structure} />}
      <div className="sr-only" aria-live="polite">{store.selectedAtom ? `已选择 ${store.selectedAtom.siteId}，${store.selectedAtom.positionType}位置` : '当前未选择原子'}</div>
    </main>
  );
}
