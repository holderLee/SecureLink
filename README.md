# SecureLink

敏感数据安全传输与接口验签的前后端演示项目：应用层密钥协商、AES-GCM 加密传输、HMAC 验签与防重放，前后端可联调跑通。

## 一句话定位

浏览器用 Web Crypto 完成 RSA + AES 密钥协商与 AES-GCM 加解密，请求再带 HMAC 签名；Express 侧验签、解密并回包，Redis 存会话密钥与 nonce。

## 安全流程（与页面四步一致）

```text
身份标识 → 密钥协商 → 加密传输 → 验签防重放
   │           │           │            │
 frontendId   DEK/signKey  AES-GCM     HMAC+nonce
```

| 步骤 | 白话 | 对应能力 |
|------|------|----------|
| 1 身份标识 | 先领一张「通行证」 | `GET /client/security/genFrontendId` |
| 2 密钥协商 | 安全换出加解密密钥与签名密钥 | `POST /client/security/genSecurityParam` |
| 3 加密传输 | 路上只见密文 | AES-256-GCM + `POST /client/secure/echo` |
| 4 验签防重放 | 证明是你发的、且不能重发旧包 | HMAC-SHA256 + timestamp + nonce |

## 技术栈

| 端 | 技术 |
|----|------|
| 前端 | Vue 3、Vite、Pinia、Element Plus、Web Crypto API |
| 后端 | Express 5、Node.js ≥ 18 |
| 存储 | Redis（本地可用内置 embedded 模式） |

## 本地运行

### 前端

```bash
cd SecureLink
npm install
npm run dev
```

- 地址：http://localhost:3000/
- 开发联调请保持 `.env.development` 中 `VITE_SECURE_LINK_MOCK=false`

### 后端

```bash
cd server
npm install
npm run dev
```

- 服务：http://localhost:8989
- Health：http://localhost:8989/health
- 加密验签探测：`POST /client/secure/echo`

改加密/验签后可在 `server` 目录跑一条回归（需先启动服务）：

```bash
npm run test:flow
```

后端说明见 [server/README.md](./server/README.md)。

## 演示路径

1. 启动后端与前端后打开首页。
2. 滚动到「动手走一遍」。
3. 依次点击：初始化身份 + 密钥协商 → 加密传输 + 验签 → 预览签名参数。
4. 对照上方「安全流程」高亮与脱敏密钥、密文/明文结果。

## 核心代码入口

```text
src/secure-link/          # 前端安全能力封装
  hooks/useFrontendCrypto.ts
  utils/webCrypto.ts      # 加解密 / 签名
  utils/keyManager.ts     # 内存密钥
  api/security.ts         # 身份与协商接口
  api/secureEcho.ts       # 加密回显探测

src/views/secure-link/    # 演示站单页（Hero + 流程 + 交互）

server/src/               # Express：协商、验签、加解密中间件
```

## 环境变量速查

**前端** `.env.development`

- `VITE_APP_PORT`：开发端口（默认 3000）
- `VITE_APP_API_URL`：后端地址（默认 `http://localhost:8989`）
- `VITE_SECURE_LINK_MOCK`：`false` 走真实后端

**后端** `server/.env`

- `PORT`：8989
- `REDIS_MODE`：`embedded`（本地内置 Redis）或 `standalone`
