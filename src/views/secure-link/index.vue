<script setup lang="ts">
/**
 * SecureLink 控制台：身份初始化、密钥协商、加密传输与验签探测
 */
defineOptions({
  name: "SecureLinkConsole",
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
  secureEcho,
} from "@/secure-link";

const { fetchFrontendId, fetchSecurityParam, getLocalStorageWithExpiry } =
  useFrontendCrypto();

const loading = ref(false);
const transportLoading = ref(false);
const frontendId = ref("");
const dekPreview = ref("");
const signKeyPreview = ref("");
const encryptPayload = ref("");
const signPreview = ref("");
const decryptPreview = ref("");

const modeText = computed(() =>
  SECURE_LINK_MOCK ? "本地 Mock" : "真实接口"
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

const handleInit = async () => {
  loading.value = true;
  try {
    const id = (await fetchFrontendId(true)) as string;
    await fetchSecurityParam(id);
    refreshState();
    ElMessage.success("已完成 frontendId 与密钥协商");
  } catch (error: any) {
    ElMessage.error(error?.message || "初始化失败");
  } finally {
    loading.value = false;
  }
};

/** 加密 + 验签往返探测 */
const handleSecureTransport = async () => {
  const dek = keyManager.getDek();
  const signKey = keyManager.getSignKey();
  if (!dek || !signKey) {
    ElMessage.warning("请先完成密钥协商");
    return;
  }

  transportLoading.value = true;
  try {
    const plain = { password: "123456", probe: true, at: Date.now() };
    const enc = await encryptDataWithDEK(plain, dek);
    encryptPayload.value = JSON.stringify(enc, null, 2);

    const res: any = await secureEcho(plain);
    decryptPreview.value = JSON.stringify(res?.data ?? res, null, 2);
    ElMessage.success("加密传输与验签成功");
  } catch (error: any) {
    ElMessage.error(error?.message || "传输失败");
  } finally {
    transportLoading.value = false;
  }
};

/** 本地预览签名字段（不发起请求） */
const handleSignPreview = async () => {
  const signKey = keyManager.getSignKey();
  if (!signKey) {
    ElMessage.warning("请先完成密钥协商");
    return;
  }
  const body = { password: "123456" };
  const signParams: Record<string, any> = {
    lang: "zh-cn",
    token: "",
    timestamp: Date.now(),
    nonce: crypto.randomUUID().replace(/-/g, ""),
    param: jsonToBase64(JSON.stringify(body)),
  };
  const sign = await generateSignature(signParams, signKey);
  signPreview.value = JSON.stringify({ ...signParams, sign }, null, 2);
  ElMessage.success("签名参数已生成");
};

refreshState();
</script>

<template>
  <div class="secure-link-page">
    <el-card shadow="never">
      <template #header>
        <div class="header">
          <span>SecureLink 安全传输</span>
          <el-tag size="small" type="warning">{{ modeText }}</el-tag>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        title="流程：密钥协商 → POST /client/secure/echo（AES + HMAC）。请确保服务端已启动。"
        class="mb-16"
      />

      <el-space wrap>
        <el-button type="primary" :loading="loading" @click="handleInit">
          1. 初始化 frontendId + 密钥协商
        </el-button>
        <el-button
          :disabled="!dekPreview || dekPreview === '-'"
          :loading="transportLoading"
          @click="handleSecureTransport"
        >
          2. 加密传输 + 验签
        </el-button>
        <el-button
          :disabled="!signKeyPreview || signKeyPreview === '-'"
          @click="handleSignPreview"
        >
          3. 预览签名参数
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
          <h4>请求密文 EncryptDataDto</h4>
          <pre>{{ encryptPayload || "暂无" }}</pre>
        </el-col>
        <el-col :span="12">
          <h4>响应明文（已解密）</h4>
          <pre>{{ decryptPreview || "暂无" }}</pre>
        </el-col>
      </el-row>

      <h4 class="mt-16">签名参数</h4>
      <pre>{{ signPreview || "暂无" }}</pre>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.secure-link-page {
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
