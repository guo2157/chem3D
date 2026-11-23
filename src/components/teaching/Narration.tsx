import type { ReactNode } from 'react';
import { useAppStore } from '../../store/useAppStore';

export interface TermToken {
  kind: 'text' | 'term';
  text: string;
  /** site:ID / action:xxx */
  payload?: string;
}

const PATTERN = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

export function parseNarration(input: string): TermToken[] {
  const tokens: TermToken[] = [];
  let lastIndex = 0;
  for (const match of input.matchAll(PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) tokens.push({ kind: 'text', text: input.slice(lastIndex, start) });
    tokens.push({ kind: 'term', text: match[1], payload: match[2] });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < input.length) tokens.push({ kind: 'text', text: input.slice(lastIndex) });
  return tokens;
}

function triggerTerm(payload: string): void {
  const state = useAppStore.getState();
  const [kind, value] = payload.split(':');
  if (kind === 'site') {
    state.setHighlightSite(state.highlightSite === value ? null : value);
    return;
  }
  if (kind === 'action') {
    switch (value) {
      case 'body-diagonal': state.setShowBodyDiagonal(!state.showBodyDiagonal); return;
      case 'face-diagonal': state.setShowFaceDiagonal(!state.showFaceDiagonal); return;
      case 'truncate': state.setTruncate(!state.truncate); return;
      case 'coord': state.setShowCoordination(!state.showCoordination); return;
      case 'position': state.setColoring(state.coloring === 'position' ? 'element' : 'position'); return;
    }
  }
}

function termIsActive(payload: string): boolean {
  const state = useAppStore.getState();
  const [kind, value] = payload.split(':');
  if (kind === 'site') return state.highlightSite === value;
  if (kind === 'action') {
    switch (value) {
      case 'body-diagonal': return state.showBodyDiagonal;
      case 'face-diagonal': return state.showFaceDiagonal;
      case 'truncate': return state.truncate;
      case 'coord': return state.showCoordination;
      case 'position': return state.coloring === 'position';
    }
  }
  return false;
}

/** 渲染带术语胶囊的讲解文本。 */
export function Narration({ text }: { text: string }): ReactNode {
  // 订阅相关状态，保证术语高亮态随之刷新
  const highlightSite = useAppStore((state) => state.highlightSite);
  const showBody = useAppStore((state) => state.showBodyDiagonal);
  const showFace = useAppStore((state) => state.showFaceDiagonal);
  const truncate = useAppStore((state) => state.truncate);
  const coord = useAppStore((state) => state.showCoordination);
  const coloring = useAppStore((state) => state.coloring);
  // 以上订阅本身就是触发重渲染的信号；下方逻辑直接读 getState 判断
  void highlightSite; void showBody; void showFace; void truncate; void coord; void coloring;

  const tokens = parseNarration(text);
  return (
    <>
      {tokens.map((token, index) => {
        if (token.kind === 'text') return <span key={index}>{token.text}</span>;
        const active = termIsActive(token.payload!);
        return (
          <button
            key={index}
            type="button"
            className="term-chip"
            data-active={active ? 'true' : undefined}
            onClick={() => triggerTerm(token.payload!)}
            aria-pressed={active}
          >
            {token.text}
          </button>
        );
      })}
    </>
  );
}
