# Trionn 架构实现进度

更新时间：2026-07-20

参考文章：[The Architecture Behind Trionn: Coordinating GSAP, Three.js, Lenis, and Web Audio](https://tympanus.net/codrops/2026/07/15/the-architecture-behind-trionn-coordinating-gsap-three-js-lenis-and-web-audio/)

## 总览

| 项目 | 状态 | 当前实现 | 与文章方案的差距 |
| --- | --- | --- | --- |
| 双图层 | 已实现（结构） | `pages/HomePage.tsx` 使用单个 Three.js 场景作为背景，并用普通 DOM 作为前景 | 两层只共同使用 `transitionReady`；`explodeAmt` 尚未驱动前景 UI，状态协同仍不完整 |
| `useTrionnSymbolScene.ts` | 已迁移（基础版） | `components/hero/index.ts` 是 Hero 组件入口，`hooks/useTrionnSymbolScene.ts` 管理标志场景、输入、动画循环和资源回收 | 交互仍是文章的简化版，后续可加入多输入 `explodeAmt` 仲裁和 raycast 磁力悬停 |
| `explodeAmt` | 部分实现 | `components/hero/runtime.ts` 定义共享值；`hooks/useTrionnSymbolScene.ts` 根据按住状态平滑更新，并控制三个面板分离 | 目前只有 hold 输入；缺少文章中的 scroll、hover、click burst、intro 等输入合并，也没有 `Math.max(...)` 统一仲裁 |
| `mix-blend-mode: difference` | 已实现 | `.hero__foreground` 使用 `mix-blend-mode: difference`，DOM 前景覆盖在 WebGL 背景上 | 核心方案一致；仍需在不同亮度、移动端和浏览器中做视觉回归检查 |
| `requestIdleCallback` | 已实现（基础版） | `hooks/useTrionnSymbolScene.ts` 延迟 WebGL 场景初始化，并提供 `setTimeout` 降级与卸载清理；`HomePage.tsx` 用双 `requestAnimationFrame` 等待首屏过渡稳定 | 真实路由过渡完成事件尚未接入 |
| `transitionReady` | 部分实现 | 同时保存在 React state 和共享 ref 中；控制标题揭示、符号旋转及爆炸交互 | 当前没有真实的 loader/route transition 完成信号，idle callback 被当作过渡完成信号，语义不完全一致 |

## 代码证据

- 双图层：`src/pages/HomePage.tsx` 中的 `.hero__background` 包含 `TrionnSymbolScene`，`.hero__foreground` 包含导航、标题和统计信息。
- 差值混合：`src/styles.css` 的 `.hero__foreground` 设置了 `mix-blend-mode: difference`。
- 共享状态：`src/components/hero/runtime.ts` 定义 `transitionReady` 和 `explodeAmt`。
- 空闲调度：`src/hooks/useTrionnSymbolScene.ts` 使用 `requestIdleCallback`，不支持时降级为 180ms 定时器；页面过渡稳定由 `HomePage.tsx` 的双 `requestAnimationFrame` 判断。
- 爆炸动画：`src/hooks/useTrionnSymbolScene.ts` 将按住状态平滑插值到 `explode`，再写入 `runtime.current.explodeAmt` 并更新三个面板的位置和旋转。

## 当前行为

1. 页面挂载后等待浏览器空闲或超时，再创建 Three.js renderer、scene、材质、灯光和动画循环。
2. 首屏完成两次 `requestAnimationFrame` 后，`transitionReady` 变为 `true`。
3. `transitionReady` 启动标题揭示与符号自动旋转，同时允许 hold-to-blast。
4. 按下指针后 `explodeAmt` 立即开始趋近 1；松开后趋近 0。
5. DOM 前景通过 difference 混合模式叠加在 WebGL canvas 上。

## 下一阶段

- [x] 建立 `components/hero` 模块，由 `index.ts` 作为外部入口。
- [ ] 将 `explodeAmt` 改为多个输入的统一结果：`Math.max(scrollProgress, hoverAmt, clickBurst, introAmt)`。
- [ ] 加入文章中的 0.5 秒 hold charge，再进入 blast；松开时继续平滑回落。
- [ ] 使用 raycaster 实现面板级 magnetic hover，并让 hover 对 `explodeAmt` 产生贡献。
- [ ] 让前景 DOM 消费共享交互状态，例如 charge 期间的轻微震动，而不只读取 `transitionReady`。
- [ ] 将 `transitionReady` 接到真实的页面加载/路由过渡完成事件；`requestIdleCallback` 只负责安排非关键初始化。
- [ ] 补充 `prefers-reduced-motion` 逻辑，并对 WebGL、difference 混合和交互执行桌面/移动端视觉回归。

## 完成度结论

当前已经搭起文章所述 Hero 架构的骨架：Three.js 背景、DOM 前景、difference 混合、共享 ref 和 idle 调度都存在。完整度大约为 **55%**。视觉分层已经成立，但状态模型与交互协调仍是简化版，距离文章中的多输入统一状态系统还有明显差距。
