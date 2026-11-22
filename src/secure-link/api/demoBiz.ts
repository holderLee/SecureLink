/**
 * 加密 + 验签 演示 API
 *
 * 对应后端：POST /client/demo/echo
 * - encrypt:true → 拦截器 AES 加密 body / 解密响应
 * - sign:true    → 拦截器附加 HMAC 验签头（param 用加密前明文）
 */
import request from "@/utils/request";

export function demoEcho(data: Record<string, any>) {
  return request({
    url: "/client/demo/echo",
    method: "post",
    data,
    encrypt: true,
    sign: true,
  } as any);
}
