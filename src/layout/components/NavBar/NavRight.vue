<template>
  <div v-if="device !== 'mobile'" class="setting-container">
    <div class="setting-item" @click="toggle">
      <SvgIcon :icon-class="isFullscreen ? 'exit-fullscreen' : 'fullscreen'" />
    </div>
  </div>
  <el-dropdown trigger="click">
    <div class="avatar-container">
      <img src="https://picsum.photos/200?imageView2/1/w/80/h/80" />
      <el-icon class="w-3 h-3"><CaretBottom /></el-icon>
    </div>
    <template #dropdown>
      <el-dropdown-menu>
        <router-link to="/secure/secure-link">
          <el-dropdown-item>SecureLink</el-dropdown-item>
        </router-link>
        <el-dropdown-item divided @click="logout">
          {{ $t("navbar.logout") }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>
<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useAppStore } from "@/store/modules/app";
import { useTagsViewStore } from "@/store/modules/tagsView";
import { useUserStore } from "@/store/modules/user";
import { ElMessageBox } from "element-plus";
import { useFullscreen } from "@vueuse/core";
import SvgIcon from "@/components/SvgIcon/index.vue";

const appStore = useAppStore();
const tagsViewStore = useTagsViewStore();
const userStore = useUserStore();
const { device } = storeToRefs(appStore);
const { isFullscreen, toggle } = useFullscreen();

const logout = () => {
  ElMessageBox.confirm("确定清除本地会话并刷新吗？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  }).then(() => {
    tagsViewStore.delAllViews();
    userStore.logout();
  });
};
</script>
<style lang="scss" scoped>
.setting-container {
  display: flex;
  align-items: center;

  .setting-item {
    display: inline-block;
    width: 30px;
    height: 50px;
    line-height: 50px;
    color: var(--el-text-color-regular);
    text-align: center;
    cursor: pointer;

    &:hover {
      background: var(--el-color-info-light-9);
    }
  }
}

.avatar-container {
  display: flex;
  align-items: center;
  justify-items: center;
  margin: 0 5px;
  cursor: pointer;

  img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }
}
</style>
