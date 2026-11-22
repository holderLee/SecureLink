import { createI18n } from "vue-i18n";
import defaultSettings from "@/settings";
import enLocale from "./package/en";
import zhCnLocale from "./package/zh-cn";

/** 不能在 Pinia 安装前调用 useAppStore；从本地缓存读取语言 */
const getInitialLocale = () => {
  try {
    const cached = localStorage.getItem("language");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (typeof parsed === "string") return parsed;
      if (parsed && typeof parsed === "object" && parsed.value) {
        return parsed.value;
      }
    }
  } catch (error) {
    // ignore
  }
  return defaultSettings.language || "zh-cn";
};

const messages = {
  "zh-cn": {
    ...zhCnLocale,
  },
  en: {
    ...enLocale,
  },
};

const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  messages: messages,
  globalInjection: true,
});

export default i18n;
