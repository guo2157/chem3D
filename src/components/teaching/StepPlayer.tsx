import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { bccLesson } from '../../data/lessons';
import { useAppStore } from '../../store/useAppStore';
import { useEffect } from 'react';

export function StepPlayer({ classroom = false }: { classroom?: boolean }) {
  const step = useAppStore((state) => state.lessonStep);
  const setStep = useAppStore((state) => state.setLessonStep);
  const playing = useAppStore((state) => state.lessonPlaying);
  const setPlaying = useAppStore((state) => state.setLessonPlaying);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!playing || reducedMotion) return;
    const timer = window.setInterval(() => {
      const current = useAppStore.getState().lessonStep;
      if (current >= bccLesson.length - 1) { setPlaying(false); return; }
      setStep(current + 1);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [playing, setStep, setPlaying, reducedMotion]);

  return (
    <div className={classroom ? 'classroom-player' : 'step-player'} aria-label="教学步骤播放器">
      <button disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}><ChevronLeft /> <span>上一步</span></button>
      <button className="play-button" aria-label={playing ? '暂停' : '播放'} onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}</button>
      <button disabled={step === bccLesson.length - 1} onClick={() => setStep(Math.min(bccLesson.length - 1, step + 1))}><span>下一步</span> <ChevronRight /></button>
      <span className="step-count">{step + 1}/{bccLesson.length}</span>
      {!classroom && <div className="step-dots" aria-label="跳转步骤">{bccLesson.map((item, index) => <button key={item.id} aria-label={`第 ${index + 1} 步 ${item.title}`} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)} />)}</div>}
    </div>
  );
}
