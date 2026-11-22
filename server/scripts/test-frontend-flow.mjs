/**
 * 模拟前端阶段1+2（不走浏览器）
 * 验证：代理前的直连后端 + RSA/AES 解密与前端算法一致
 */
import crypto from "crypto";

const BASE = process.env.API_BASE || "http://localhost:8989";

async function main() {
  console.log("1) 请求 genFrontendId ...");
  const idJson = await fetch(`${BASE}/client/security/genFrontendId`).then((r) =>
    r.json()
  );
  if (idJson.code !== 0) throw new Error(JSON.stringify(idJson));
  const { frontendId, expireTime } = idJson.data;
  console.log("   frontendId =", frontendId);
  console.log("   expireTime =", expireTime);

  console.log("2) 本地生成 RSA 密钥对（模拟前端 WebCrypto）...");
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  console.log("3) 请求 genSecurityParam ...");
  const secJson = await fetch(`${BASE}/client/security/genSecurityParam`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      frontendId,
    },
    body: JSON.stringify({ frontendId, pubKey: publicKey }),
  }).then((r) => r.json());
  if (secJson.code !== 0) throw new Error(JSON.stringify(secJson));

  const { eDek, eSignKey } = secJson.data;
  const dekBuf = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(String(eDek).replace(/^vault:v\d+:/, ""), "base64")
  );

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    dekBuf,
    Buffer.from(eSignKey.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(eSignKey.tag, "base64"));
  const signKey = Buffer.concat([
    decipher.update(Buffer.from(eSignKey.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");

  console.log("4) 前端侧解密成功");
  console.log("   DEK     =", dekBuf.toString("base64").slice(0, 16) + "...");
  console.log("   signKey =", signKey.slice(0, 16) + "...");
  console.log("\n✅ 前后端 frontendId + 密钥协商流程已跑通");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
