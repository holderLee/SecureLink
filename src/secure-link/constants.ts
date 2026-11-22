/**
 * SecureLink 常量定义
 *
 * 说明：
 * - 错误码与《敏感数据安全传输与接口验签技术方案》/原 bycard 前端 apiCode 对齐
 * - 业务侧收到这些 code 时，通常需要重新走 frontendId + 密钥协商
 */

/** 接口成功 */
export const SUCCESS_CODE = 0;

/** frontendId 无效/过期（技术方案：INVALID_FRONTEND_ID） */
export const FRONTEND_ID_EXPIRED_CODE = 1002059;

/** 加密失败 */
export const ENCRYPT_FAIL_CODE = 1002060;

/** 解密失败 */
export const DECRYPT_FAILED_CODE = 1002061;

/** 请求 KMS/Vault 失败 */
export const REQUEST_KMS_FAIL_CODE = 1002062;

/** 验签失败/签名无效（技术方案：INVALID_SIGNATURE） */
export const VERIFY_SIGN_EXPIRED_CODE = -201;

/**
 * 是否启用本地 Mock
 *
 * - true：不请求真实后端，由 mockSecurity 在浏览器内模拟 Vault/接口返回
 * - false：调用真实 `/client/security/...` 接口
 *
 * 开关来源：`.env.*` 中的 VITE_SECURE_LINK_MOCK
 */
export const SECURE_LINK_MOCK =
  String(import.meta.env.VITE_SECURE_LINK_MOCK ?? "true") === "true";
