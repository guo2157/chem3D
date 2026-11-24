import { useEffect, useRef } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Calculator, ChevronRight, Copy, Eye, Focus, Gauge, Ruler, ScanLine, Sparkles, X } from 'lucide-react';
import type { CrystalStructure } from '../../types/crystal';
import { cellVolume, density, formatFraction, particleCount } from '../../math/crystal';
import { elementColors } from '../../data/structures';
import { useAppStore } from '../../store/useAppStore';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { Tip } from '../common/Tooltip';

/** Å（埃）单位说明，多处复用。 */
const ANGSTROM_TIP = 'Å 是长度单位"埃"（Ångström）：1 Å = 10⁻¹⁰ m = 0.1 nm = 100 pm，常用于描述原子尺度的距离。';

function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return <div className="segmented" role="group" aria-label={label}>{options.map((item) => <button key={item.value} aria-pressed={value === item.value} onClick={() => onChange(item.value)}>{item.label}</button>)}</div>;
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void }) {
  return <button className="toggle-row" aria-pressed={value} onClick={() => onChange(!value)}><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span><span className="switch" /></button>;
}

function AtomCard() {
  const atom = useAppStore((state) => state.selectedAtom);
  const setSelectedAtom = useAppStore((state) => state.setSelectedAtom);
  const highlightSite = useAppStore((state) => state.highlightSite);
  const setHighlightSite = useAppStore((state) => state.setHighlightSite);
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (atom && window.matchMedia('(max-width: 767px)').matches) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [atom?.key]);
  if (!atom) return null;
  const labels = { vertex: '顶点', edge: '棱心', face: '面心', interior: '体内' };
  const dotColor = elementColors[atom.element] ?? 'var(--primary)';
  const active = highlightSite === atom.siteId;
  return (
    <section className="atom-card" ref={cardRef}>
      <button
        className="atom-card-close"
        aria-label="取消选择"
        onClick={() => { setSelectedAtom(null); setHighlightSite(null); }}
      ><X /></button>
      <div className="atom-card-title"><span className="element-dot" style={{ background: dotColor }} /> <div><strong>{atom.siteId} · {atom.element}</strong><small>{labels[atom.positionType]}原子</small></div></div>
      <dl>
        <div><dt><Tip text="原子在晶胞中的相对位置，以晶胞棱长 a、b、c 为单位，取值 0~1。例如 (1/2, 1/2, 1/2) 表示体心。">分数坐标</Tip></dt><dd>({atom.frac.map(formatFraction).join(', ')})</dd></div>
        <div><dt><Tip text="该位置的原子被相邻晶胞共享的比例：顶点 1/8、棱心 1/4、面心 1/2、体内 1。统计晶胞粒子数时按此折算。">晶胞贡献</Tip></dt><dd>{atom.contribution === 1 ? '1' : `1/${Math.round(1 / atom.contribution)}`}</dd></div>
        <div><dt><Tip text="由该位点按分数坐标平移复制出的原子个数，它们彼此等效。">等效副本</Tip></dt><dd>{atom.equivalentCopies} 个</dd></div>
      </dl>
      <button
        className="secondary-action"
        aria-pressed={active}
        onClick={() => setHighlightSite(active ? null : atom.siteId)}
      ><Focus /> {active ? '取消高亮' : '高亮全部副本'}</button>
    </section>
  );
}

export function Inspector({ structure }: { structure: CrystalStructure }) {
  const store = useAppStore();
  const reducedMotion = useReducedMotion();
  const count = particleCount(structure);
  const volume = cellVolume(structure);
  const rho = density(structure);
  const measureDistance = store.measurePair[0] && store.measurePair[1]
    ? Math.hypot(
        store.measurePair[0].cart[0] - store.measurePair[1].cart[0],
        store.measurePair[0].cart[1] - store.measurePair[1].cart[1],
        store.measurePair[0].cart[2] - store.measurePair[1].cart[2],
      )
    : null;
  const copyResult = () => navigator.clipboard?.writeText(`N = ${count}; V = ${volume.toFixed(3)} Å³; ρ = ${rho.toFixed(3)} g/cm³`);

  return (
    <aside className="side-panel inspector-panel" aria-label="观察、分析与计算工具">
      <AtomCard />
      <Tabs.Root value={store.inspectorTab} onValueChange={(value) => store.setInspectorTab(value as typeof store.inspectorTab)} className="inspector-tabs">
        <Tabs.List className="tabs-list" aria-label="工具分类">
          <Tabs.Trigger value="observe"><Eye />观察</Tabs.Trigger>
          <Tabs.Trigger value="analyze"><ScanLine />分析</Tabs.Trigger>
          <Tabs.Trigger value="calculate"><Calculator />计算</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="observe" className="tab-content">
          <section className="control-section"><h3><Tip text="球棍：原子画成小球、键画成短棍；堆积：原子按实际相切比例放大；骨架：只保留连线，便于观察几何结构。">显示样式</Tip></h3><Segmented label="显示样式" value={store.displayStyle} onChange={store.setDisplayStyle} options={[{ value: 'ball-stick', label: '球棍' }, { value: 'packing', label: '堆积' }, { value: 'skeleton', label: '骨架' }]} /></section>
          <section className="control-section"><h3><Tip text="按元素：不同元素不同颜色；按位置：按顶点 / 棱心 / 面心 / 体内着色，便于观察各类位置的贡献。">着色方式</Tip></h3><Segmented label="着色方式" value={store.coloring} onChange={store.setColoring} options={[{ value: 'element', label: '按元素' }, { value: 'position', label: '按位置' }]} /></section>
          <section className="control-section"><h3><Tip text="沿 a、b、c 三个方向把晶胞复制成 2×2×2 或 3×3×3，观察晶体的周期性排列。">晶胞扩展</Tip></h3><Segmented label="晶胞扩展" value={store.extension} onChange={store.setExtension} options={[{ value: 1, label: '1×1×1' }, { value: 2, label: '2×2×2' }, { value: 3, label: '3×3×3' }]} /></section>
          <ToggleRow label="截断显示" hint="把被晶胞边界切开的原子按比例截断，直观看到 1/8、1/2 等贡献" value={store.truncate} onChange={store.setTruncate} />
          <ToggleRow label="原子标签" hint="在每个原子旁显示位点名称" value={store.showLabels} onChange={store.setShowLabels} />
          <ToggleRow
            label="自动旋转"
            hint={reducedMotion ? '系统已开启"减少动态效果"，自转已禁用' : undefined}
            value={reducedMotion ? false : store.autoRotate}
            onChange={(value) => { if (!reducedMotion) store.setAutoRotate(value); }}
          />
          <p className="teaching-note">球体大小为教学示意，不代表原子真实边界。</p>
        </Tabs.Content>
        <Tabs.Content value="analyze" className="tab-content">
          <section className="control-section">
            <h3>几何辅助</h3>
            <ToggleRow label="晶胞边框" hint="画出晶胞的 12 条棱，框出一个晶胞的范围" value={store.showCell} onChange={store.setShowCell} />
            <ToggleRow label="3D 坐标轴" hint="真实 a / b / c 轴矢量（红/绿/蓝）" value={store.showAxes} onChange={store.setShowAxes} />
            <ToggleRow label="体对角线" hint="显示体对角线 √3·a；体心立方中原子沿体对角线相切：4r = √3·a" value={store.showBodyDiagonal} onChange={store.setShowBodyDiagonal} />
            <ToggleRow label="面对角线" hint="显示面对角线 √2·a（3 条相邻面）；面心立方中原子沿面对角线相切：4r = √2·a" value={store.showFaceDiagonal} onChange={store.setShowFaceDiagonal} />
          </section>
          <section className="control-section">
            <h3>投影平面</h3>
            <Segmented
              label="投影平面"
              value={store.projection}
              onChange={store.setProjection}
              options={[
                { value: 'none', label: '关闭' },
                { value: 'xy', label: 'ab 底面' },
                { value: 'xz', label: 'ac 侧面' },
                { value: 'yz', label: 'bc 侧面' },
              ]}
            />
            <p className="teaching-note" style={{ marginTop: 10 }}>投影会在所选平面上生成每个原子的色点与竖向连线，便于观察平面排列。</p>
          </section>
          <button className="analysis-action" data-active={store.measureMode} onClick={store.toggleMeasureMode}>
            <Ruler />
            <span>
              <strong><Tip text={`测量两个原子中心之间的直线距离，单位 Å（埃）：1 Å = 10⁻¹⁰ m = 0.1 nm。本模型晶胞棱长 a = ${structure.cell.a} Å，即晶胞一条棱的长度。`} focusable={false}>测量距离</Tip>{store.measureMode ? '（进行中）' : ''}</strong>
              <small>
                {store.measureMode
                  ? measureDistance !== null
                    ? <>{store.measurePair[0]!.siteId} ↔ {store.measurePair[1]!.siteId}：{measureDistance.toFixed(3)} <Tip text={ANGSTROM_TIP} focusable={false}>Å</Tip></>
                    : '依次点选两个原子'
                  : '依次点选两个原子，自动显示距离'}
              </small>
            </span>
            <ChevronRight />
          </button>
          <button
            className="analysis-action"
            data-active={store.showCoordination}
            onClick={() => store.setShowCoordination(!store.showCoordination)}
          >
            <Sparkles />
            <span>
              <strong><Tip text="配位数 = 与某个原子距离最近的原子个数。开启后先点选一个原子作中心，会高亮它的所有最近邻，并标出配位数与最近邻距离。" focusable={false}>显示配位关系</Tip>{store.showCoordination ? '（已开启）' : ''}</strong>
              <small>
                {store.showCoordination
                  ? store.selectedAtom
                    ? `以 ${store.selectedAtom.siteId} 为中心，显示最近邻`
                    : '请先在画布中选择一个原子作为中心'
                  : `当前模型参考配位数 ${structure.coordinationNumber}`}
              </small>
            </span>
            <ChevronRight />
          </button>
          {!store.selectedAtom && (
            <div className="empty-prompt"><Gauge /><p>选择一个原子后，可查看它的坐标、晶胞贡献和等效副本。</p></div>
          )}
        </Tabs.Content>
        <Tabs.Content value="calculate" className="tab-content calculations">
          <section className="calculation-card">
            <span><Tip text="一个晶胞内实际包含的原子数。顶点原子被 8 个晶胞共享记 1/8，棱心记 1/4，面心记 1/2，体内记 1，再乘以各元素的位点个数。">晶胞粒子数</Tip> Z</span>
            <strong>{count}</strong>
            <p>{structure.id === 'bcc-fe' ? '8 × 1/8 + 1 × 1 = 2' : `唯一位点占有率之和 = ${count}`}</p>
            <button
              onClick={() => useAppStore.getState().setCountingStage(0)}
              aria-label="开始粒子计数演示"
            >演示过程</button>
          </section>
          <section className="calculation-card">
            <span><Tip text="晶胞体积 = 三条棱长之积。立方晶胞 a = b = c，所以 V = a³。Å³ 是体积单位“立方埃”：1 Å³ = 10⁻³⁰ m³。">晶胞体积</Tip></span>
            <strong>{volume.toFixed(3)} <small>Å³</small></strong>
            <p>
              V = a × b × c = {structure.cell.a} × {structure.cell.b} × {structure.cell.c}
              <br />= {structure.cell.a}³ = {volume.toFixed(3)} Å³
            </p>
          </section>
          <section className="calculation-card featured">
            <span><Tip text="由晶胞粒子数与体积算出的理论密度：ρ = Z·M /(Nₐ·V)。Z 为晶胞粒子数，M 为摩尔质量（g/mol），Nₐ 为阿伏加德罗常数，V 为晶胞体积（换算成 cm³）。">理论密度</Tip> ρ</span>
            <strong>{rho.toFixed(3)} <small>g·cm⁻³</small></strong>
            <p>
              ρ = ZM / (NₐV)
              <br />= {structure.Z} × {structure.atomicMass} / (6.022×10²³ × {volume.toFixed(3)}×10⁻²⁴)
            </p>
          </section>
          <button className="copy-button" onClick={copyResult}><Copy />复制计算结果</button>
        </Tabs.Content>
      </Tabs.Root>
    </aside>
  );
}
