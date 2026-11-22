/**
 * SecureLink 功能包统一出口
 *
 * 业务代码建议只从这里导入，例如：
 * import { useFrontendCrypto, encryptDataWithDEK, keyManager } from '@/secure-link'
 *
 * 目录职责速览：
 * - constants：错误码 / Mock 开关
 * - utils/webCrypto：RSA / AES-GCM / HMAC
 * - utils/keyManager：DEK、signKey 内存管理
 * - hooks/useFrontendCrypto：阶段1+2 编排
 * - api/security：真实/Mock 接口切换
 */
export * from "@/secure-link/constants";
export { keyManager } from "@/secure-link/utils/keyManager";
export {
  generateKeysNative,
  decryptWithNative,
  encryptDataWithDEK,
  decryptDataWithDEK,
  generateSignature,
  jsonToBase64,
} from "@/secure-link/utils/webCrypto";
export { objectToQueryString } from "@/secure-link/utils/query";
export { useFrontendCrypto } from "@/secure-link/hooks/useFrontendCrypto";
export { genFrontendId, genSecurityParam } from "@/secure-link/api/security";
export { demoEcho } from "@/secure-link/api/demoBiz";
