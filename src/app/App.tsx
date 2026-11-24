import { useEffect } from 'react';
import { AlertTriangle, MonitorUp } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import { HelpOverlay } from '../components/layout/HelpOverlay';
import { ModelLibrary } from '../components/library/ModelLibrary';
import { LessonDirectory } from '../components/teaching/LessonDirectory';
import { CrystalViewport } from '../components/viewport/CrystalViewport';
import { Inspector } from '../components/inspector/Inspector';
import { ClassroomOverlay } from '../components/classroom/ClassroomOverlay';
import { TipProvider } from '../components/common/Tooltip';
import { bccLesson } from '../data/lessons';
import { structureById } from '../data/structures';
import { useAppStore } from '../store/useAppStore';
import { useReducedMotion } from '../hooks/useReducedMotion';

function supportsWebGL2(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

export default function App() {
  const store = useAppStore();
  const structure = structureById(store.modelId);
  const isTeaching = store.mode === 'teach' || store.mode === 'classroom';
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    document.documentElement.dataset.theme = store.theme;
    document.documentElement.dataset.contrast = store.highContrast ? 'high' : 'normal';
    document.documentElement.dataset.mode = store.mode;
    document.documentElement.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
  }, [store.theme, store.highContrast, store.mode, reducedMotion]);

  // 开启"减少动态效果"后自动关闭自动旋转和自动播放，保持无突变。
  useEffect(() => {
    if (!reducedMotion) return;
    const state = useAppStore.getState();
    if (state.autoRotate) state.setAutoRotate(false);
    if (state.lessonPlaying) state.setLessonPlaying(false);
  }, [reducedMotion]);

  useEffect(() => {
    if (!isTeaching) return;
    if (structure.id !== 'bcc-fe') {
      store.setModel('bcc-fe');
      return;
    }
    const step = bccLesson[store.lessonStep];
    store.setColoring('element');
    store.setDisplayStyle('ball-stick');
    store.setTruncate(false);
    store.setShowBodyDiagonal(false);
    store.setExtension(1);
    store.setCameraPreset(step.camera);
    if (step.display?.coloring) store.setColoring(step.display.coloring);
    if (step.display?.displayStyle) store.setDisplayStyle(step.display.displayStyle);
    if (step.display?.truncate !== undefined) store.setTruncate(step.display.truncate);
    if (step.display?.showBodyDiagonal !== undefined) store.setShowBodyDiagonal(step.display.showBodyDiagonal);
    if (step.display?.extension) store.setExtension(step.display.extension);
  }, [isTeaching, store.lessonStep, structure.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      // Esc 不受 typing 拦截（即使在输入框也可以关浮层）
      if (event.key === 'Escape') {
        const dismissed = useAppStore.getState().dismissTopOverlay();
        if (dismissed) { event.preventDefault(); }
        return;
      }
      if (typing) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // ? 在浏览器里通常需要 Shift，有的键盘报 'Slash' + shift，有的直接报 '?'
      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault();
        useAppStore.getState().setHelpOpen(!useAppStore.getState().helpOpen);
        return;
      }
      // Space：教学模式下播放/暂停；按钮焦点时让浏览器按原意处理
      if (event.key === ' ' || event.code === 'Space') {
        if (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button') return;
        if (!isTeaching) return;
        event.preventDefault();
        useAppStore.getState().toggleLessonPlaying();
        return;
      }
      const actions: Record<string, () => void> = {
        r: () => store.setCameraPreset('textbook'),
        '0': () => store.setCameraPreset('textbook'),
        '1': () => store.setCameraPreset('a'),
        '2': () => store.setCameraPreset('b'),
        '3': () => store.setCameraPreset('c'),
        l: () => store.setShowLabels(!useAppStore.getState().showLabels),
        c: () => store.setTruncate(!useAppStore.getState().truncate),
        f: () => document.documentElement.requestFullscreen?.().catch(() => undefined),
        ArrowLeft: () => isTeaching && store.setLessonStep(Math.max(0, useAppStore.getState().lessonStep - 1)),
        ArrowRight: () => isTeaching && store.setLessonStep(Math.min(bccLesson.length - 1, useAppStore.getState().lessonStep + 1)),
      };
      const action = actions[event.key] ?? actions[event.key.toLowerCase()];
      if (action) { event.preventDefault(); action(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTeaching]);

  useEffect(() => {
    const params = new URLSearchParams({ model: structure.id, mode: store.mode, step: String(store.lessonStep + 1), view: store.cameraPreset });
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
  }, [structure.id, store.mode, store.lessonStep, store.cameraPreset]);

  if (!supportsWebGL2()) {
    return <main className="webgl-error"><AlertTriangle /><h1>当前浏览器不支持 WebGL 2</h1><p>化学空间3D 需要较新的浏览器图形能力。请使用 Chrome 或 Edge 100 及以上版本，并确认硬件加速已开启。</p><button onClick={() => window.location.reload()}><MonitorUp />重新检测</button></main>;
  }

  return (
    <TipProvider>
      <div className="app-shell">
        {store.mode !== 'classroom' && <TopBar modelName={structure.name} formula={structure.formula} verified={structure.metadata.status === 'verified'} />}
        <div className="workspace">
          {store.mode !== 'classroom' && store.leftOpen && (store.mode === 'teach' ? <LessonDirectory /> : <ModelLibrary />)}
          <CrystalViewport structure={structure} />
          {store.mode !== 'classroom' && store.rightOpen && <Inspector structure={structure} />}
        </div>
        {store.mode === 'classroom' && <ClassroomOverlay />}
        <HelpOverlay />
      </div>
    </TipProvider>
  );
}
