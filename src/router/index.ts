import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";

export const Layout = () => import("@/layout/index.vue");

/** 静态路由 */
export const constantRoutes: RouteRecordRaw[] = [
  {
    path: "/redirect",
    component: Layout,
    meta: { hidden: true },
    children: [
      {
        path: "/redirect/:path(.*)",
        component: () => import("@/views/redirect/index.vue"),
      },
    ],
  },
  {
    path: "/",
    name: "/",
    component: Layout,
    redirect: "/secure/secure-link",
    children: [
      {
        path: "401",
        component: () => import("@/views/error-page/401.vue"),
        meta: { hidden: true },
      },
      {
        path: "404",
        component: () => import("@/views/error-page/404.vue"),
        meta: { hidden: true },
      },
    ],
  },
  {
    path: "/secure",
    component: Layout,
    name: "SecureLink",
    redirect: "/secure/secure-link",
    children: [
      {
        path: "secure-link",
        component: () => import("@/views/secure-link/index.vue"),
        name: "SecureLinkConsole",
        meta: {
          title: "SecureLink",
          icon: "security",
          keepAlive: false,
          alwaysShow: false,
          affix: true,
        },
      },
    ],
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
