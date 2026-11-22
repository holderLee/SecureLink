/**
 * 前端安全初始化编排
 * - 获取 / 缓存 frontendId
 * - 生成 RSA 密钥对 → genSecurityParam → 解密得到 DEK/signKey
 */
import { ElMessage } from "element-plus";
import { genFrontendId, genSecurityParam } from "@/secure-link/api/security";
import {
  generateKeysNative,
  decryptWithNative,
} from "@/secure-link/utils/webCrypto";
import { keyManager } from "@/secure-link/utils/keyManager";
import { SUCCESS_CODE } from "@/secure-link/constants";

export const useFrontendCrypto = () => {
  /**
   * 读取带过期结构的 localStorage
   * 存储形态：{ value: 实际值, expiry: 毫秒时间戳 }
   */
  const getLocalStorageWithExpiry = (key: string) => {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return "";
    const item = JSON.parse(itemStr);
    if (item.expiry && Date.now() > item.expiry) {
      localStorage.removeItem(key);
      return "";
    }
    return item.value;
  };

  /**
   * 写入带过期时间的 localStorage
   * expiry 支持：number 时间戳 / Date / 可解析的日期字符串
   */
  const setLocalStorageWithExpiry = (
    key: string,
    value: any,
    expiry: number | string | Date
  ) => {
    let expiryTimestamp: number;
    if (typeof expiry === "number") {
      expiryTimestamp = expiry;
    } else if (expiry instanceof Date) {
      expiryTimestamp = expiry.getTime();
    } else if (typeof expiry === "string") {
      let date: Date;
      if (expiry.includes("-") && expiry.includes(":")) {
        // "2025-12-31 10:30:00" → 替换空格为 T，便于 Date 解析
        date = new Date(expiry.replace(" ", "T"));
      } else if (expiry.includes("/")) {
        date = new Date(expiry);
      } else {
        date = new Date(expiry);
      }
      if (!isNaN(date.getTime())) {
        expiryTimestamp = date.getTime();
      } else {
        throw new Error(`无效的日期格式: ${expiry}`);
      }
    } else {
      throw new Error("不支持的过期时间格式");
    }

    const item = {
      value: value,
      expiry: expiryTimestamp,
    };
    localStorage.setItem(key, JSON.stringify(item));
  };

  /** 判断某 key 是否不存在或已过期 */
  const isLocalStorageExpired = (key: string) => {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return true;
    const item = JSON.parse(itemStr);
    const now = new Date().getTime();
    return now > item.expiry;
  };

  /**
   * 清理所有已过期的 localStorage 项
   * 可用于进入登录页时做一次本地卫生清理
   */
  const cleanupExpiredLocalStorage = () => {
    let cleanedCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key: any = localStorage.key(i);
      if (isLocalStorageExpired(key)) {
        localStorage.removeItem(key);
        cleanedCount++;
        i--; // 删除后索引左移，回退一位继续扫
      }
    }
    return cleanedCount;
  };

  /**
   * 密钥协商
   *
   * 流程：
   * 1. 浏览器生成 RSA 公钥/私钥
   * 2. 把 frontendId + pubKey 发给后端（或本地 Mock）
   * 3. 拿回 eDek、eSignKey
   * 4. 用私钥解密，得到 DEK、signKey 并写入 keyManager
   */
  const fetchSecurityParam = (frontendId: any) => {
    return new Promise<void>((resolve, reject) => {
      generateKeysNative().then((keyData) => {
        const { publicKey, privateKey } = keyData as any;
        genSecurityParam({
          frontendId,
          pubKey: publicKey,
        })
          .then((res) => {
            const {
              data: { eDek, eSignKey },
              code,
              msg,
            } = res as any;

            
            // 业务失败：提示后结束（保持与原项目 resolve 行为一致）
            if (code !== SUCCESS_CODE) {
              ElMessage.error(msg);
              resolve();
              return;
            }

            // 解密成功后，内存中已有 DEK / signKey
            decryptWithNative(eDek, eSignKey, privateKey).then(() => {
              resolve();
            });
          })
          .catch((error) => {
            reject(error);
          });
      });
    });
  };

  /**
   * 获取 frontendId
   *
   * @param isUpdate true 时强制重新向服务端申请（并先缓存旧 DEK）
   *
   * 分支：
   * - 强制更新 / 已过期：重新 genFrontendId，写入 localStorage
   * - 未过期：直接复用本地 frontendId
   * - 本地没有：视为首次，走申请
   */
  const fetchFrontendId = (isUpdate?: Boolean) => {
    return new Promise((resolve, reject) => {
      /** 真正发请求拿新 frontendId */
      const initFrontend = () => {
        genFrontendId()
          .then((res: any) => {
            const {
              data: { frontendId, expireTime },
            } = res;
            if (frontendId) {
              // expireTime 为毫秒时间戳，与后端返回对齐
              setLocalStorageWithExpiry("frontendId", frontendId, expireTime);
              resolve(frontendId);
            }
          })
          .catch((error) => {
            reject(error);
          });
      };
      // 检查本地frontendId是否过期
      const isExpired = isLocalStorageExpired("frontendId");
      /**
       * 需要强制刷新（先存旧 DEK，方便后续“旧密文 → 新 DEK”过渡） 
       * 或
       * 已过期，重新获取frontendId
       */
      if (isUpdate || isExpired) {
        keyManager.setCacheDek();
        initFrontend();
      }else {
        // 检查本地frontendId是否存在
        const _frontendId = getLocalStorageWithExpiry("frontendId");
        if (_frontendId) { //存在，直接返回
          resolve(_frontendId);
        } else { //不存在，重新获取frontendId
          initFrontend();
        }
      }
    });
  };

  return {
    getLocalStorageWithExpiry,
    setLocalStorageWithExpiry,
    isLocalStorageExpired,
    cleanupExpiredLocalStorage,
    fetchFrontendId,
    fetchSecurityParam,
  };
};
