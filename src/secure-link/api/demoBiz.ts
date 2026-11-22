/**
 * 加密通信演示 API
 *
 * 对应后端：POST /client/demo/echo
 * - 请求体：由 axios 拦截器按 encrypt:true 自动加密
 * - 响应体：由 axios 拦截器按 encrypt:true 自动解密
 */
import request from "@/utils/request";

export function demoEcho(data: Record<string, any>) {
  return request({
    url: "/client/demo/echo",
    method: "post",
    data,
    // 关键：打开后请求拦截器会 AES 加密 body
    encrypt: true,
  } as any);
}
