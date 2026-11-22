/**
 * SecureLink 安全相关 HTTP 接口封装
 *
 * 两个核心接口对应技术方案阶段1 / 阶段2：
 * 1. genFrontendId —— 申请前端身份标识
 * 2. genSecurityParam —— 上传 RSA 公钥，换取加密后的 DEK / signKey
 *
 * SECURE_LINK_MOCK=true 时走本地模拟，方便前端单独联调，不依赖真实后端。
 */
import request from "@/utils/request";
import { SECURE_LINK_MOCK } from "@/secure-link/constants";
import {
  mockGenFrontendId,
  mockGenSecurityParam,
} from "@/secure-link/api/mockSecurity";

/**
 * 阶段1：获取 frontendId
 *
 * 原项目路径：GET /client/security/genFrontendId
 * 成功响应关键字段：
 * - data.frontendId
 * - data.expireTime（毫秒时间戳）
 */
export function genFrontendId() {
  if (SECURE_LINK_MOCK) {
    // 本地模拟：立刻返回假数据，不发网络请求
    return Promise.resolve(mockGenFrontendId());
  }
  return request({
    url: "/client/security/genFrontendId",
    method: "get",
  });
}

/**
 * 阶段2：密钥协商
 *
 * 原项目路径：POST /client/security/genSecurityParam
 * 请求体：
 * - frontendId：阶段1拿到的身份
 * - pubKey：前端本地生成的 RSA 公钥 PEM
 *
 * 成功响应关键字段：
 * - data.eDek：RSA 加密后的 DEK（可能带 vault:v1: 前缀）
 * - data.eSignKey：AES-GCM 加密后的 signKey（含 iv/ciphertext/tag）
 */
export function genSecurityParam(data: { frontendId: any; pubKey: any }) {
  if (SECURE_LINK_MOCK) {
    // 本地模拟 Vault：在浏览器内用 pubKey 加密 DEK，再加密 signKey
    return mockGenSecurityParam(data);
  }
  return request({
    url: "/client/security/genSecurityParam",
    method: "post",
    data,
  });
}
