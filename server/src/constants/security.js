/**
 * 安全模块常量（与技术方案 / 前端 constants 对齐）
 */

export const SUCCESS_CODE = 0;
export const INVALID_FRONTEND_ID = 1002059;
export const ENCRYPT_FAIL = 1002060;
export const DECRYPT_FAIL = 1002061;
/** 请求 KMS/Vault 失败（本地未接入 Vault 时等同密钥生成失败） */
export const REQUEST_KMS_FAIL = 1002062;
export const INVALID_SIGNATURE = -201;

/** frontendId TTL（秒），默认 7 天 */
export const FRONTEND_ID_TTL_SECONDS = Number(
  process.env.FRONTEND_ID_TTL_SECONDS || 7 * 24 * 60 * 60
);

/** DEK / signKey TTL（秒），默认 2 小时 */
export const SECURITY_KEY_TTL_SECONDS = Number(
  process.env.SECURITY_KEY_TTL_SECONDS || 2 * 60 * 60
);

/** 时间戳允许的时钟偏差（毫秒），默认 5 分钟 */
export const TIMESTAMP_SKEW_MS = Number(
  process.env.TIMESTAMP_SKEW_MS || 5 * 60 * 1000
);

/** nonce 防重放 TTL（秒），建议 ≥ 时间戳偏差窗口，默认 5 分钟 */
export const NONCE_TTL_SECONDS = Number(
  process.env.NONCE_TTL_SECONDS || 5 * 60
);

/** Redis key 命名（ioredis 还会再加 securelink: 前缀） */
export const redisKeys = {
  frontendId: (id) => `frontendId:${id}`,
  dek: (id) => `dek:${id}`,
  signKey: (id) => `signKey:${id}`,
  nonce: (frontendId, nonce) => `nonce:${frontendId}:${nonce}`,
};
