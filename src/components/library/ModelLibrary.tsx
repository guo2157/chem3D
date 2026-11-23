import { useMemo, useState } from 'react';
import { Atom, CheckCircle2, ChevronDown, FlaskConical, Search, X } from 'lucide-react';
import { popularStructureIds, structures } from '../../data/structures';
import type { CrystalCategory, CrystalStructure } from '../../types/crystal';
import { useAppStore } from '../../store/useAppStore';

const CATEGORY_ORDER: CrystalCategory[] = ['ionic', 'covalent', 'metallic', 'basic-lattice', 'molecular', 'mixed'];
const CATEGORY_LABEL: Record<CrystalCategory, string> = {
  'ionic': '离子晶体',
  'covalent': '共价晶体',
  'metallic': '金属晶体',
  'basic-lattice': '基础点阵',
  'molecular': '分子晶体',
  'mixed': '混合型晶体',
};

interface GroupedStructures { category: CrystalCategory; items: CrystalStructure[] }

function groupByCategory(list: CrystalStructure[]): GroupedStructures[] {
  const map = new Map<CrystalCategory, CrystalStructure[]>();
  for (const structure of list) {
    const bucket = map.get(structure.category) ?? [];
    bucket.push(structure);
    map.set(structure.category, bucket);
  }
  return CATEGORY_ORDER
    .map((category) => ({ category, items: map.get(category) ?? [] }))
    .filter((group) => group.items.length > 0);
}

export function ModelLibrary() {
  const modelId = useAppStore((state) => state.modelId);
  const setModel = useAppStore((state) => state.setModel);
  const setLeftOpen = useAppStore((state) => state.setLeftOpen);
  const [keyword, setKeyword] = useState('');
  const [collapsed, setCollapsed] = useState<Set<CrystalCategory>>(() => new Set());

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return structures;
    return structures.filter((structure) => {
      const haystack = [structure.name, structure.shortName, structure.formula, structure.category, ...(structure.aliases ?? [])];
      return haystack.some((value) => value.toLowerCase().includes(normalized));
    });
  }, [keyword]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  const popular = useMemo(() => popularStructureIds
    .map((id) => structures.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  []);

  const pickModel = (id: string) => {
    setModel(id);
    if (window.innerWidth < 1024) setLeftOpen(false);
  };

  const toggleGroup = (category: CrystalCategory) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  // 搜索时自动展开全部分组
  const isCollapsed = (category: CrystalCategory) => keyword.trim() === '' && collapsed.has(category);

  return (
    <aside className="side-panel library-panel" aria-label="晶体模型库">
      <div className="panel-heading">
        <div><span className="eyebrow">模型库</span><h2>选择晶体结构</h2></div>
        <button className="icon-button mobile-only" aria-label="关闭模型库" onClick={() => setLeftOpen(false)}><X /></button>
      </div>
      <label className="search-box">
        <Search aria-hidden="true" />
        <input
          aria-label="搜索模型"
          placeholder="输入化学式或名称，如 NaCl / 氯化钠 / 萤石"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        {keyword && <button className="search-clear" aria-label="清空搜索" onClick={() => setKeyword('')}><X /></button>}
      </label>
      <div className="popular-chips" role="group" aria-label="常用化学式快捷">
        {popular.map((item) => (
          <button
            key={item.id}
            data-active={item.id === modelId}
            title={item.name}
            onClick={() => pickModel(item.id)}
          >
            {item.formula}
            <small>{item.shortName}</small>
          </button>
        ))}
      </div>
      {groups.length === 0 ? (
        <p className="search-empty">没有匹配的模型。换个关键词试试，如"NaCl""氯化铯""萤石"。</p>
      ) : (
        groups.map((group) => {
          const collapsedNow = isCollapsed(group.category);
          return (
            <section key={group.category} className="model-group" data-collapsed={collapsedNow ? 'true' : undefined}>
              <button
                className="group-title group-toggle"
                aria-expanded={!collapsedNow}
                onClick={() => toggleGroup(group.category)}
              >
                <span>{CATEGORY_LABEL[group.category]}</span>
                <small>{group.items.length}</small>
                <ChevronDown className="group-chevron" />
              </button>
              {!collapsedNow && (
                <div className="model-list">
                  {group.items.map((structure) => {
                    const active = structure.id === modelId;
                    return (
                      <button className="model-card" data-active={active} key={structure.id} onClick={() => pickModel(structure.id)}>
                        <span className="model-thumb"><Atom aria-hidden="true" /></span>
                        <span className="model-copy">
                          <span className="model-title">{structure.shortName} <small>{structure.formula}</small></span>
                          <span>{structure.teaching.summary}</span>
                          <span className={structure.metadata.status === 'verified' ? 'status-text verified' : 'status-text experimental'}>
                            {structure.metadata.status === 'verified' ? <CheckCircle2 /> : <FlaskConical />}
                            {structure.metadata.status === 'verified' ? '教学已核对' : '实验模型'}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      )}
      <p className="panel-note">提示：模型右侧可开关"原子标签"，每个原子按元素独立编号（Na¹、Cl²…），拖拽即可 3D 旋转。</p>
    </aside>
  );
}
