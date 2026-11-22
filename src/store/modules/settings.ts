import { Ref, ref } from "vue";
import { defineStore } from "pinia";
import defaultSettings from "@/settings";

export const useSettingsStore = defineStore("setting", () => {
  const title = defaultSettings.title;
  const version = defaultSettings.version;
  const tagsView = ref<boolean>(defaultSettings.tagsView);
  const sidebarLogo = ref<boolean>(defaultSettings.sidebarLogo);
  const fixedHeader = ref<boolean>(defaultSettings.fixedHeader);
  const layout = ref<typeof defaultSettings.layout>(defaultSettings.layout);
  const themeColor = ref<string>(defaultSettings.themeColor);
  const theme = ref<typeof defaultSettings.theme>(defaultSettings.theme);

  /** 可配置的属性 */
  const settingsMap: Record<string, Ref<any>> = {
    fixedHeader,
    tagsView,
    sidebarLogo,
    layout,
    themeColor,
    theme,
  };

  /** 变更配置 */
  function changeSetting({ key, value }: { key: string; value: any }) {
    const setting = settingsMap[key];
    if (setting !== undefined) {
      setting.value = value;
      if (key === "theme" && value === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }

  return {
    title,
    version,
    tagsView,
    fixedHeader,
    sidebarLogo,
    layout,
    themeColor,
    changeSetting,
    theme,
  };
});
