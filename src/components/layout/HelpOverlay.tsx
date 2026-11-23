import { X, Keyboard } from 'lucide-react';
import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

interface Shortcut { keys: string[]; description: string; scope?: string }

const shortcuts: Shortcut[] = [
  { keys: ['R', '0'], description: '恢复教材视角' },
  { keys: ['1', '2', '3'], description: '沿 a / b / c 轴观察' },
  { keys: ['L'], description: '切换原子标签' },
  { keys: ['C'], description: '切换截断显示' },
  { keys: ['F'], description: '进入 / 退出全屏' },
  { keys: ['Space'], description: '播放 / 暂停', scope: '教学、课堂演示' },
  { keys: ['←', '→'], description: '上一步 / 下一步', scope: '教学、课堂演示' },
  { keys: ['Esc'], description: '关闭帮助 → 取消测量 / 配位 / 高亮 / 选中（逐层）' },
  { keys: ['?'], description: '显示此快捷键面板' },
];

export function HelpOverlay() {
  const open = useAppStore((state) => state.helpOpen);
  const close = () => useAppStore.getState().setHelpOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as EventListenerOptions);
  }, [open]);

  if (!open) return null;

  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div className="help-backdrop" onClick={close} aria-hidden="true" />
      <div className="help-panel">
        <header>
          <span className="help-icon"><Keyboard /></span>
          <h2 id="help-title">键盘快捷键</h2>
          <button className="icon-button" aria-label="关闭帮助" onClick={close}><X /></button>
        </header>
        <dl className="help-list">
          {shortcuts.map((item) => (
            <div key={item.keys.join('+')}>
              <dt>
                {item.keys.map((key) => <kbd key={key}>{key}</kbd>)}
              </dt>
              <dd>
                <span>{item.description}</span>
                {item.scope && <small>{item.scope}</small>}
              </dd>
            </div>
          ))}
        </dl>
        <p className="help-note">在输入框、下拉框或按钮上聚焦时，相应按键按原意生效，不会被拦截。</p>
      </div>
    </div>
  );
}
