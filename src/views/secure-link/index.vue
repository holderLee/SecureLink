<script setup lang="ts">
/**
 * SecureLink 演示页
 *
 * 1) 阶段1+2：frontendId + 密钥协商
 * 2) 阶段3+4：加密通信 + HMAC 验签（同一条 /client/demo/echo）
 * 3) 本地再预览一次签名参数（对照用）
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
 * 按钮2：加密 + 验签 真实通信
 * - 左侧：本地预览 EncryptDataDto
 * - 右侧：后端验签通过后的解密响应
 */
const handleEncryptDemo = async () => {
  const dek = keyManager.getDek();
  const signKey = keyManager.getSignKey();
  if (!dek || !signKey) {
    ElMessage.warning("请先完成密钥协商");
    return;
  }

  encryptLoading.value = true;
  try {
    const plain = { password: "123456", demo: true, at: Date.now() };

    // 本地预览密文形态（真正发出去的密文由拦截器再生成一份）
    const enc = await encryptDataWithDEK(plain, dek);
    encryptPayload.value = JSON.stringify(enc, null, 2);

    // 拦截器：encrypt + sign → 后端解密→验签→加密响应→前端解密
    const res: any = await demoEcho(plain);
    decryptPreview.value = JSON.stringify(res?.data ?? res, null, 2);
    ElMessage.success("加密+验签通信完成");
  } catch (error: any) {
    ElMessage.error(error?.message || "加密/验签通信失败");
  } finally {
    encryptLoading.value = false;
  }
};

/** 按钮3：仅本地预览签名参数（与拦截器规则一致，便于对照） */
const handleSignDemo = async () => {
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
  ElMessage.success("本地签名参数预览已生成（真实验签请点按钮2）");
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
        title="联调：①身份密钥 ②加密+HMAC验签(/client/demo/echo)。请同时启动 server:8989。"
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
          2. 加密 + 验签通信
        </el-button>
        <el-button :disabled="!signKeyPreview || signKeyPreview === '-'" @click="handleSignDemo">
          3. 本地签名参数预览
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
          <h4>后端解密+验签后的响应（前端已解密）</h4>
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
