import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";

/** 静态路由 —— 演示站无后台 Layout 壳 */
export const constantRoutes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: () => import("@/views/secure-link/index.vue"),
    meta: {
      title: "SecureLink",
    },
  },
  {
    path: "/secure/secure-link",
    redirect: "/",
  },
  {
    path: "/401",
    component: () => import("@/views/error-page/401.vue"),
    meta: { hidden: true },
  },
  {
    path: "/404",
    component: () => import("@/views/error-page/404.vue"),
    meta: { hidden: true },
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/404",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes: constantRoutes as RouteRecordRaw[],
  scrollBehavior: () => ({ left: 0, top: 0 }),
});

export function resetRouter() {
  router.replace({ path: "/" });
}

export default router;
