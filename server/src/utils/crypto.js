/**
 * 服务端密码学工具（Node.js 内置 crypto）
 *
 * 对应前端 WebCrypto：
 * - RSA-OAEP + SHA-256：用前端公钥加密 DEK → eDek
 * - AES-256-GCM：用 DEK 加密 signKey → eSignKey
 * - HMAC-SHA256：接口验签
 *
 * 说明：当前 DEK/signKey 在进程内生成；接入 Vault/KMS 后替换生成侧即可，传输格式不变。
 */
import crypto from "crypto";

/** 生成 32 字节随机密钥材料 */
export function randomBytes32() {
  return crypto.randomBytes(32);
}

/**
 * 用前端 RSA 公钥（PEM）加密 DEK
 * @returns {string} Base64 密文
 */
export function rsaEncryptDek(publicKeyPem, dekBuffer) {
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    dekBuffer
  );
  return encrypted.toString("base64");
}

/**
 * 用 DEK 对 signKey 文本做 AES-256-GCM 加密
 * @returns {{ ciphertext: string, iv: string, tag: string, aad: string }}
 */
export function aesGcmEncryptSignKey(dekBuffer, signKeyText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dekBuffer, iv);
  const ciphertext = Buffer.concat([
    cipher.update(signKeyText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    aad: "",
  };
}

export function dekToBase64(dekBuffer) {
  return dekBuffer.toString("base64");
}

/** 业务数据加密（响应体） */
export function aesGcmEncryptPayload(dekBase64, plainObj) {
  const dekBuffer = Buffer.from(dekBase64, "base64");
  const iv = crypto.randomBytes(12);
  const plainText =
    typeof plainObj === "string" ? plainObj : JSON.stringify(plainObj);

  const cipher = crypto.createCipheriv("aes-256-gcm", dekBuffer, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    aad: "",
  };
}

/** 业务数据解密（请求体 EncryptDataDto） */
export function aesGcmDecryptPayload(dekBase64, enc) {
  if (!enc?.ciphertext || !enc?.iv || !enc?.tag) {
    throw new Error("EncryptDataDto 缺少 ciphertext/iv/tag");
  }

  const dekBuffer = Buffer.from(dekBase64, "base64");
  const iv = Buffer.from(enc.iv, "base64");
  const ciphertext = Buffer.from(enc.ciphertext, "base64");
  const tag = Buffer.from(enc.tag, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", dekBuffer, iv);
  decipher.setAuthTag(tag);

  if (enc.aad) {
    decipher.setAAD(Buffer.from(String(enc.aad), "utf8"));
  }

  const plain = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plain);
}

/** HMAC-SHA256 → 小写十六进制（signKey 按 UTF-8 文本使用，勿二次 Base64 解码） */
export function hmacSha256Hex(signKeyText, message) {
  return crypto
    .createHmac("sha256", Buffer.from(String(signKeyText), "utf8"))
    .update(String(message), "utf8")
    .digest("hex");
}

/**
 * 拼签名字符串：null→""，键名升序，key=value&...
 * 与前端 generateSignature 一致（不对 value 做 URLEncoder）
 */
export function buildSignString(params) {
  const keys = Object.keys(params || {}).sort();
  return keys
    .map((k) => {
      const v = params[k];
      return `${k}=${v == null ? "" : v}`;
    })
    .join("&");
}

export function utf8ToBase64(raw) {
  return Buffer.from(String(raw), "utf8").toString("base64");
}

export function safeEqualString(a, b) {
  const bufA = Buffer.from(String(a || ""), "utf8");
  const bufB = Buffer.from(String(b || ""), "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
