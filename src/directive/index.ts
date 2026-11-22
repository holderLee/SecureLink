import type { App } from "vue";

import { hasPerm } from "./Permission";
import { copy } from "./Copy";
import { lazy } from "./Lazy";

/** 全局注册 directive */
export function setupDirective(app: App<Element>) {
  app.directive("hasPerm", hasPerm);
  app.directive("copy", copy);
  app.directive("lazy", lazy);
}
