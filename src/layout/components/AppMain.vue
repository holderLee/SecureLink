<template>
  <section class="app-main">
    <router-view>
      <template #default="{ Component, route }">
        <transition name="fade-slide" mode="out-in">
          <keep-alive :include="tagsViewStore.cachedViews">
            <component :is="Component" :key="route.fullPath" />
          </keep-alive>
        </transition>
      </template>
    </router-view>
  </section>
</template>

<script setup lang="ts">
import { useTagsViewStore } from "@/store/modules/tagsView";

const tagsViewStore = useTagsViewStore();
</script>

<style lang="scss" scoped>
.app-main {
  position: relative;
  width: 100%;
  min-height: calc(100vh - 50px);
  overflow: hidden;
  background-color: var(--el-bg-color-page);
}

.fixed-header + .app-main {
  padding-top: 34px;
}

.hasTagsView {
  .app-main {
    min-height: calc(100vh - 84px);
  }

  .fixed-header + .app-main {
    min-height: 100vh;
    padding-top: 84px;
  }
}

.isMix {
  .app-main {
    height: calc(100vh - 50px);
    overflow-y: auto;
  }

  .hasTagsView {
    .app-main {
      height: calc(100vh - 84px);
    }

    .fixed-header + .app-main {
      min-height: calc(100vh - 50px);
      padding-top: 34px;
    }
  }
}

.isTop {
  .hasTagsView {
    .fixed-header + .app-main {
      padding-top: 34px;
    }
  }
}
</style>
