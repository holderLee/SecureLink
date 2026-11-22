<script setup lang="ts">
/**
 * SecureLink 演示站：身份初始化 → 密钥协商 → 加密传输 → 验签探测
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
const signLoading = ref(false);
const frontendId = ref("");
const dekPreview = ref("");
const signKeyPreview = ref("");
const encryptPayload = ref("");
const signPreview = ref("");
const decryptPreview = ref("");
/** 交互引导：0 未开始 / 1 已协商 / 2 已传输 / 3 已预览签名 */
const playStep = ref(0);

const modeText = computed(() => (SECURE_LINK_MOCK ? "本地 Mock" : "真实接口"));

const hasKeys = computed(
  () => Boolean(dekPreview.value) && dekPreview.value !== "-"
);

/** 任一操作进行中：禁止连点并发请求 */
const isBusy = computed(
  () => loading.value || transportLoading.value || signLoading.value
);

/** 同步锁：挡住同一事件循环内的连点（早于 Vue 重渲染） */
let actionLocked = false;
/** 操作结束后的冷却，避免接口过快时连点立刻再发 */
const ACTION_COOLDOWN_MS = 1500;
let cooldownUntil = 0;

const notify = (type: "success" | "error" | "warning", message: string) => {
  ElMessage.closeAll();
  ElMessage[type](message);
};

const canStartAction = () => {
  if (actionLocked || isBusy.value) return false;
  if (Date.now() < cooldownUntil) return false;
  return true;
};

const beginAction = () => {
  actionLocked = true;
};

const endAction = () => {
  actionLocked = false;
  cooldownUntil = Date.now() + ACTION_COOLDOWN_MS;
};

/** 流程可视化激活到第几步（0–3） */
const flowActive = computed(() => {
  if (playStep.value >= 3) return 3;
  if (playStep.value >= 2) return 2;
  if (playStep.value >= 1) return 1;
  return 0;
});

const flowSteps = [
  {
    title: "身份标识",
    desc: "先向服务端领取一个 frontendId，相当于这次会话的「通行证」。",
  },
  {
    title: "密钥协商",
    desc: "用 RSA 安全换出 AES 密钥（DEK）和签名密钥（signKey），只存在浏览器内存里。",
  },
  {
    title: "加密传输",
    desc: "业务数据用 AES-256-GCM 加密后再发送，路上看到的是密文，不是明文。",
  },
  {
    title: "验签防重放",
    desc: "每次请求带 HMAC 签名、时间戳和一次性 nonce，防止篡改和重放攻击。",
  },
];

const mask = (value: string, keep = 8) => {
  if (!value) return "-";
  if (value.length <= keep * 2) return value;
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
};

const refreshState = () => {
  frontendId.value = getLocalStorageWithExpiry("frontendId") || "";
  dekPreview.value = mask(keyManager.getDek() || "");
  signKeyPreview.value = mask(keyManager.getSignKey() || "");
  if (keyManager.getDek() && keyManager.getSignKey() && playStep.value < 1) {
    playStep.value = 1;
  }
};

const scrollToPlay = () => {
  document.getElementById("play-section")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};

const handleInit = async () => {
  if (!canStartAction()) return;

  const cachedId = getLocalStorageWithExpiry("frontendId");
  const hasMemoryKeys = Boolean(keyManager.getDek() && keyManager.getSignKey());

  // 本地 frontendId 未过期且内存密钥仍在：直接复用，不发请求
  if (cachedId && hasMemoryKeys) {
    beginAction();
    refreshState();
    playStep.value = Math.max(playStep.value, 1);
    notify("success", "已复用缓存的 frontendId 与密钥");
    endAction();
    return;
  }

  beginAction();
  loading.value = true;
  try {
    // 不传 true：优先读 localStorage 缓存，过期/缺失才向服务端申请
    const id = (await fetchFrontendId()) as string;
    if (!id) {
      throw new Error("未获取到 frontendId");
    }
    // 刷新后密钥只在内存丢失时需要重新协商
    if (!keyManager.getDek() || !keyManager.getSignKey()) {
      await fetchSecurityParam(id);
    }
    refreshState();
    playStep.value = Math.max(playStep.value, 1);
    notify(
      "success",
      cachedId
        ? "已复用 frontendId，并完成密钥协商"
        : "已完成 frontendId 与密钥协商"
    );
  } catch (error: any) {
    notify("error", error?.message || "初始化失败");
  } finally {
    loading.value = false;
    endAction();
  }
};

/** 加密 + 验签往返探测 */
const handleSecureTransport = async () => {
  if (!canStartAction()) return;
  const dek = keyManager.getDek();
  const signKey = keyManager.getSignKey();
  if (!dek || !signKey) {
    notify("warning", "请先完成密钥协商");
    return;
  }

  beginAction();
  transportLoading.value = true;
  try {
    const plain = { password: "123456", probe: true, at: Date.now() };
    const enc = await encryptDataWithDEK(plain, dek);
    encryptPayload.value = JSON.stringify(enc, null, 2);

    const res: any = await secureEcho(plain);
    decryptPreview.value = JSON.stringify(res?.data ?? res, null, 2);
    playStep.value = Math.max(playStep.value, 2);
    notify("success", "加密传输与验签成功");
  } catch (error: any) {
    notify("error", error?.message || "传输失败");
  } finally {
    transportLoading.value = false;
    endAction();
  }
};

/** 本地预览签名字段（不发起请求） */
const handleSignPreview = async () => {
  if (!canStartAction()) return;
  const signKey = keyManager.getSignKey();
  if (!signKey) {
    notify("warning", "请先完成密钥协商");
    return;
  }

  beginAction();
  signLoading.value = true;
  try {
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
    playStep.value = Math.max(playStep.value, 3);
    notify("success", "签名参数已生成");
  } catch (error: any) {
    notify("error", error?.message || "签名预览失败");
  } finally {
    signLoading.value = false;
    endAction();
  }
};

refreshState();
</script>

<template>
  <div class="sl-page">
    <div class="sl-mesh" aria-hidden="true"></div>

    <!-- Hero -->
    <header class="sl-hero">
      <p class="sl-hero__eyebrow">Frontend Security Demo</p>
      <h1 class="sl-hero__brand">SecureLink</h1>
      <p class="sl-hero__tagline">
        让敏感请求像聊天一样被保护 —— 从身份、密钥到加密验签，一眼看懂整条链路。
      </p>
      <div class="sl-hero__actions">
        <button
          type="button"
          class="sl-btn sl-btn--primary"
          @click="scrollToPlay"
        >
          开始体验
        </button>
        <span class="sl-mode">当前：{{ modeText }}</span>
      </div>
    </header>

    <!-- 四步流程 -->
    <section class="sl-section sl-flow" aria-labelledby="flow-title">
      <h2 id="flow-title" class="sl-section__title">安全流程，四步说清</h2>
      <p class="sl-section__lead">
        不用先啃密码学名词：跟着步骤走一遍，就知道数据是怎么被保护起来的。
      </p>

      <ol class="sl-flow__list">
        <li
          v-for="(step, index) in flowSteps"
          :key="step.title"
          class="sl-flow__item"
          :class="{
            'is-active': flowActive === index,
            'is-done': flowActive > index,
          }"
        >
          <div class="sl-flow__index">{{ index + 1 }}</div>
          <div class="sl-flow__body">
            <h3>{{ step.title }}</h3>
            <p>{{ step.desc }}</p>
          </div>
        </li>
      </ol>
    </section>

    <!-- 交互体验 -->
    <section
      id="play-section"
      class="sl-section sl-play"
      aria-labelledby="play-title"
    >
      <h2 id="play-title" class="sl-section__title">动手走一遍</h2>
      <p class="sl-section__lead">
        按顺序点下方步骤。完成后，上方流程会跟着亮起，方便对照当前进度。
      </p>

      <div class="sl-play__guide">
        <button
          type="button"
          class="sl-play__step"
          :class="{ 'is-current': playStep === 0, 'is-done': playStep >= 1 }"
          @click="handleInit"
        >
          <span class="sl-play__num">1</span>
          <span class="sl-play__label">
            <strong>初始化身份 + 密钥协商</strong>
            <small>领取 frontendId，换出 DEK / signKey</small>
          </span>
        </button>
        <button
          type="button"
          class="sl-play__step"
          :class="{ 'is-current': playStep === 1, 'is-done': playStep >= 2 }"
          :disabled="!hasKeys"
          @click="handleSecureTransport"
        >
          <span class="sl-play__num">2</span>
          <span class="sl-play__label">
            <strong>加密传输 + 验签</strong>
            <small>POST /client/secure/echo，看密文与回包</small>
          </span>
        </button>
        <button
          type="button"
          class="sl-play__step"
          :class="{ 'is-current': playStep === 2, 'is-done': playStep >= 3 }"
          :disabled="!hasKeys"
          @click="handleSignPreview"
        >
          <span class="sl-play__num">3</span>
          <span class="sl-play__label">
            <strong>预览签名参数</strong>
            <small>本地生成 timestamp / nonce / sign</small>
          </span>
        </button>
      </div>

      <div class="sl-keys" :class="{ 'is-visible': hasKeys || frontendId }">
        <div class="sl-keys__item">
          <span class="sl-keys__label">frontendId</span>
          <code>{{ frontendId || "尚未初始化" }}</code>
        </div>
        <div class="sl-keys__item">
          <span class="sl-keys__label">DEK（内存，已脱敏）</span>
          <code>{{ dekPreview }}</code>
        </div>
        <div class="sl-keys__item">
          <span class="sl-keys__label">signKey（内存，已脱敏）</span>
          <code>{{ signKeyPreview }}</code>
        </div>
      </div>

      <div
        class="sl-panels"
        :class="{
          'is-visible': encryptPayload || decryptPreview || signPreview,
        }"
      >
        <div class="sl-panel">
          <h4>请求密文 EncryptDataDto</h4>
          <pre>{{ encryptPayload || "完成步骤 2 后显示" }}</pre>
        </div>
        <div class="sl-panel">
          <h4>响应明文（已解密）</h4>
          <pre>{{ decryptPreview || "完成步骤 2 后显示" }}</pre>
        </div>
        <div class="sl-panel sl-panel--wide">
          <h4>签名参数预览</h4>
          <pre>{{ signPreview || "完成步骤 3 后显示" }}</pre>
        </div>
      </div>
    </section>

    <footer class="sl-footer">
      <span>SecureLink</span>
      <span>Vue3 · Express · Web Crypto · Redis</span>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.sl-page {
  --sl-teal: #0d9488;
  --sl-cyan: #0891b2;
  --sl-ink: #0f172a;
  --sl-muted: #64748b;
  --sl-line: rgb(15 23 42 / 8%);
  --sl-surface: rgb(255 255 255 / 72%);
  --sl-pad: clamp(16px, 4vw, 24px);

  position: relative;
  width: 100%;
  min-height: 100%;
  overflow-x: hidden;
  color: var(--sl-ink);
  background: #f4faf9;
}

.sl-mesh {
  position: absolute;
  inset: 0 0 auto;
  z-index: 0;
  height: min(72vh, 640px);
  pointer-events: none;
  background: radial-gradient(
      ellipse 70% 55% at 18% 12%,
      rgb(13 148 136 / 28%),
      transparent 55%
    ),
    radial-gradient(
      ellipse 55% 45% at 88% 8%,
      rgb(8 145 178 / 22%),
      transparent 50%
    ),
    radial-gradient(
      ellipse 50% 40% at 55% 42%,
      rgb(45 212 191 / 16%),
      transparent 60%
    ),
    linear-gradient(180deg, #eef8f7 0%, #f4faf9 70%, #f4faf9 100%);
}

.sl-hero,
.sl-section,
.sl-footer {
  position: relative;
  z-index: 1;
  width: min(1080px, calc(100% - var(--sl-pad) * 2));
  margin-inline: auto;
}

/* ----- Hero：顶对齐，去掉 100vh 底部贴齐造成的上方空洞 ----- */
.sl-hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: clamp(20px, 3.5vw, 36px) 0 clamp(32px, 5vw, 48px);
  animation: sl-fade-up 0.9s ease both;
}

.sl-hero__eyebrow {
  margin: 0 0 12px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--sl-teal);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.sl-hero__brand {
  margin: 0;
  font-size: clamp(2.6rem, 11vw, 5.6rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
  background: linear-gradient(120deg, var(--sl-ink) 20%, var(--sl-teal) 90%);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.sl-hero__tagline {
  max-width: 36rem;
  margin: 16px 0 0;
  font-size: clamp(1rem, 2.4vw, 1.25rem);
  font-weight: 500;
  line-height: 1.65;
  color: var(--sl-muted);
}

.sl-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: center;
  margin-top: 28px;
}

.sl-btn {
  min-height: 48px;
  padding: 12px 28px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  border-radius: 999px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.sl-btn--primary {
  color: #fff;
  background: linear-gradient(135deg, var(--sl-teal), var(--sl-cyan));
  box-shadow: 0 12px 28px rgb(13 148 136 / 28%);

  &:hover {
    box-shadow: 0 16px 32px rgb(13 148 136 / 34%);
    transform: translateY(-1px);
  }
}

.sl-mode {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--sl-muted);
}

/* ----- Sections ----- */
.sl-section {
  padding: clamp(40px, 8vw, 64px) 0 16px;
}

.sl-section__title {
  margin: 0;
  font-size: clamp(1.45rem, 4vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.sl-section__lead {
  max-width: 38rem;
  margin: 12px 0 0;
  font-size: clamp(0.95rem, 2.5vw, 1.05rem);
  line-height: 1.7;
  color: var(--sl-muted);
}

/* ----- Flow ----- */
.sl-flow__list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 0;
  margin: 32px 0 0;
  list-style: none;
}

.sl-flow__item {
  position: relative;
  padding: 18px 16px 20px;
  background: var(--sl-surface);
  backdrop-filter: blur(10px);
  border: 1px solid var(--sl-line);
  border-radius: 20px;
  transition: border-color 0.35s ease, box-shadow 0.35s ease,
    transform 0.35s ease;
}

.sl-flow__item.is-active {
  border-color: rgb(13 148 136 / 45%);
  box-shadow: 0 14px 36px rgb(13 148 136 / 14%);
  transform: translateY(-4px);
}

.sl-flow__item.is-done {
  border-color: rgb(13 148 136 / 28%);
}

.sl-flow__item.is-done .sl-flow__index,
.sl-flow__item.is-active .sl-flow__index {
  color: #fff;
  background: linear-gradient(135deg, var(--sl-teal), var(--sl-cyan));
}

.sl-flow__index {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-bottom: 12px;
  font-weight: 800;
  color: var(--sl-teal);
  background: rgb(13 148 136 / 12%);
  border-radius: 50%;
  transition: background 0.35s ease, color 0.35s ease;
}

.sl-flow__body h3 {
  margin: 0 0 8px;
  font-size: 1.05rem;
  font-weight: 700;
}

.sl-flow__body p {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.6;
  color: var(--sl-muted);
}

/* ----- Play ----- */
.sl-play__guide {
  display: grid;
  gap: 12px;
  margin-top: 28px;
}

.sl-play__step {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  width: 100%;
  min-height: 72px;
  padding: 16px 18px;
  font-family: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: var(--sl-surface);
  border: 1px solid var(--sl-line);
  border-radius: 18px;
  transition: border-color 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease;
  -webkit-tap-highlight-color: transparent;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }

  &:not(:disabled):hover {
    border-color: rgb(13 148 136 / 35%);
  }

  &.is-current {
    border-color: rgb(13 148 136 / 42%);
    box-shadow: 0 10px 28px rgb(13 148 136 / 12%);
  }

  &.is-done .sl-play__num {
    color: #fff;
    background: linear-gradient(135deg, var(--sl-teal), var(--sl-cyan));
  }
}

.sl-play__num {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 40px;
  height: 40px;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--sl-teal);
  background: rgb(13 148 136 / 12%);
  border-radius: 50%;
  transition: background 0.3s ease, color 0.3s ease;
}

.sl-play__label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding-top: 2px;

  strong {
    font-size: 1.02rem;
    font-weight: 700;
    word-break: break-word;
  }

  small {
    font-size: 0.86rem;
    line-height: 1.45;
    color: var(--sl-muted);
    word-break: break-word;
  }
}

.sl-keys {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 24px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.45s ease, transform 0.45s ease;
  transform: translateY(8px);

  &.is-visible {
    pointer-events: auto;
    opacity: 1;
    transform: none;
  }
}

.sl-keys__item {
  min-width: 0;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid var(--sl-line);
  border-radius: 16px;
}

.sl-keys__label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--sl-muted);
  letter-spacing: 0.02em;
}

.sl-keys__item code {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--sl-ink);
  word-break: break-all;
  overflow-wrap: anywhere;
}

.sl-panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.45s ease, transform 0.45s ease;
  transform: translateY(10px);

  &.is-visible {
    pointer-events: auto;
    opacity: 1;
    transform: none;
  }
}

.sl-panel {
  min-width: 0;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid var(--sl-line);
  border-radius: 16px;

  &--wide {
    grid-column: 1 / -1;
  }

  h4 {
    margin: 0 0 10px;
    font-size: 0.92rem;
    font-weight: 700;
  }

  pre {
    max-height: 220px;
    padding: 12px;
    margin: 0;
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.72rem;
    line-height: 1.5;
    color: var(--sl-muted);
    word-break: break-all;
    white-space: pre-wrap;
    background: #f1f5f4;
    border-radius: 12px;
    -webkit-overflow-scrolling: touch;
  }
}

.sl-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  justify-content: space-between;
  padding: 36px 0 calc(28px + env(safe-area-inset-bottom, 0px));
  margin-top: 32px;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--sl-muted);
  border-top: 1px solid var(--sl-line);
}

@keyframes sl-fade-up {
  from {
    opacity: 0;
    transform: translateY(18px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

/* ----- Tablet ----- */
@media (width <= 900px) {
  .sl-flow__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sl-keys {
    grid-template-columns: 1fr;
  }

  .sl-panels {
    grid-template-columns: 1fr;
  }

  .sl-flow__item.is-active {
    transform: none;
  }
}

/* ----- Phone ----- */
@media (width <= 640px) {
  .sl-flow__list {
    grid-template-columns: 1fr;
  }

  .sl-hero__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .sl-btn {
    width: 100%;
  }

  .sl-mode {
    text-align: center;
  }

  .sl-play__step {
    padding: 14px;
  }

  .sl-play__num {
    width: 36px;
    height: 36px;
  }

  .sl-footer {
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sl-hero,
  .sl-flow__item,
  .sl-play__step,
  .sl-keys,
  .sl-panels {
    transition: none !important;
    animation: none !important;
  }
}
</style>
