/**
 * 本地 Mock 安全接口（VITE_SECURE_LINK_MOCK=true 时启用）
 * 仅用于无后端时的本地开发，生产环境必须关闭。
 */
import { SUCCESS_CODE } from "@/secure-link/constants";
import { secureCryptoHelpers } from "@/secure-link/utils/webCrypto";

const { arrayBufferToBase64 } = secureCryptoHelpers;

/**
 * PEM 公钥 → ArrayBuffer（SPKI）
 * 与私钥解析不同，这里专门处理 PUBLIC KEY 头尾
 */
const pemPublicToArrayBuffer = (pem: string) => {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
};

/**
 * 模拟 genSecurityParam / Vault 行为
 *
 * 真实链路：后端把 pubKey 交给 Vault → Vault 生成 DEK 并用公钥加密
 * 这里在浏览器内完成同样的密码学步骤，保证前端 decryptWithNative 能解开
 */
export async function mockGenSecurityParam(data: {
  frontendId: string;
  pubKey: string;
}) {
  // 1) 生成 32 字节 DEK（AES-256）与 32 字节 signKey 原材料
  const dekBytes = crypto.getRandomValues(new Uint8Array(32));
  const signKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  // 与前端持有格式对齐：signKey 以 Base64 文本形式存在，再被 AES 加密传输
  const signKey = arrayBufferToBase64(signKeyBytes.buffer);

  // 2) 导入前端上传的 RSA 公钥
  const pubKey = await crypto.subtle.importKey(
    "spki",
    pemPublicToArrayBuffer(data.pubKey),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );

  // 3) 公钥加密 DEK → eDek（附加 vault:v1: 前缀，贴近真实返回）
  const edekBuf = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    pubKey,
    dekBytes
  );
  const eDek = `vault:v1:${arrayBufferToBase64(edekBuf)}`;

  // 4) 用 DEK 对 signKey 做 AES-GCM，得到 eSignKey
  const aesKey = await crypto.subtle.importKey(
    "raw",
    dekBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(signKey);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    plain
  );

  // WebCrypto 输出 cipher||tag，拆开成 DTO 字段
  const cipher = new Uint8Array(cipherBuf);
  const tagLength = 16;
  const ciphertext = cipher.slice(0, cipher.length - tagLength);
  const tag = cipher.slice(cipher.length - tagLength);

  // Uint8Array.buffer 可能是更大底层缓冲，按 byteOffset/byteLength 精确切片再转 Base64
  const u8ToB64 = (u8: Uint8Array) =>
    arrayBufferToBase64(
      u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
    );

  // frontendId 参数目前仅占位，真实后端会用它关联 Redis；Mock 不落库
  void data.frontendId;

  return {
    code: SUCCESS_CODE,
    msg: "success",
    encrypt: null,
    data: {
      eDek,
      eSignKey: {
        ciphertext: u8ToB64(ciphertext),
        iv: u8ToB64(iv),
        tag: u8ToB64(tag),
        aad: "",
      },
    },
  };
}

/**
 * 模拟 genFrontendId
 * 返回无横线 UUID + 7 天有效期，结构对齐真实响应
 */
export function mockGenFrontendId() {
  const frontendId = crypto.randomUUID().replace(/-/g, "");
  const expireTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return {
    code: SUCCESS_CODE,
    msg: "success",
    encrypt: null,
    data: {
      frontendId,
      expireTime,
    },
  };
}
