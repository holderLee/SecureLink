<template>
  <el-config-provider :locale="appStore.locale" :size="appStore.size">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useAppStore } from "@/store/modules/app";
import { useSettingsStore } from "@/store/modules/settings";

const appStore = useAppStore();
const settingsStore = useSettingsStore();

onMounted(() => {
  document.documentElement.style.setProperty(
    "--el-color-primary",
    settingsStore.themeColor
  );
});
</script>
