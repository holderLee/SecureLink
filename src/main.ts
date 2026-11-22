import { createApp } from "vue";
import App from "./App.vue";
import router from "@/router";
import { setupStore } from "@/store";
import { setupDirective } from "@/directive";
/** element-plus相关 */
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
/** element-plus图标 */
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
/** 权限相关 */
import "@/permission";
/** 本地SVG图标 */
import "virtual:svg-icons-register";
/** 国际化 */
import i18n from "@/lang/index";
/** 样式 */
import "element-plus/theme-chalk/dark/css-vars.css";
import "@/styles/index.scss";
/** unocss样式 https://alfred-skyblue.github.io/unocss-docs-cn/presets/attributify */
import "uno.css";

const app = createApp(App);
/** 全局注册 自定义指令 */
setupDirective(app);
/** 全局注册 状态管理 */
setupStore(app);
/** 批量注册 element-plus图标 */
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(router).use(ElementPlus).use(i18n).mount("#app");
