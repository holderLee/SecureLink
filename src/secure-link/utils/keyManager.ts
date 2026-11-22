/**
 * 密钥内存管理器（keyManager）
 *
 * 对应技术方案阶段2完成后，前端需要在内存中持有：
 * - DEK：AES-256-GCM 业务数据加解密密钥（Base64 字符串）
 * - signKey：HMAC-SHA256 接口验签密钥
 *
 * 设计要点（与方案一致）：
 * 1. 不落盘、不进 localStorage，只放模块级变量（进程/页面内存）
 * 2. 退出登录、重新协商时应 clear / 重新 setKeys
 * 3. cacheDek：frontendId 过期强制刷新时，先缓存旧 DEK，
 *    用于“已加密的旧请求体先解密，再用新 DEK 重新加密”的衔接场景
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
