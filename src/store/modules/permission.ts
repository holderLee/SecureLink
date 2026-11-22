/**
 * 侧边栏菜单数据：使用静态路由 constantRoutes
 */
import { ref } from "vue";
import { RouteRecordRaw } from "vue-router";
import { defineStore } from "pinia";
import { constantRoutes } from "@/router";
import { store } from "@/store";

export const usePermissionStore = defineStore("permission", () => {
  const routes = ref<RouteRecordRaw[]>([...constantRoutes]);

  function setRoutes(newRoutes: RouteRecordRaw[]) {
    routes.value = constantRoutes.concat(newRoutes);
  }

  const mixLeftMenu = ref<RouteRecordRaw[]>([]);
  function getMixLeftMenu(activeTop: string) {
    routes.value.forEach((item) => {
      if (item.path === activeTop) {
        mixLeftMenu.value = item.children || [];
      }
    });
  }

  return { routes, setRoutes, getMixLeftMenu, mixLeftMenu };
});

export function usePermissionStoreHook() {
  return usePermissionStore(store);
}
