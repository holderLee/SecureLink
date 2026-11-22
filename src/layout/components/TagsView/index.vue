<template>
  <div class="tags-container">
    <scroll-pane ref="scrollPaneRef" @scroll="handleScroll">
      <router-link
        ref="tagRef"
        v-for="tag in visitedViews"
        :key="tag.path"
        :class="'tags-item ' + (isActive(tag) ? 'active' : '')"
        :data-path="tag.path"
        :to="{ path: tag.path, query: tag.query }"
        @click.middle="!isAffix(tag) ? closeSelectedTag(tag) : ''"
        @contextmenu.prevent="openTagMenu(tag, $event)"
      >
        {{ translateRouteTitle(tag.title) }}
        <span
          v-if="!isAffix(tag)"
          class="tags-item-close"
          @click.prevent.stop="closeSelectedTag(tag)"
        >
          <el-icon><Close :size="10" style="display: inline-block" /></el-icon>
        </span>
      </router-link>
    </scroll-pane>

    <!-- tag标签操作菜单 -->
    <ul
      v-show="tagMenuVisible"
      class="tag-menu"
      :style="{ left: left + 'px', top: top + 'px' }"
    >
      <li @click="refreshSelectedTag(selectedTag)">
        <SvgIcon icon-class="refresh" />
        刷新
      </li>
      <li v-if="!isAffix(selectedTag)" @click="closeSelectedTag(selectedTag)">
        <SvgIcon icon-class="close" />
        关闭
      </li>
      <li @click="closeOtherTags">
        <SvgIcon icon-class="close_other" />
        关闭其它
      </li>
      <li v-if="!isFirstView()" @click="closeLeftTags">
        <SvgIcon icon-class="close_left" />
        关闭左侧
      </li>
      <li v-if="!isLastView()" @click="closeRightTags">
        <SvgIcon icon-class="close_right" />
        关闭右侧
      </li>
      <li @click="closeAllTags(selectedTag)">
        <SvgIcon icon-class="close_all" />
        关闭所有
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  getCurrentInstance,
} from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter, RouteRecordRaw } from "vue-router";
import { resolve } from "path-browserify";
import { translateRouteTitle } from "@/utils/i18n";
import { usePermissionStore } from "@/store/modules/permission";
import { useTagsViewStore } from "@/store/modules/tagsView";
import { useSettingsStore } from "@/store/modules/settings";
import { useAppStore } from "@/store/modules/app";
import SvgIcon from "@/components/SvgIcon/index.vue";
import ScrollPane from "./ScrollPane.vue";

const { proxy } = getCurrentInstance() as any;
const router = useRouter();
const route = useRoute();
const permissionStore = usePermissionStore();
const tagsViewStore = useTagsViewStore();
const appStore = useAppStore();
const { visitedViews } = storeToRefs(tagsViewStore);
// console.log("visitedViews", visitedViews);
const settingsStore = useSettingsStore();
const layout = computed(() => settingsStore.layout);
const selectedTag = ref<TagView>({
  path: "",
  fullPath: "",
  name: "",
  title: "",
  affix: false,
  keepAlive: false,
});

const affixTags = ref<TagView[]>([]);
const scrollPaneRef = ref();
const left = ref(0);
const top = ref(0);

const tagMenuVisible = ref(false);
watch(tagMenuVisible, (value) => {
  if (value) {
    document.body.addEventListener("click", closeTagMenu);
  } else {
    document.body.removeEventListener("click", closeTagMenu);
  }
});

const filterAffixTags = (routes: RouteRecordRaw[], basePath = "/") => {
  const processRoute = (route: RouteRecordRaw) => {
    const fullPath = resolve(basePath, route.path);

    const tag: TagView = {
      path: route.path,
      fullPath,
      name: String(route.name),
      title: route.meta?.title || "no-name",
      affix: route.meta?.affix,
      keepAlive: route.meta?.keepAlive,
    };

    if (tag.affix) {
      tags.push(tag);
    }

    if (route.children) {
      route.children.forEach(processRoute);
    }
  };

  let tags: TagView[] = [];
  routes.forEach(processRoute);
  return tags;
};

const initTags = () => {
  const tags: TagView[] = filterAffixTags(permissionStore.routes);
  // console.log("initTags", tags);
  affixTags.value = tags;
  for (const tag of tags) {
    if (tag.name) {
      tagsViewStore.addVisitedView(tag);
    }
  }
};

const addTags = () => {
  // console.log("addTags", visitedViews);
  if (route.meta.title) {
    tagsViewStore.addView({
      name: route.name as string,
      title: route.meta.title,
      path: route.path,
      fullPath: route.fullPath,
      affix: route.meta?.affix,
      keepAlive: route.meta?.keepAlive,
    });
  }
};

const moveToCurrentTag = () => {
  // console.log("moveToCurrentTag", visitedViews);
  /** 使用 nextTick() 的目的是确保在更新 tagsView 组件之前，scrollPaneRef 对象已经滚动到了正确的位置。 */
  nextTick(() => {
    for (const tag of visitedViews.value) {
      if (tag.path === route.path) {
        scrollPaneRef.value.moveToTarget(tag);
        if (tag.fullPath !== route.fullPath) {
          tagsViewStore.updateVisitedView({
            name: route.name as string,
            title: route.meta.title || "",
            path: route.path,
            fullPath: route.fullPath,
            affix: route.meta?.affix,
            keepAlive: route.meta?.keepAlive,
          });
        }
      }
    }
  });
};

const isActive = (tag: TagView) => {
  return tag.fullPath === route.fullPath;
};

const isAffix = (tag: TagView) => {
  return tag?.affix;
};

const isFirstView = () => {
  try {
    return (
      selectedTag.value.fullPath === "/dashboard" ||
      selectedTag.value.fullPath === tagsViewStore.visitedViews[1].fullPath
    );
  } catch (err) {
    return false;
  }
};

const isLastView = () => {
  try {
    return (
      selectedTag.value.fullPath ===
      tagsViewStore.visitedViews[tagsViewStore.visitedViews.length - 1].fullPath
    );
  } catch (err) {
    return false;
  }
};

const refreshSelectedTag = (view: TagView) => {
  tagsViewStore.delCachedView(view);
  const { fullPath } = view;
  nextTick(() => {
    router.replace({ path: "/redirect" + fullPath });
  });
};

const toLastView = (visitedViews: TagView[], view?: TagView) => {
  const latestView = visitedViews.slice(-1)[0];
  if (latestView && latestView.fullPath) {
    router.push(latestView.fullPath);
  } else {
    if (view?.name === "Dashboard") {
      router.replace({ path: "/redirect" + view.fullPath });
    } else {
      router.push("/");
    }
  }
};

const closeSelectedTag = (view: TagView) => {
  tagsViewStore.delView(view).then((res: any) => {
    if (isActive(view)) {
      toLastView(res.visitedViews, view);
    }
  });
};

const closeLeftTags = () => {
  tagsViewStore.delLeftViews(selectedTag.value).then((res: any) => {
    if (
      !res.visitedViews.find((item: any) => item.fullPath === route.fullPath)
    ) {
      toLastView(res.visitedViews);
    }
  });
};
const closeRightTags = () => {
  tagsViewStore.delRightViews(selectedTag.value).then((res: any) => {
    if (
      !res.visitedViews.find((item: any) => item.fullPath === route.fullPath)
    ) {
      toLastView(res.visitedViews);
    }
  });
};

const closeOtherTags = () => {
  router.push(selectedTag.value);
  tagsViewStore.delOtherViews(selectedTag.value).then(() => {
    moveToCurrentTag();
  });
};

const closeAllTags = (view: TagView) => {
  tagsViewStore.delAllViews().then((res: any) => {
    toLastView(res.visitedViews, view);
  });
};

const openTagMenu = (tag: TagView, e: MouseEvent) => {
  const menuMinWidth = 105;

  const offsetLeft = proxy?.$el.getBoundingClientRect().left;
  const offsetWidth = proxy?.$el.offsetWidth;
  const maxLeft = offsetWidth - menuMinWidth;
  const l = e.clientX - offsetLeft + 15;

  if (l > maxLeft) {
    left.value = maxLeft;
  } else {
    left.value = l;
  }

  /** 混合模式下，需要减去顶部菜单(fixed)的高度 */
  if (layout.value === "mix") {
    top.value = e.clientY - 50;
  } else {
    top.value = e.clientY;
  }

  tagMenuVisible.value = true;
  selectedTag.value = tag;
};

const closeTagMenu = () => {
  tagMenuVisible.value = false;
};

const handleScroll = () => {
  closeTagMenu();
};
const findOutermostParent = (tree: any[], findName: string) => {
  let parentMap: any = {};

  const buildParentMap = (node: any, parent: any) => {
    parentMap[node.name] = parent;

    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        buildParentMap(node.children[i], node);
      }
    }
  };

  for (let i = 0; i < tree.length; i++) {
    buildParentMap(tree[i], null);
  }

  let currentNode = parentMap[findName];
  while (currentNode) {
    if (!parentMap[currentNode.name]) {
      return currentNode;
    }
    currentNode = parentMap[currentNode.name];
  }

  return null;
};
const againActiveTop = (newVal: string) => {
  if (layout.value !== "mix") return;
  const parent = findOutermostParent(permissionStore.routes, newVal);
  if (appStore.activeTopMenu !== parent.path) {
    appStore.changeTopActive(parent.path);
  }
};
/** 如果是混合模式，更改selectedTag，需要对应高亮的activeTop */
watch(
  () => route.name,
  (newVal) => {
    if (newVal) {
      againActiveTop(newVal as string);
    }
  },
  {
    deep: true,
  }
);
watch(
  route,
  () => {
    addTags();
    moveToCurrentTag();
  },
  {
    immediate: true,
  }
);
onMounted(() => {
  initTags();
});
</script>

<style lang="scss" scoped>
.tags-container {
  width: 100%;
  height: 34px;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  box-shadow: 0 1px 1px var(--el-box-shadow-light);

  .tags-item {
    display: inline-block;
    padding: 3px 8px;
    margin: 4px 0 0 5px;
    font-size: 12px;
    cursor: pointer;
    border: 1px solid var(--el-border-color-light);

    &:first-of-type {
      margin-left: 15px;
    }

    &:last-of-type {
      margin-right: 15px;
    }

    &:hover {
      color: var(--el-color-primary);
    }

    &.active {
      color: #fff;
      background-color: var(--el-color-primary);
      border-color: var(--el-color-primary);

      &::before {
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 5px;
        content: "";
        background: #fff;
        border-radius: 50%;
      }
    }

    &-close {
      border-radius: 100%;

      &:hover {
        color: #fff;
        background: rgb(0 0 0 / 16%);
      }
    }
  }
}

.tag-menu {
  position: absolute;
  z-index: 99;
  font-size: 12px;
  background: var(--el-bg-color-overlay);
  border-radius: 4px;
  box-shadow: var(--el-box-shadow-light);

  li {
    padding: 8px 16px;
    cursor: pointer;

    &:hover {
      background: var(--el-fill-color-light);
    }
  }
}
</style>
