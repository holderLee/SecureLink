/**
 * 安全相关 HTTP 接口
 * - genFrontendId：申请前端身份
 * - genSecurityParam：上传 RSA 公钥，换取 eDek / eSignKey
 *
 * SECURE_LINK_MOCK=true 时走本地 Mock，不请求后端。
 */
import request from "@/utils/request";
import { SECURE_LINK_MOCK } from "@/secure-link/constants";
import {
  mockGenFrontendId,
  mockGenSecurityParam,
} from "@/secure-link/api/mockSecurity";

export function genFrontendId() {
  if (SECURE_LINK_MOCK) {
    return Promise.resolve(mockGenFrontendId());
  }
  return request({
    url: "/client/security/genFrontendId",
    method: "get",
  });
}

export function genSecurityParam(data: { frontendId: any; pubKey: any }) {
  if (SECURE_LINK_MOCK) {
    return mockGenSecurityParam(data);
  }
  return request({
    url: "/client/security/genSecurityParam",
    method: "post",
    data,
  });
}
