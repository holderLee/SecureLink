/**
 * 安全业务服务
 * - 生成 frontendId（Redis TTL）
 * - 密钥协商：生成 DEK/signKey，密文回前端，明文仅存 Redis
 */
import { randomUUID } from "crypto";
import { getRedis } from "../db/redis.js";
import {
  FRONTEND_ID_TTL_SECONDS,
  SECURITY_KEY_TTL_SECONDS,
  INVALID_FRONTEND_ID,
  REQUEST_KMS_FAIL,
  redisKeys,
} from "../constants/security.js";
import {
  randomBytes32,
  rsaEncryptDek,
  aesGcmEncryptSignKey,
  dekToBase64,
} from "../utils/crypto.js";

/**
 * 自定义业务错误，路由层转成统一 JSON
 */
export class SecurityError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.status = 200; // 业务错误仍 HTTP 200，用 body.code 区分（与原项目习惯接近）
  }
}

/** 生成 frontendId 并写入 Redis */
export async function createFrontendId() {
  const redis = getRedis();
  // 去掉横线，贴近原项目/前端 mock 形态
  const frontendId = randomUUID().replace(/-/g, "");
  const expireTime = Date.now() + FRONTEND_ID_TTL_SECONDS * 1000;

  await redis.setex(
    redisKeys.frontendId(frontendId),
    FRONTEND_ID_TTL_SECONDS,
    JSON.stringify({ createdAt: Date.now() })
  );

  return { frontendId, expireTime };
}

/**
 * 确认 frontendId 仍在 Redis 且未过期
 */
export async function assertFrontendIdExists(frontendId) {
  if (!frontendId) {
    throw new SecurityError(INVALID_FRONTEND_ID, "Invalid frontend id");
  }
  const redis = getRedis();
  const exists = await redis.exists(redisKeys.frontendId(frontendId));
  if (!exists) {
    throw new SecurityError(INVALID_FRONTEND_ID, "Invalid frontend id");
  }
}

/**
 * 密钥协商
 * 当前在本进程生成 DEK/signKey；接入 Vault 后替换生成逻辑，接口字段保持不变。
 */
export async function createSecurityParam({ frontendId, pubKey }) {
  await assertFrontendIdExists(frontendId);

  if (!pubKey || typeof pubKey !== "string" || !pubKey.includes("PUBLIC KEY")) {
    throw new SecurityError(REQUEST_KMS_FAIL, "pubKey 无效，需要 PEM 公钥");
  }

  try {
    const redis = getRedis();

    // --- 生成密钥材料 ---
    const dekBuffer = randomBytes32();
    const signKey = randomBytes32().toString("base64"); // 与前端 mock 一致：Base64 文本
    const dekBase64 = dekToBase64(dekBuffer);

    // --- 加密给前端 ---
    const eDekBase64 = rsaEncryptDek(pubKey, dekBuffer);
    const eDek = `vault:v1:${eDekBase64}`;
    const eSignKey = aesGcmEncryptSignKey(dekBuffer, signKey);

    // --- 明文只存服务端 Redis ---
    await redis.setex(
      redisKeys.dek(frontendId),
      SECURITY_KEY_TTL_SECONDS,
      dekBase64
    );
    await redis.setex(
      redisKeys.signKey(frontendId),
      SECURITY_KEY_TTL_SECONDS,
      signKey
    );

    // 可选：刷新 frontendId 的 TTL，避免密钥还在但身份先过期
    await redis.expire(
      redisKeys.frontendId(frontendId),
      FRONTEND_ID_TTL_SECONDS
    );

    return { eDek, eSignKey };
  } catch (err) {
    // RSA 公钥格式错误等都会进这里
    if (err instanceof SecurityError) throw err;
    console.error("[security] createSecurityParam failed:", err);
    throw new SecurityError(REQUEST_KMS_FAIL, "request kms fail");
  }
}
