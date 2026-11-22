/**
 * Axios 实例（SecureLink）
 *
 * 已接通：
 * - 自动携带 frontendId
 * - config.encrypt === true → AES 加密请求体 / 解密响应
 * - config.sign === true → HMAC 验签头（sign/nonce/timestamp/lang/token）
 *
 * 验签约定（与技术方案一致）：
 * - param 取「加密前」的业务 JSON 字符串，再 Base64
 * - 后端先解密再验签
 */
import axios, { InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { useUserStoreHook } from "@/store/modules/user";
import { ElMessage, ElMessageBox } from "element-plus";
import i18n from "@/lang/index";
import {
  encryptDataWithDEK,
  decryptDataWithDEK,
  generateSignature,
  jsonToBase64,
  objectToQueryString,
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

/** 读取当前语言（签名字段 lang） */
function currentLang() {
  try {
    return String((i18n.global as any).locale?.value || "zh-cn");
  } catch {
    return "zh-cn";
  }
}

/** 请求拦截器 */
service.interceptors.request.use(
  async (config: InternalAxiosRequestConfig | any) => {
    const userStore = useUserStoreHook();
    const token = userStore.token || "";
    if (token) {
      config.headers.Authorization = token;
    }

    // 所有安全相关请求都需要 frontendId（后端靠它找 DEK/signKey）
    const frontendId = getLocalStorageWithExpiry("frontendId") || "";
    if (frontendId) {
      config.headers.frontendId = frontendId;
    }

    /**
     * 加密前先留一份明文，供验签 param 使用（方案：加密前原始 body）
     */
    let plainForSign: any = undefined;
    if (config.encrypt) {
      const dek = keyManager.getDek();
      if (!dek) {
        return Promise.reject(
          new Error("DEK 不存在，请先完成 frontendId + 密钥协商")
        );
      }
      plainForSign = config.data ?? {};
      config.data = await encryptDataWithDEK(plainForSign, dek);
    }

    /**
     * 验签：config.sign === true 时生成 HMAC 头
     */
    if (config.sign) {
      const signKey = keyManager.getSignKey();
      if (!signKey) {
        return Promise.reject(
          new Error("signKey 不存在，请先完成 frontendId + 密钥协商")
        );
      }

      const signParams: Record<string, any> = {
        lang: currentLang(),
        token: token || "",
        timestamp: Date.now(),
        // 方案要求 32 位随机串：去掉 UUID 横线
        nonce: crypto.randomUUID().replace(/-/g, ""),
        param: "",
      };

      const method = String(config.method || "get").toLowerCase();
      if (method === "get") {
        const qs = objectToQueryString(config.params);
        signParams.param = qs ? jsonToBase64(qs) : "";
      } else {
        // POST：优先用加密前明文；未加密则用当前 body
        let raw = "";
        if (config.encrypt) {
          raw = JSON.stringify(plainForSign ?? {});
        } else if (typeof config.data === "string") {
          raw = config.data;
        } else if (config.data != null) {
          raw = JSON.stringify(config.data);
        }
        signParams.param = raw ? jsonToBase64(raw) : "";
      }

      const sign = await generateSignature(signParams, signKey);
      config.headers.sign = sign;
      config.headers.timestamp = String(signParams.timestamp);
      config.headers.nonce = signParams.nonce;
      config.headers.token = signParams.token;
      config.headers.lang = signParams.lang;
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
