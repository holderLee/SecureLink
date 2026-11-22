/**
 * 加密传输探测 API
 * POST /client/secure/echo
 * - encrypt:true → AES 加密请求 / 解密响应
 * - sign:true    → HMAC 验签头（param 取加密前明文）
 */
import request from "@/utils/request";

export function secureEcho(data: Record<string, any>) {
  return request({
    url: "/client/secure/echo",
    method: "post",
    data,
    encrypt: true,
    sign: true,
  } as any);
}
