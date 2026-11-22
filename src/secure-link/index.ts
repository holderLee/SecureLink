/**
 * SecureLink 功能包统一出口
 *
 * import { useFrontendCrypto, encryptDataWithDEK, keyManager } from '@/secure-link'
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
export { secureEcho } from "@/secure-link/api/secureEcho";
