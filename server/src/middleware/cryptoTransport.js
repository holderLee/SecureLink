/**
 * 加解密传输中间件
 * 1. loadDekByFrontendId —— header.frontendId → Redis DEK/signKey
 * 2. decryptRequestBody  —— EncryptDataDto → req.plainBody
 * 响应加密在业务 handler 中调用 aesGcmEncryptPayload。
 */
import { getRedis } from "../db/redis.js";
import {
  INVALID_FRONTEND_ID,
  DECRYPT_FAIL,
  redisKeys,
} from "../constants/security.js";
import { aesGcmDecryptPayload } from "../utils/crypto.js";

/**
 * 读取请求头里的 frontendId（Express 会把 header 名转成小写）
 */
export function readFrontendId(req) {
  return (
    req.headers["frontendid"] ||
    req.headers["frontendId"] ||
    req.body?.frontendId ||
    ""
  );
}

/**
 * 中间件：校验 frontendId，并加载 DEK 到 req.dek
 */
export async function loadDekByFrontendId(req, res, next) {
  try {
    const frontendId = readFrontendId(req);
    if (!frontendId) {
      return res.status(200).json({
        code: INVALID_FRONTEND_ID,
        msg: "Invalid frontend id",
        encrypt: null,
        data: null,
      });
    }

    const redis = getRedis();
    const exists = await redis.exists(redisKeys.frontendId(frontendId));
    if (!exists) {
      return res.status(200).json({
        code: INVALID_FRONTEND_ID,
        msg: "Invalid frontend id",
        encrypt: null,
        data: null,
      });
    }

    const dek = await redis.get(redisKeys.dek(frontendId));
    if (!dek) {
      // frontendId 还在，但密钥过期/未协商
      return res.status(200).json({
        code: INVALID_FRONTEND_ID,
        msg: "DEK expired, please renegotiate security params",
        encrypt: null,
        data: null,
      });
    }

    // 验签阶段也会用到；这里一并取出，避免后面再查一次
    const signKey = await redis.get(redisKeys.signKey(frontendId));

    req.frontendId = frontendId;
    req.dek = dek; // Base64 字符串
    req.signKey = signKey || "";
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * 中间件：解密加密请求体
 * 成功后：req.plainBody = 明文对象
 */
export async function decryptRequestBody(req, res, next) {
  try {
    const body = req.body || {};
    const flagged = body.encrypt === true || body.encrypt === "true";
    if (!flagged) {
      return res.status(200).json({
        code: 400,
        msg: "该接口要求 EncryptDataDto（encrypt=true）",
        encrypt: null,
        data: null,
      });
    }

    req.plainBody = aesGcmDecryptPayload(req.dek, body);
    next();
  } catch (err) {
    console.error("[cryptoTransport] decrypt fail:", err.message);
    return res.status(200).json({
      code: DECRYPT_FAIL,
      msg: "Decrypt fail",
      encrypt: null,
      data: null,
    });
  }
}
