import { useState } from 'react';
import { Eye, EyeOff, LogOut, Tags, Grid3X3, ScanLine, RotateCcw } from 'lucide-react';
import { bccLesson } from '../../data/lessons';
import { useAppStore } from '../../store/useAppStore';
import { StepPlayer } from '../teaching/StepPlayer';
import { Narration } from '../teaching/Narration';

export function ClassroomOverlay() {
  const store = useAppStore();
  const lesson = bccLesson[store.lessonStep];
  const [controlsHidden, setControlsHidden] = useState(false);

  return (
    <div className="classroom-overlay" data-tools-hidden={controlsHidden ? 'true' : undefined}>
      <div className="classroom-header">
        <div><strong>体心立方</strong><span>第 {store.lessonStep + 1}/{bccLesson.length} 步 · {lesson.title}</span></div>
        <button onClick={() => store.setMode('teach')}><LogOut />退出演示</button>
      </div>
      {!controlsHidden && (
        <>
          <div className="classroom-caption"><p><Narration text={lesson.narration} /></p>{lesson.calculation && <strong>{lesson.calculation}</strong>}</div>
          <div className="classroom-tools">
            <button aria-pressed={store.showLabels} onClick={() => store.setShowLabels(!store.showLabels)}><Tags />标签</button>
            <button aria-pressed={store.truncate} onClick={() => store.setTruncate(!store.truncate)}><Grid3X3 />截断</button>
            <button aria-pressed={store.showBodyDiagonal} onClick={() => store.setShowBodyDiagonal(!store.showBodyDiagonal)}><ScanLine />对角线</button>
            <button onClick={() => store.setCameraPreset('textbook')}><RotateCcw />重置</button>
            <button className="hide-control" onClick={() => setControlsHidden(true)} aria-label="隐藏控件"><EyeOff />隐藏控件</button>
          </div>
          <StepPlayer classroom />
        </>
      )}
      {controlsHidden && (
        <button
          className="classroom-show-controls"
          onClick={() => setControlsHidden(false)}
          aria-label="显示控件"
        >
          <Eye />显示控件
        </button>
      )}
    </div>
  );
}
