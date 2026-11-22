<template>
  <!-- 顶部导航栏 -->
  <div class="navbar">
    <!-- 左侧面包屑 -->
    <div class="flex">
      <Hamburger
        :is-active="appStore.sidebar.opened"
        @toggle-click="toggleSideBar"
      />
      <Breadcrumb />
    </div>
    <!-- 右侧导航设置 -->
    <div class="flex">
      <NavRight />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "@/store/modules/app";
import NavRight from "./NavRight.vue";
import Breadcrumb from "@/components/Breadcrumb/index.vue";
import Hamburger from "@/components/Hamburger/index.vue";

const appStore = useAppStore();

/**
 * 左侧菜单栏显示/隐藏
 */
const toggleSideBar = () => {
  appStore.toggleSidebar();
};
</script>

<style lang="scss" scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 50px;
  background-color: #fff;
  box-shadow: 0 0 1px #0003;
}
</style>
