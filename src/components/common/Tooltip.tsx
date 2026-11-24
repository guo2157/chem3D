import type { ReactNode } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';

/**
 * 悬停 / 聚焦提示。把需要解释的词语包起来即可：
 * <Tip text="说明文字">晶胞体积</Tip>
 * 气泡通过 Portal 渲染到 body，不会被侧栏的滚动容器裁切。
 * 位于 <button> 内部时传 focusable={false}，避免按钮里再嵌套可聚焦元素。
 */
export function Tip({ text, focusable = true, children }: { text: ReactNode; focusable?: boolean; children: ReactNode }) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>
        <span className="tip" tabIndex={focusable ? 0 : undefined}>{children}</span>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className="tip-bubble" side="top" sideOffset={6} collisionPadding={10}>
          {text}
          <RadixTooltip.Arrow className="tip-arrow" width={10} height={5} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

/** 全局只挂一个 Provider，供所有 Tip 共用延迟与跳过逻辑。 */
export function TipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={120} skipDelayDuration={300}>{children}</RadixTooltip.Provider>;
}
