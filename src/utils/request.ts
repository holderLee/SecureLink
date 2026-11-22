/**
 * Axios 实例（SecureLink）
 *
 * - 自动携带 frontendId
 * - config.encrypt === true → AES 加密请求体 / 解密响应
 * - config.sign === true → HMAC 验签头
 *
 * 注意：此处禁止从 `@/secure-link` 桶文件导入（桶会再导出 api → request，形成循环依赖）。
 * 只从 utils/hooks 的具体文件引入。
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
} from "@/secure-link/utils/webCrypto";
import { objectToQueryString } from "@/secure-link/utils/query";
import { keyManager } from "@/secure-link/utils/keyManager";

/** 读取带过期结构的 frontendId（避免 request ↔ useFrontendCrypto 循环依赖） */
function getFrontendIdFromStorage() {
  const itemStr = localStorage.getItem("frontendId");
  if (!itemStr) return "";
  try {
    const item = JSON.parse(itemStr);
    if (item.expiry && Date.now() > item.expiry) {
      localStorage.removeItem("frontendId");
      return "";
    }
    return item.value || "";
  } catch {
    return "";
  }
}

function currentLang() {
  try {
    return String((i18n.global as any).locale?.value || "zh-cn");
  } catch {
    return "zh-cn";
  }
}

const service = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_API,
  timeout: 50000,
  headers: { "Content-Type": "application/json;charset=utf-8" },
});

service.interceptors.request.use(
  async (config: InternalAxiosRequestConfig | any) => {
    const userStore = useUserStoreHook();
    const token = userStore.token || "";
    if (token) {
      config.headers.Authorization = token;
    }

    const frontendId = getFrontendIdFromStorage();
    if (frontendId) {
      config.headers.frontendId = frontendId;
    }

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
        nonce: crypto.randomUUID().replace(/-/g, ""),
        param: "",
      };

      const method = String(config.method || "get").toLowerCase();
      if (method === "get") {
        const qs = objectToQueryString(config.params);
        signParams.param = qs ? jsonToBase64(qs) : "";
      } else {
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
  (error: any) => Promise.reject(error)
);

service.interceptors.response.use(
  async (response: AxiosResponse) => {
    const res = response.data;
    const { code, msg } = res || {};

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

    if (response.data instanceof ArrayBuffer) {
      return response;
    }

    ElMessage.error(msg || "系统出错");
    return Promise.reject(new Error(msg || "Error"));
  },
  (error: any) => {
    if (error.response?.data) {
      const { code, msg } = error.response.data;
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
