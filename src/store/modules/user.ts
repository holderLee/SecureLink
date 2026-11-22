/**
 * 用户会话（当前仅持有 accessToken，供请求头 / 验签 token 字段使用）
 */
import { defineStore } from "pinia";
import { resetRouter } from "@/router";
import { store } from "@/store";
import { useStorage } from "@vueuse/core";

export const useUserStore = defineStore("user", () => {
  const token = useStorage("accessToken", "");

  function setToken(value: string) {
    token.value = value || "";
  }

  function resetToken() {
    return new Promise<void>((resolve) => {
      token.value = "";
      resetRouter();
      resolve();
    });
  }

  function logout() {
    return resetToken().then(() => {
      location.reload();
    });
  }

  return {
    token,
    user: { roles: [] as string[], perms: [] as string[] },
    setToken,
    resetToken,
    logout,
  };
});

export function useUserStoreHook() {
  return useUserStore(store);
}
