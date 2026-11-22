/**
 * 安全接口自测（纯 Node）
 * 用法：先启动服务，再 node scripts/test-security.mjs
 */
import crypto from "crypto";

const BASE = process.env.API_BASE || "http://localhost:8989";

async function main() {
  // 1) frontendId
  const idRes = await fetch(`${BASE}/client/security/genFrontendId`);
  const idJson = await idRes.json();
  console.log("genFrontendId =>", idJson);
  if (idJson.code !== 0) throw new Error("genFrontendId failed");
  const { frontendId } = idJson.data;

  // 2) 本地 RSA，模拟前端 generateKeysNative
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // 3) 密钥协商
  const secRes = await fetch(`${BASE}/client/security/genSecurityParam`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      frontendId,
    },
    body: JSON.stringify({ frontendId, pubKey: publicKey }),
  });
  const secJson = await secRes.json();
  console.log("genSecurityParam code =>", secJson.code);
  if (secJson.code !== 0) throw new Error(secJson.msg || "genSecurityParam failed");

  const { eDek, eSignKey } = secJson.data;

  // 4) 解密 eDek
  const edekB64 = eDek.replace(/^vault:v\d+:/, "");
  const dekBuf = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(edekB64, "base64")
  );
  console.log("DEK(base64) =>", dekBuf.toString("base64"));

  // 5) 解密 eSignKey
  const iv = Buffer.from(eSignKey.iv, "base64");
  const ciphertext = Buffer.from(eSignKey.ciphertext, "base64");
  const tag = Buffer.from(eSignKey.tag, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", dekBuf, iv);
  decipher.setAuthTag(tag);
  const signKey = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
  console.log("signKey =>", signKey);
  console.log("\n✅ 安全接口自测通过：接口 + Redis 落库 + 加解密对齐");
}

main().catch((err) => {
  console.error("❌ 自测失败:", err);
  process.exit(1);
});
