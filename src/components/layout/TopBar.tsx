import { Box, CircleHelp, Contrast, Expand, Menu, Minimize, Moon, PanelLeftClose, PanelRightClose, Presentation, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { AppMode } from '../../types/crystal';

const modes: { value: AppMode; label: string }[] = [
  { value: 'explore', label: '探索' },
  { value: 'teach', label: '教学' },
  { value: 'classroom', label: '课堂演示' },
];

export function TopBar({ modelName, formula, verified }: { modelName: string; formula: string; verified: boolean }) {
  const store = useAppStore();
  const [fullscreen, setFullscreen] = useState<boolean>(typeof document !== 'undefined' && Boolean(document.fullscreenElement));

  useEffect(() => {
    const handler = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
    else document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <header className="topbar">
      <div className="brand">
        <button className="icon-button mobile-only" aria-label="打开模型库" onClick={() => store.setLeftOpen(!store.leftOpen)}><Menu /></button>
        <span className="brand-mark"><Box aria-hidden="true" /></span>
        <span className="brand-name">化学空间3D</span>
      </div>
      <button className="current-model" onClick={() => store.setLeftOpen(true)} aria-label="打开模型库切换模型">
        <strong>{modelName}</strong><span className="formula">{formula}</span>
        <span className={verified ? 'badge success' : 'badge warning'}>{verified ? '已验证' : '实验模型'}</span>
      </button>
      <nav className="mode-switch" aria-label="使用模式">
        {modes.map((item) => (
          <button key={item.value} aria-pressed={store.mode === item.value} onClick={() => store.setMode(item.value)}>{item.label}</button>
        ))}
      </nav>
      <div className="top-actions">
        <button className="icon-button desktop-only" aria-label={store.leftOpen ? '收起左栏' : '展开左栏'} onClick={() => store.setLeftOpen(!store.leftOpen)}><PanelLeftClose /></button>
        <button className="icon-button desktop-only" aria-label={store.rightOpen ? '收起右栏' : '展开右栏'} onClick={() => store.setRightOpen(!store.rightOpen)}><PanelRightClose /></button>
        <button className="icon-button" aria-label="切换高对比度" aria-pressed={store.highContrast} onClick={store.toggleContrast}><Contrast /></button>
        <button className="icon-button" aria-label="切换主题" onClick={store.toggleTheme}>{store.theme === 'light' ? <Moon /> : <Sun />}</button>
        <button className="icon-button desktop-only" aria-label="快捷键帮助" title="快捷键帮助 (?)" onClick={() => store.setHelpOpen(true)}><CircleHelp /></button>
        <button className="icon-button phone-only" aria-label={`切换使用模式，当前为${modes.find((item) => item.value === store.mode)?.label}`} onClick={() => { const index = modes.findIndex((item) => item.value === store.mode); store.setMode(modes[(index + 1) % modes.length].value); }}><Presentation /></button>
        <button className="icon-button" aria-label={fullscreen ? '退出全屏' : '进入全屏'} aria-pressed={fullscreen} onClick={toggleFullscreen}>{fullscreen ? <Minimize /> : <Expand />}</button>
      </div>
    </header>
  );
}
