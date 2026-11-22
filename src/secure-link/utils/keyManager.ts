/**
 * 密钥内存管理器（keyManager）
 * - DEK：AES-256-GCM（Base64，仅内存）
 * - signKey：HMAC-SHA256（仅内存）
 * - cacheDek：密钥轮换时暂存旧 DEK，用于旧密文重加密
 */

/** 当前生效的数据加密密钥 DEK（Base64） */
let dek: any = null;

/** 当前生效的签名密钥 signKey */
let signKey: any = null;

/** 刷新密钥前缓存的旧 DEK，供请求重试时解密旧密文 */
let cacheDek: any = null;

export const keyManager = {
  /**
   * 写入协商得到的 DEK / signKey
   * 一般在 decryptWithNative 成功后调用
   */
  setKeys: (newDek: String, newSignKey: String) => {
    dek = newDek;
    signKey = newSignKey;
  },

  /**
   * 缓存当前 DEK
   * 典型时机：即将重新拉取 frontendId / 重新协商密钥之前
   */
  setCacheDek: () => {
    if (dek) {
      // 深拷贝，避免后续 dek 被覆盖后 cache 跟着变
      cacheDek = JSON.parse(JSON.stringify(dek));
    } else {
      cacheDek = null;
    }
  },

  /** 读取当前 DEK（业务请求加密 / 响应解密用） */
  getDek: () => dek,

  /** 读取缓存的旧 DEK（密钥轮换过渡用） */
  getCacheDek: () => cacheDek,

  /** 读取当前 signKey（生成请求签名用） */
  getSignKey: () => signKey,

  /**
   * 清空内存密钥
   * 应对：用户退出、跳回登录页、需要重新初始化身份时
   */
  clear: () => {
    dek = null;
    signKey = null;
  },
};
