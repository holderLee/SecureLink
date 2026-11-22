import router from "@/router";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

NProgress.configure({ showSpinner: false });

/** 白名单路由 */
const whiteList = ["/login"];

router.beforeEach(async (to, from, next) => {
  NProgress.start();

  if (whiteList.includes(to.path)) {
    next();
    return;
  }

  next();
});

router.afterEach(() => {
  NProgress.done();
});
