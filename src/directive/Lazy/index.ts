/**
 * 图片懒加载指令
 *
 * @example <img v-lazy="图片链接">
 */
import { Directive } from "vue";

type DirectiveEl = HTMLImageElement & { $io: IntersectionObserver };

export const lazy: Directive<DirectiveEl, string> = {
  /**
   * 挂载后钩子
   *
   * @param el 元素
   * @param binding 绑定值
   */
  mounted(el, binding) {
    const io = new IntersectionObserver((entries) => {
      const realSrc = binding.value || el.src;
      // 通过isIntersecting判断是否在可视区域内
      entries[0].isIntersecting && realSrc && (el.src = realSrc);
    });
    // 挂载实例, 提供给后续的unmounted钩子操作
    el.$io = io;
    // 监听目标对象
    io.observe(el);
  },
  /**
   * 更新数据钩子
   *
   * @param el 元素
   * @param binding 绑定值
   */
  updated(el, binding) {
    // 实时更新最新的图片路径
    el.src = binding.value || el.src;
  },
  /**
   * 卸载钩子
   *
   * @param el 元素
   */
  unmounted(el) {
    // 停止监听工作
    el.$io.disconnect();
  },
};
