/**
 * 安全链路回归（改加密/验签后按需跑，非业务运行时依赖）
 * 用法：先 npm run dev，再 npm run test:flow
 * 覆盖：协商 → /client/secure/echo 加解密验签 → nonce 防重放
 */
import crypto from "crypto";

const BASE = process.env.API_BASE || "http://localhost:8989";

function aesEncrypt(dekBuf, obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dekBuf, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(obj), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    encrypt: true,
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    aad: "",
  };
}

function aesDecrypt(dekBuf, enc) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    dekBuf,
    Buffer.from(enc.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plain);
}

/** 与前端 generateSignature / 后端 buildSignString 对齐 */
function buildSignHeaders({ plainObj, signKey, lang = "zh-cn", token = "" }) {
  const timestamp = Date.now();
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const param = Buffer.from(JSON.stringify(plainObj), "utf8").toString("base64");
  const params = { lang, nonce, param, timestamp: String(timestamp), token };
  const signString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const sign = crypto
    .createHmac("sha256", Buffer.from(signKey, "utf8"))
    .update(signString, "utf8")
    .digest("hex");
  return { sign, timestamp: String(timestamp), nonce, token, lang };
}

async function aesDecryptSignKey(dekBuf, eSignKey) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    dekBuf,
    Buffer.from(eSignKey.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(eSignKey.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(eSignKey.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

async function main() {
  const idJson = await fetch(`${BASE}/client/security/genFrontendId`).then((r) =>
    r.json()
  );
  const { frontendId } = idJson.data;

  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const secJson = await fetch(`${BASE}/client/security/genSecurityParam`, {
    method: "POST",
    headers: { "Content-Type": "application/json", frontendId },
    body: JSON.stringify({ frontendId, pubKey: publicKey }),
  }).then((r) => r.json());

  const dekBuf = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(String(secJson.data.eDek).replace(/^vault:v\d+:/, ""), "base64")
  );
  const signKey = await aesDecryptSignKey(dekBuf, secJson.data.eSignKey);

  const plain = { password: "123456", from: "test-script" };
  const reqBody = aesEncrypt(dekBuf, plain);
  const signHeaders = buildSignHeaders({ plainObj: plain, signKey });

  const echoJson = await fetch(`${BASE}/client/secure/echo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      frontendId,
      ...signHeaders,
    },
    body: JSON.stringify(reqBody),
  }).then((r) => r.json());

  console.log("echo code =>", echoJson.code, "encrypt =>", echoJson.encrypt);
  if (echoJson.code !== 0 || !echoJson.encrypt) {
    throw new Error(JSON.stringify(echoJson));
  }

  const decrypted = aesDecrypt(dekBuf, echoJson.data);
  console.log("decrypted response =>", decrypted);
  if (!decrypted.signed) {
    throw new Error("响应缺少 signed=true，验签链路可能未挂上");
  }

  // 同 nonce 重放应失败
  const replay = await fetch(`${BASE}/client/secure/echo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      frontendId,
      ...signHeaders,
    },
    body: JSON.stringify(aesEncrypt(dekBuf, plain)),
  }).then((r) => r.json());
  console.log("replay code =>", replay.code, "msg =>", replay.msg);
  if (replay.code === 0) {
    throw new Error("nonce 防重放未生效");
  }

  console.log("\n✅ 加解密 + HMAC 验签流程自测通过");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
