# 项目架构

```text
components → store → data/math
viewport component → engine → data/math
```

- `src/data`：晶体结构与教学步骤。
- `src/math`：无 Three.js 依赖的计数、位置类型、扩展、体积和密度纯函数。
- `src/store`：Zustand 界面与场景状态，不保存 Three.js 对象。
- `src/engine`：Three.js 场景、相机、OrbitControls、InstancedMesh、拾取与资源释放。
- `src/components`：模型库、画布浮层、工具面板、教学目录和课堂演示。
- `src/design`：界面语义令牌。

`SceneManager` 由 `CrystalViewport` 创建并销毁。React 状态变化通过方法调用同步到场景；Three.js 对象不会进入 React 或 Zustand 状态。数学测试位于 `tests/crystal.test.ts`。

当前纵向切片优先证明 BCC 教学闭环。后续应继续拆分 `SceneManager` 中的原子、晶胞、几何、相机和交互职责，并补充 CSS2D 标签、测量与动画状态机。
