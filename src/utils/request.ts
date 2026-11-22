/**
 * Axios 实例（SecureLink）
 *
 * 本阶段已接通：
 * - 自动携带 frontendId
 * - config.encrypt === true 时：请求体 AES 加密
 * - 响应 encrypt === true 时：响应 data AES 解密
 *
 * 尚未接通（后续步骤）：
 * - HMAC 验签头（sign/nonce/timestamp...）
 */
import axios, { InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { useUserStoreHook } from "@/store/modules/user";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  encryptDataWithDEK,
  decryptDataWithDEK,
  keyManager,
  useFrontendCrypto,
} from "@/secure-link";

const { getLocalStorageWithExpiry } = useFrontendCrypto();

/** 创建 axios 实例 */
const service = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API,
  timeout: 50000,
  headers: { "Content-Type": "application/json;charset=utf-8" },
});

/** 请求拦截器 */
service.interceptors.request.use(
  async (config: InternalAxiosRequestConfig | any) => {
    const userStore = useUserStoreHook();
    if (userStore.token) {
      config.headers.Authorization = userStore.token;
    }

    // 所有安全相关请求都需要 frontendId（后端靠它找 DEK）
    const frontendId = getLocalStorageWithExpiry("frontendId") || "";
    if (frontendId) {
      config.headers.frontendId = frontendId;
    }

    /**
     * 业务接口若声明 encrypt: true：
     * 把明文 config.data 加密成 EncryptDataDto
     * （与原 bycard request.ts 习惯一致）
     */
    if (config.encrypt) {
      const dek = keyManager.getDek();
      if (!dek) {
        return Promise.reject(
          new Error("DEK 不存在，请先完成 frontendId + 密钥协商")
        );
      }
      config.data = await encryptDataWithDEK(config.data ?? {}, dek);
    }

    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

/** 响应拦截器 */
service.interceptors.response.use(
  async (response: AxiosResponse) => {
    const res = response.data;
    const { code, msg } = res || {};

    // 兼容模板成功码 "00000" 与 SecureLink 成功码 0
    if (code === "00000" || code === 0) {
      /**
       * 后端若标记 encrypt: true，则 data 是密文字段集合，
       * 需用内存 DEK 解密后再交给业务代码。
       */
      if (res?.encrypt) {
        const dek = keyManager.getDek();
        if (!dek) {
          ElMessage.error("DEK 不存在，无法解密响应");
          return Promise.reject(new Error("DEK missing"));
        }
        const plain = await decryptDataWithDEK(res.data, dek as any);
        return {
          ...res,
          data: JSON.parse(plain),
        };
      }
      return res;
    }

    /** 响应数据为二进制流处理(Excel导出) */
    if (response.data instanceof ArrayBuffer) {
      return response;
    }

    ElMessage.error(msg || "系统出错");
    return Promise.reject(new Error(msg || "Error"));
  },
  (error: any) => {
    if (error.response?.data) {
      const { code, msg } = error.response.data;
      /** token 过期,重新登录 */
      if (code === "A0230") {
        ElMessageBox.confirm("当前页面已失效，请重新登录", "提示", {
          confirmButtonText: "确定",
          type: "warning",
        }).then(() => {
          const userStore = useUserStoreHook();
          userStore.resetToken().then(() => {
            location.reload();
          });
        });
      } else {
        ElMessage.error(msg || "系统出错");
      }
    }
    return Promise.reject(error.message || error);
  }
);

export default service;
