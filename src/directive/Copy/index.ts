/**
 * 复制指令
 *
 * @example <img v-copy="123">
 */
import { Directive } from "vue";
import { useClipboard } from "@vueuse/core";
import { ElMessage } from "element-plus";

type DirectiveEl = HTMLElement & { targetContent: string; fn: () => void };

export const copy: Directive<DirectiveEl, string> = {
  /**
   * 挂载前钩子
   *
   * @param el 元素
   * @param binding 绑定值
   */
  beforeMount(el, binding) {
    el.targetContent = binding.value;
    /**
     * 复制函数
     */
    el.fn = () => {
      const { copy } = useClipboard({ source: el.targetContent });
      copy(el.targetContent);
      ElMessage.success("复制成功");
    };
    el.addEventListener("click", el.fn);
  },

  /**
   * 更新数据钩子
   *
   * @param el 元素
   * @param binding 绑定值
   */
  updated(el, binding) {
    // 实时更新最新的目标内容
    el.targetContent = binding.value;
  },

  /**
   * 卸载钩子
   *
   * @param el 元素
   */
  unmounted(el) {
    el.removeEventListener("click", el.fn);
  },
};
