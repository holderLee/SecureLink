/**
 * SecureLink 前端密码学能力（基于 Web Crypto API）
 *
 * 覆盖技术方案中的三类算法：
 * 1) RSA-OAEP-2048：仅用于密钥交换（解密后端/Vault 返回的 EDEK → DEK）
 * 2) AES-256-GCM：业务数据加解密；以及解密 eSignKey → signKey
 * 3) HMAC-SHA256：接口验签，产出十六进制 sign 放到请求头
 *
 * 依赖：浏览器原生 crypto.subtle（HTTPS 或 localhost）
 */
import { keyManager } from "@/secure-link/utils/keyManager";

/**
 * PEM 私钥文本 → ArrayBuffer
 * 去掉 BEGIN/END 头尾与换行后，再 Base64 解码
 * 注意：当前实现面向 PRIVATE KEY（PKCS8）场景
 */
const pemToArrayBuffer = (pem: any) => {
  const b64 = pem.replace(/-----\w+ PRIVATE KEY-----|\n/g, "");
  const binary = atob(b64);
  const len = binary.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
};

/** Base64 字符串 → ArrayBuffer */
const base64ToArrayBuffer = (b64: any) => {
  const binary = atob(b64);
  const len = binary.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
};

/** ArrayBuffer → 小写十六进制（HMAC 签名输出格式） */
const bufferToHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/** ArrayBuffer → Base64（密文/iv/tag/DEK 传输常用编码） */
const arrayBufferToBase64 = (buf: ArrayBuffer) => {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

/**
 * 将业务参数规范成字符串后做 Base64（UTF-8）
 *
 * 验签规则：param 最终要 Base64.encode(业务参数, UTF-8)
 * 这里兼容几种入参形态：
 * - JSON 字符串
 * - URL 查询串 a=1&b=2
 * - 单个 a=1
 * - 其他纯文本（包一层 { value }）
 */
export const jsonToBase64 = (input: string): string => {
  try {
    let normalized = input.trim();
    if (
      (normalized.startsWith("{") && normalized.endsWith("}")) ||
      (normalized.startsWith("[") && normalized.endsWith("]"))
    ) {
      // 先校验是否为合法 JSON，合法则保持原串参与编码
      JSON.parse(normalized);
    } else if (normalized.includes("=") && normalized.includes("&")) {
      // 查询串 → 对象 → JSON 字符串，保证编码前形态稳定
      const params = new URLSearchParams(normalized);
      const obj: Record<string, string> = {};
      params.forEach((v, k) => (obj[k] = v));
      normalized = JSON.stringify(obj);
    } else if (normalized.includes("=")) {
      const [k, v] = normalized.split("=");
      normalized = JSON.stringify({ [k]: v });
    } else {
      normalized = JSON.stringify({ value: normalized });
    }

    // 必须按 UTF-8 字节编码，再转 Base64（与方案一致）
    const uint8Array = new TextEncoder().encode(normalized);
    const base64 = arrayBufferToBase64(uint8Array);
    return base64;
  } catch (err) {
    console.error("❌ JSON 转 Base64 失败:", err);
    return "";
  }
};

/**
 * 文件内容 SHA-256（Base64）
 * 上传场景验签时，不能直接把 File 拼进签名串，改为文件哈希
 */
async function getFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  return hashBase64;
}

/* ======================== 密钥协商 ======================== */

/**
 * 本地生成 RSA-2048 密钥对（RSA-OAEP + SHA-256）
 *
 * - publicKey（PEM）：上传给后端/Vault，用于加密 DEK → EDEK
 * - privateKey（PEM）：只留在前端内存，用于解密 EDEK → DEK
 * - 私钥绝不持久化到 localStorage
 */
export const generateKeysNative = async () => {
  try {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
        hash: "SHA-256",
      },
      true, // 可导出，便于转成 PEM 上传/持有
      ["encrypt", "decrypt"]
    );

    // SPKI / PKCS8 是 WebCrypto 导出公钥/私钥的标准格式
    const pubBuf = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const prvBuf = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    // 转成后端约定的 PEM 文本
    const pubPem =
      "-----BEGIN PUBLIC KEY-----\n" +
      btoa(String.fromCharCode(...new Uint8Array(pubBuf))) +
      "\n-----END PUBLIC KEY-----";
    const prvPem =
      "-----BEGIN PRIVATE KEY-----\n" +
      btoa(String.fromCharCode(...new Uint8Array(prvBuf))) +
      "\n-----END PRIVATE KEY-----";
    return { publicKey: pubPem, privateKey: prvPem };
  } catch (error) {
    console.log(error);
  }
};

/**
 * 密钥协商结果落地：解密得到 DEK + signKey，并写入 keyManager
 *
 * 输入：
 * - eDek：Vault/后端用前端公钥加密后的 DEK（可能带 vault:v1: 前缀）
 * - eSignObj：用 DEK 做 AES-GCM 加密后的 signKey（含 iv/ciphertext/tag）
 * - privateKeyPem：本地点过 generateKeysNative 得到的私钥
 *
 * 步骤：
 * 1. RSA-OAEP 解密 eDek → DEK 原始字节
 * 2. 用 DEK 做 AES-GCM 解密 eSignKey → signKey 明文
 * 3. DEK 转 Base64 后与 signKey 一并放入内存
 */
export const decryptWithNative = async (
  eDek: any,
  eSignObj: any,
  privateKeyPem: any
) => {
  try {
    // a. 导入 PKCS8 私钥
    const prvKeyBuf = pemToArrayBuffer(privateKeyPem);
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      prvKeyBuf,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"]
    );

    // Vault 常见前缀 vault:v1:xxx，前端解密前先剥掉
    const base64Edek = eDek.replace(/^vault:v\d+:/, "").replace(/\s/g, "");
    const edekBuf = base64ToArrayBuffer(base64Edek);

    // b. RSA 解密拿到 DEK 原始 key material
    const dekBuf = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      edekBuf
    );

    // c. 把 DEK 导入为 AES-GCM CryptoKey
    const aesKey = await crypto.subtle.importKey(
      "raw",
      dekBuf,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // d. AES-GCM 解密 eSignKey
    // 注意：接口把 ciphertext 与 tag 分开传；WebCrypto 要求 cipher||tag 拼在一起
    const ivBuf = base64ToArrayBuffer(eSignObj.iv);
    const cipherBuf = base64ToArrayBuffer(eSignObj.ciphertext);
    const tagBuf = base64ToArrayBuffer(eSignObj.tag);

    const fullCipher = new Uint8Array(cipherBuf.byteLength + tagBuf.byteLength);
    fullCipher.set(new Uint8Array(cipherBuf), 0);
    fullCipher.set(new Uint8Array(tagBuf), cipherBuf.byteLength);

    // 解密得到明文
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuf },
      aesKey,
      fullCipher
    );

    // DEK 后续加解密都以 Base64 字符串在内存中传递（与原项目一致）
    const _dek = arrayBufferToBase64(dekBuf);
    const _signKey = new TextDecoder().decode(plainBuf);

    keyManager.setKeys(_dek, _signKey);
    return {
      dek: _dek,
      signKey: _signKey,
    };
  } catch (error) {
    console.log(error);
  }
};

/* ======================== 业务数据加解密 ======================== */

/**
 * 用 DEK 加密业务明文对象 → EncryptDataDto 字段
 *
 * 输出字段对应方案：
 * - ciphertext / iv / tag：均为 Base64
 * - encrypt: true：标记该 body 已加密
 *
 * 说明：
 * - iv 每次随机 12 字节（96-bit），满足 GCM 推荐
 * - WebCrypto encrypt 结果 = ciphertext || tag(16字节)，这里拆开以便与后端 DTO 对齐
 */
export const encryptDataWithDEK = async (plainObj: any, _dek: String) => {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBuf = encoder.encode(JSON.stringify(plainObj));
  const dek = base64ToArrayBuffer(_dek);

  const key = await crypto.subtle.importKey(
    "raw",
    dek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plainBuf
  );

  const cipher = new Uint8Array(cipherBuf);
  const tagLength = 16; // GCM tag 默认 128-bit
  const ciphertext = cipher.slice(0, cipher.length - tagLength);
  const tag = cipher.slice(cipher.length - tagLength);

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
    tag: arrayBufferToBase64(tag),
    encrypt: true,
  };
};

/**
 * 用 DEK 解密响应中的 EncryptDataDto.data
 *
 * @param enc 含 iv / ciphertext / tag（Base64）
 * @param _dek 实际运行中多为 Base64 字符串（沿用原项目入参习惯）
 * @returns UTF-8 明文 JSON 字符串，调用方自行 JSON.parse
 */
export const decryptDataWithDEK = async (
  enc: any,
  _dek: ArrayBuffer
): Promise<string> => {
  const dek = base64ToArrayBuffer(_dek);
  const key = await crypto.subtle.importKey(
    "raw",
    dek,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const iv = base64ToArrayBuffer(enc.iv);
  const ciphertext = base64ToArrayBuffer(enc.ciphertext);
  const tag = base64ToArrayBuffer(enc.tag);

  // 同样需要 cipher||tag 再交给 WebCrypto
  const fullCipher = new Uint8Array(ciphertext.byteLength + tag.byteLength);
  fullCipher.set(new Uint8Array(ciphertext), 0);
  fullCipher.set(new Uint8Array(tag), ciphertext.byteLength);

  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    fullCipher
  );

  return new TextDecoder().decode(plainBuf);
};

/* ======================== 接口验签 ======================== */

/**
 * 生成请求签名 sign（HMAC-SHA256 → hex）
 *
 * 约定流程（与方案一致）：
 * 1. 准备参数：token / nonce / timestamp / lang / param（null 当 ""）
 * 2. param 已是 Base64 后的业务参数
 * 3. 按参数名升序排序，拼 key=value&key=value
 * 4. 用 signKey 做 HMAC-SHA256，输出小写十六进制
 *
 * 注意：当前排序拼接仍使用入参 params（与原 bycard 实现保持一致）；
 * File 场景会先算哈希到 processedParams，后续若要完全生效需与排序源对齐。
 */
export const generateSignature = async (
  params: Record<string, any>,
  signKey: string
): Promise<string> => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signKey);

  // 1) 导入 HMAC 密钥
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // 2) File → 内容哈希，避免二进制直接进签名串
  const processedParams: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value instanceof File) {
      const hash = await getFileHash(value);
      processedParams[key] = hash;
    } else {
      processedParams[key] = value;
    }
  }

  // 3) 参数名升序 + 拼接（保持与原项目一致）
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  // 4) HMAC 计算，转为 hex 放入请求头 sign
  const data = encoder.encode(sorted);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);

  return bufferToHex(signature);
};

/**
 * 导出编解码小工具给 mock 层复用，避免重复实现 Base64 转换
 */
export const secureCryptoHelpers = {
  arrayBufferToBase64,
  base64ToArrayBuffer,
};
