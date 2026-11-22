/**
 * 接口验签中间件
 * header: sign / nonce / timestamp / lang / token
 * 校验：时间窗 → HMAC → Redis nonce 防重放
 * 加密接口建议顺序：loadDek → decrypt → verifySign → handler
 */
import { getRedis } from "../db/redis.js";
import {
  INVALID_FRONTEND_ID,
  INVALID_SIGNATURE,
  TIMESTAMP_SKEW_MS,
  NONCE_TTL_SECONDS,
  redisKeys,
} from "../constants/security.js";
import {
  buildSignString,
  hmacSha256Hex,
  utf8ToBase64,
  safeEqualString,
} from "../utils/crypto.js";
import { readFrontendId } from "./cryptoTransport.js";

/**
 * 读取验签相关请求头（Express 会把 header 名转成小写）
 */
function readSignHeaders(req) {
  const h = req.headers || {};
  return {
    sign: h.sign || "",
    nonce: h.nonce || "",
    timestamp: h.timestamp || "",
    lang: h.lang || "",
    // 验签用 token 头；与 Authorization 解耦
    token: h.token || "",
  };
}

/**
 * 重建参与签名的 param（Base64）
 * 加密接口：使用解密后的 req.plainBody（加密前明文）
 * 普通 POST：JSON.stringify(req.body)
 * GET：query 拼成 a=1&b=2
 */
function rebuildParamBase64(req) {
  if (req.plainBody != null) {
    // 与前端「加密前 JSON.stringify(plain)」对齐
    return utf8ToBase64(JSON.stringify(req.plainBody));
  }

  const method = String(req.method || "GET").toUpperCase();
  if (method === "GET") {
    const q = req.query || {};
    const qs = Object.keys(q)
      .map((k) => `${k}=${q[k] == null ? "" : q[k]}`)
      .join("&");
    return qs ? utf8ToBase64(qs) : "";
  }

  const body = req.body;
  if (body == null || (typeof body === "object" && !Object.keys(body).length)) {
    return "";
  }
  if (typeof body === "string") {
    return body ? utf8ToBase64(body) : "";
  }
  return utf8ToBase64(JSON.stringify(body));
}

/**
 * 中间件：校验 HMAC 签名 + nonce 防重放
 */
export async function verifyRequestSignature(req, res, next) {
  try {
    const frontendId = req.frontendId || readFrontendId(req);
    const { sign, nonce, timestamp, lang, token } = readSignHeaders(req);

    if (!frontendId) {
      return res.status(200).json({
        code: INVALID_FRONTEND_ID,
        msg: "Invalid frontend id",
        encrypt: null,
        data: null,
      });
    }

    if (!sign || !nonce || !timestamp) {
      return res.status(200).json({
        code: INVALID_SIGNATURE,
        msg: "Missing sign headers (sign/nonce/timestamp)",
        encrypt: null,
        data: null,
      });
    }

    // —— 时间窗 ——
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
      return res.status(200).json({
        code: INVALID_SIGNATURE,
        msg: "Invalid timestamp",
        encrypt: null,
        data: null,
      });
    }
    const skew = Math.abs(Date.now() - ts);
    if (skew > TIMESTAMP_SKEW_MS) {
      return res.status(200).json({
        code: INVALID_SIGNATURE,
        msg: "Timestamp expired",
        encrypt: null,
        data: null,
      });
    }

    // —— 取 signKey ——
    const redis = getRedis();
    const signKey =
      req.signKey || (await redis.get(redisKeys.signKey(frontendId)));
    if (!signKey) {
      return res.status(200).json({
        code: INVALID_FRONTEND_ID,
        msg: "signKey expired, please renegotiate security params",
        encrypt: null,
        data: null,
      });
    }
    req.signKey = signKey;

    // —— 重建签名串并比对 ——
    const param = rebuildParamBase64(req);
    const signParams = {
      lang: lang == null ? "" : String(lang),
      nonce: String(nonce),
      param,
      timestamp: String(ts), // 与前端模板字符串一致：数字也会变成十进制文本
      token: token == null ? "" : String(token),
    };
    const signString = buildSignString(signParams);
    const expected = hmacSha256Hex(signKey, signString);

    if (!safeEqualString(expected, String(sign).toLowerCase())) {
      console.warn("[verifySign] mismatch", {
        frontendId,
        signStringPreview: signString.slice(0, 80) + "...",
      });
      return res.status(200).json({
        code: INVALID_SIGNATURE,
        msg: "Invalid signature",
        encrypt: null,
        data: null,
      });
    }

    // —— nonce 防重放：SET key NX EX ——
    const nonceKey = redisKeys.nonce(frontendId, nonce);
    const setOk = await redis.set(nonceKey, "1", "EX", NONCE_TTL_SECONDS, "NX");
    if (setOk !== "OK") {
      return res.status(200).json({
        code: INVALID_SIGNATURE,
        msg: "Replay detected (nonce used)",
        encrypt: null,
        data: null,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}
