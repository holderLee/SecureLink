<script setup lang="ts">
/**
 * SecureLink 演示页
 *
 * 1) 阶段1+2：frontendId + 密钥协商
 * 2) 阶段3：前后端加密通信（POST /client/demo/echo）
 * 3) 阶段4：本地组装签名参数（验签联调后续再做）
 */
defineOptions({
  name: "SecureLinkDemo",
  inheritAttrs: false,
});

import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  SECURE_LINK_MOCK,
  useFrontendCrypto,
  keyManager,
  encryptDataWithDEK,
  generateSignature,
  jsonToBase64,
  demoEcho,
} from "@/secure-link";

const { fetchFrontendId, fetchSecurityParam, getLocalStorageWithExpiry } =
  useFrontendCrypto();

const loading = ref(false);
const encryptLoading = ref(false);
const frontendId = ref("");
const dekPreview = ref("");
const signKeyPreview = ref("");
const encryptPayload = ref("");
const signPreview = ref("");
const decryptPreview = ref("");

const mockModeText = computed(() =>
  SECURE_LINK_MOCK ? "本地 Mock（不请求真实后端）" : "真实接口模式"
);

const mask = (value: string, keep = 8) => {
  if (!value) return "-";
  if (value.length <= keep * 2) return value;
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
};

const refreshState = () => {
  frontendId.value = getLocalStorageWithExpiry("frontendId") || "";
  dekPreview.value = mask(keyManager.getDek() || "");
  signKeyPreview.value = mask(keyManager.getSignKey() || "");
};

/** 按钮1：身份 + 密钥协商 */
const handleInit = async () => {
  loading.value = true;
  try {
    const id = (await fetchFrontendId(true)) as string;
    await fetchSecurityParam(id);
    refreshState();
    ElMessage.success("阶段1+2 完成：已获取 frontendId / DEK / signKey");
  } catch (error: any) {
    ElMessage.error(error?.message || "初始化失败");
  } finally {
    loading.value = false;
  }
};

/**
 * 按钮2：真实加解密通信
 * - 先本地加密一份展示 EncryptDataDto（便于对照）
 * - 再走 demoEcho：拦截器加密请求、解密响应
 */
const handleEncryptDemo = async () => {
  const dek = keyManager.getDek();
  if (!dek) {
    ElMessage.warning("请先完成密钥协商");
    return;
  }

  encryptLoading.value = true;
  try {
    const plain = { password: "123456", demo: true, at: Date.now() };

    // 仅用于页面展示“即将发出的密文长什么样”
    const enc = await encryptDataWithDEK(plain, dek);
    encryptPayload.value = JSON.stringify(enc, null, 2);

    // 真实打后端：request 拦截器会再加密一次并自动解密响应
    const res: any = await demoEcho(plain);
    decryptPreview.value = JSON.stringify(res?.data ?? res, null, 2);
    ElMessage.success("加密通信完成：后端已解密请求并加密返回");
  } catch (error: any) {
    ElMessage.error(error?.message || "加密通信失败");
  } finally {
    encryptLoading.value = false;
  }
};

/** 按钮3：本地签名参数（验签服务端后续再接） */
const handleSignDemo = async () => {
  const signKey = keyManager.getSignKey();
  if (!signKey) {
    ElMessage.warning("请先完成密钥协商");
    return;
  }
  const body = { password: "123456" };
  const signParams: Record<string, any> = {
    lang: "zh-CN",
    token: "",
    timestamp: Date.now(),
    nonce: crypto.randomUUID().replace(/-/g, ""),
    param: jsonToBase64(JSON.stringify(body)),
  };
  const sign = await generateSignature(signParams, signKey);
  signPreview.value = JSON.stringify({ ...signParams, sign }, null, 2);
  ElMessage.success("本地验签参数生成完成（服务端验签尚未接入）");
};

refreshState();
</script>

<template>
  <div class="secure-link-demo">
    <el-card shadow="never">
      <template #header>
        <div class="header">
          <span>SecureLink 敏感数据安全传输演示</span>
          <el-tag size="small" type="warning">{{ mockModeText }}</el-tag>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        title="当前联调：①身份密钥 ②加解密通信(/client/demo/echo)。验签后续再补。请同时启动 server:8989。"
        class="mb-16"
      />

      <el-space wrap>
        <el-button type="primary" :loading="loading" @click="handleInit">
          1. 初始化 frontendId + 密钥协商
        </el-button>
        <el-button
          :disabled="!dekPreview || dekPreview === '-'"
          :loading="encryptLoading"
          @click="handleEncryptDemo"
        >
          2. 前后端加密通信
        </el-button>
        <el-button :disabled="!signKeyPreview || signKeyPreview === '-'" @click="handleSignDemo">
          3. 演示签名参数（仅前端）
        </el-button>
      </el-space>

      <el-descriptions class="mt-16" :column="1" border>
        <el-descriptions-item label="frontendId">
          {{ frontendId || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="DEK（内存，已脱敏）">
          {{ dekPreview }}
        </el-descriptions-item>
        <el-descriptions-item label="signKey（内存，已脱敏）">
          {{ signKeyPreview }}
        </el-descriptions-item>
      </el-descriptions>

      <el-row :gutter="16" class="mt-16">
        <el-col :span="12">
          <h4>加密请求体 EncryptDataDto（本地预览）</h4>
          <pre>{{ encryptPayload || "暂无" }}</pre>
        </el-col>
        <el-col :span="12">
          <h4>后端解密后再加密返回（前端已解密）</h4>
          <pre>{{ decryptPreview || "暂无" }}</pre>
        </el-col>
      </el-row>

      <h4 class="mt-16">签名头参数预览</h4>
      <pre>{{ signPreview || "暂无" }}</pre>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.secure-link-demo {
  padding: 16px;

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .mb-16 {
    margin-bottom: 16px;
  }

  .mt-16 {
    margin-top: 16px;
  }

  pre {
    margin: 0;
    padding: 12px;
    overflow: auto;
    font-size: 12px;
    line-height: 1.5;
    word-break: break-all;
    white-space: pre-wrap;
    background: var(--el-fill-color-light);
    border-radius: 6px;
    min-height: 120px;
  }
}
</style>
