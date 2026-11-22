import { createI18n } from "vue-i18n";
import { useAppStore } from "@/store/modules/app";
import enLocale from "./package/en";
import zhCnLocale from "./package/zh-cn";
const appStore = useAppStore();

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
  locale: appStore.language,
  messages: messages,
  globalInjection: true,
});

export default i18n;
