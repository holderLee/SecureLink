# SecureLink

敏感数据安全传输与接口验签（Vue3 前端 + Express 后端）。

## 能力

- frontendId 身份初始化
- RSA + AES 密钥协商（DEK / signKey）
- 业务请求 AES-256-GCM 加解密
- HMAC-SHA256 验签 + nonce 防重放

## 前端

```bash
cd SecureLink
npm install
npm run dev
```

默认打开 `/secure/secure-link`。开发联调请将 `.env.development` 中 `VITE_SECURE_LINK_MOCK=false`。

## 后端

```bash
cd server
npm install
npm run dev
```

- Health: `GET /health`
- 身份: `GET /client/security/genFrontendId`
- 密钥协商: `POST /client/security/genSecurityParam`
- 加密验签探测: `POST /client/secure/echo`

回归：`npm run test:sign`
