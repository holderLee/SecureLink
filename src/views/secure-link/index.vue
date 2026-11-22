<script setup lang="ts">
/**
 * SecureLink 演示页
 *
 * 用三个按钮把技术方案主链路拆开验证：
 * 1) 阶段1+2：frontendId + 密钥协商（DEK / signKey 进内存）
 * 2) 阶段3：本地 AES-GCM 加解密（不发业务接口）
 * 3) 阶段4：按约定组装签名参数并计算 HMAC sign
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
  decryptDataWithDEK,
  generateSignature,
  jsonToBase64,
} from "@/secure-link";

const { fetchFrontendId, fetchSecurityParam, getLocalStorageWithExpiry } =
  useFrontendCrypto();

/** 页面展示状态 */
const loading = ref(false);
const frontendId = ref("");
const dekPreview = ref("");
const signKeyPreview = ref("");
const encryptPayload = ref("");
const signPreview = ref("");
const decryptPreview = ref("");

/** 顶部标签：提示当前是 Mock 还是真实接口 */
const mockModeText = computed(() =>
  SECURE_LINK_MOCK ? "本地 Mock（不请求真实后端）" : "真实接口模式"
);

/**
 * 密钥脱敏展示：只留前后若干位，避免演示页明文铺开
 */
const mask = (value: string, keep = 8) => {
  if (!value) return "-";
  if (value.length <= keep * 2) return value;
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
};

/** 从 localStorage / 内存同步到页面展示字段 */
const refreshState = () => {
  frontendId.value = getLocalStorageWithExpiry("frontendId") || "";
  dekPreview.value = mask(keyManager.getDek() || "");
  signKeyPreview.value = mask(keyManager.getSignKey() || "");
};

/**
 * 按钮1：强制重新申请 frontendId，并完成密钥协商
 * isUpdate=true 会先 cache 旧 DEK，再拉新身份
 */
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
 * 按钮2：本地加解密闭环
 * 加密结果结构即 EncryptDataDto；再立刻用同一 DEK 解密回显，验证实现正确
 */
const handleEncryptDemo = async () => {
  const dek = keyManager.getDek();
  if (!dek) {
    ElMessage.warning("请先完成密钥协商");
    return;
  }
  const plain = { password: "123456", demo: true, at: Date.now() };
  const enc = await encryptDataWithDEK(plain, dek);
  encryptPayload.value = JSON.stringify(enc, null, 2);
  const plainAgain = await decryptDataWithDEK(enc as any, dek as any);
  decryptPreview.value = plainAgain;
  ElMessage.success("本地加解密演示完成");
};

/**
 * 按钮3：按方案组装验签参数并计算 sign
 * 真实请求里这些字段会进 header：token/nonce/timestamp/lang/sign
 */
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
    // 业务参数先转 JSON，再 Base64，对应方案里的 param
    param: jsonToBase64(JSON.stringify(body)),
  };
  const sign = await generateSignature(signParams, signKey);
  signPreview.value = JSON.stringify({ ...signParams, sign }, null, 2);
  ElMessage.success("本地验签参数生成完成");
};

// 进入页面时先回填已有状态（例如刷新后 frontendId 仍在 localStorage）
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
        title="当前联调：阶段1 frontendId + 阶段2 密钥协商。验签与加密通信后续再补。请同时启动 server（8989）与本前端。"
        class="mb-16"
      />

      <el-space wrap>
        <el-button type="primary" :loading="loading" @click="handleInit">
          1. 初始化 frontendId + 密钥协商
        </el-button>
        <el-button :disabled="!dekPreview || dekPreview === '-'" @click="handleEncryptDemo">
          2. 演示 AES 加解密
        </el-button>
        <el-button :disabled="!signKeyPreview || signKeyPreview === '-'" @click="handleSignDemo">
          3. 演示签名参数
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
          <h4>加密请求体 EncryptDataDto</h4>
          <pre>{{ encryptPayload || "暂无" }}</pre>
        </el-col>
        <el-col :span="12">
          <h4>本地解密回显</h4>
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
