import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { useStorage } from "@vueuse/core";
import defaultSettings from "@/settings";
/** 导入 Element Plus 中英文语言包 */
import zhCn from "element-plus/es/locale/lang/zh-cn";
import en from "element-plus/es/locale/lang/en";

export const useAppStore = defineStore("app", () => {
  /** state */
  const device = useStorage("device", "desktop");
  const size = ref<typeof defaultSettings.size>(defaultSettings.size);
  const language = useStorage("language", defaultSettings.language);
  const sidebarStatus = useStorage("sidebarStatus", "closed");
  const sidebar = ref({
    opened: sidebarStatus.value !== "closed",
    withoutAnimation: false,
  });
  const activeTopMenu = useStorage("activeTop", "");
  /** 根据语言标识读取对应的语言包 */
  const locale = computed(() => {
    if (language?.value == "en") {
      return en;
    } else {
      return zhCn;
    }
  });

  /** actions */
  function toggleSidebar() {
    sidebar.value.opened = !sidebar.value.opened;
    sidebar.value.withoutAnimation = false;
    if (sidebar.value.opened) {
      sidebarStatus.value = "opened";
    } else {
      sidebarStatus.value = "closed";
    }
  }

  function closeSideBar(withoutAnimation: boolean) {
    sidebar.value.opened = false;
    sidebar.value.withoutAnimation = withoutAnimation;
    sidebarStatus.value = "closed";
  }

  function openSideBar(withoutAnimation: boolean) {
    sidebar.value.opened = true;
    sidebar.value.withoutAnimation = withoutAnimation;
    sidebarStatus.value = "opened";
  }

  function toggleDevice(val: string) {
    device.value = val;
  }

  /**
   * 切换语言
   * @param val
   */
  function changeLanguage(val: string) {
    language.value = val;
  }

  /** 混合模式顶部切换 */
  function changeTopActive(val: string) {
    activeTopMenu.value = val;
  }
  return {
    device,
    sidebar,
    language,
    locale,
    size,
    activeTopMenu,
    toggleDevice,
    changeLanguage,
    toggleSidebar,
    closeSideBar,
    openSideBar,
    changeTopActive,
  };
});
