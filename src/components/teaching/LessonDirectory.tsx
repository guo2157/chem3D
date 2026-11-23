import { Check, Circle, PlayCircle, X } from 'lucide-react';
import { bccLesson } from '../../data/lessons';
import { useAppStore } from '../../store/useAppStore';

export function LessonDirectory() {
  const step = useAppStore((state) => state.lessonStep);
  const setStep = useAppStore((state) => state.setLessonStep);
  const setLeftOpen = useAppStore((state) => state.setLeftOpen);
  return (
    <aside className="side-panel lesson-panel" aria-label="教学步骤目录">
      <div className="panel-heading">
        <div><span className="eyebrow">BCC 教学方案</span><h2>体心立方的结构</h2></div>
        <button className="icon-button mobile-only" aria-label="关闭步骤目录" onClick={() => setLeftOpen(false)}><X /></button>
      </div>
      <ol className="lesson-list">
        {bccLesson.map((item, index) => (
          <li key={item.id}>
            <button data-active={step === index} onClick={() => { setStep(index); if (window.innerWidth < 1024) setLeftOpen(false); }}>
              <span className="step-icon">{index < step ? <Check /> : step === index ? <PlayCircle /> : <Circle />}</span>
              <span><small>第 {index + 1} 步</small><strong>{item.title}</strong></span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
