# SecureLink Server

Express 后端：负责 **frontendId 签发**、**RSA + AES 密钥协商**、**AES-GCM 加解密传输**、**HMAC 验签与 nonce 防重放**。与前端 `@/secure-link` 联调，默认端口 `8989`。

---

## 1. 职责边界

| 能力 | 说明 |
|------|------|
| 身份 | 签发 `frontendId`，Redis TTL 管理 |
| 协商 | 校验身份后生成 DEK / signKey；明文只存 Redis，密文回前端 |
| 传输 | 解密 `EncryptDataDto` 请求体；业务结果可再 AES-GCM 加密返回 |
| 验签 | HMAC-SHA256 + 时间窗 + nonce 一次性消费 |
| 探活 | `/health` 含 Redis PING |

不负责：账号登录体系、权限 RBAC、完整 KMS/Vault 运维（密钥生成可替换为 Vault，接口字段保持不变）。

---

## 2. 快速启动

```bash
cd server
npm install
npm run dev          # node --watch src/server.js
# 或
npm start
```

- 服务：http://localhost:8989  
- 健康：http://localhost:8989/health  
- 需 Node.js ≥ 18  

默认 `REDIS_MODE=embedded`，本地无需单独安装 Redis；生产改为 `standalone` 并配置 `REDIS_HOST` / `REDIS_PORT`。

---

## 3. 目录结构

```text
server/
├── .env                      # 端口、Redis、TTL（勿提交密钥类敏感项）
├── package.json
├── scripts/
│   └── test-encrypt-flow.mjs # 按需回归：加密 + 验签 + 防重放
└── src/
    ├── server.js             # 入口：dotenv → initRedis → listen
    ├── app.js                # Express 中间件与路由挂载
    ├── config/redis.config.js
    ├── constants/security.js # 业务码、TTL、Redis key 工厂
    ├── db/redis.js           # ioredis + embedded / standalone
    ├── utils/crypto.js       # RSA-OAEP / AES-GCM / HMAC
    ├── services/securityService.js
    ├── middleware/
    │   ├── cryptoTransport.js  # 加载 DEK、解密请求体
    │   └── verifySign.js       # 验签 + nonce
    └── routes/
        ├── health.js
        ├── security.js         # genFrontendId / genSecurityParam
        └── secureEcho.js       # 加密回显探测
```

---

## 4. 启动与请求链路

### 4.1 进程启动

```text
dotenv → initRedis() → app.listen(PORT)
         ↑ 失败则 process.exit(1)，避免「HTTP 通了但存不了身份」
SIGINT / SIGTERM → server.close → closeRedis()
```

### 4.2 安全业务主路径

```text
① GET|POST /client/security/genFrontendId
      → Redis 写入 frontendId:{id}（TTL）

② POST /client/security/genSecurityParam  { frontendId, pubKey }
      → 校验 frontendId 存在
      → 生成 DEK、signKey
      → RSA-OAEP 加密 DEK → eDek（前缀 vault:v1:）
      → AES-GCM 用 DEK 加密 signKey → eSignKey
      → Redis 存 dek / signKey（TTL），刷新 frontendId TTL
      → 返回 { eDek, eSignKey }

③ POST /client/secure/echo
      → loadDekByFrontendId
      → decryptRequestBody
      → verifyRequestSignature
      → 业务处理（明文在 req.plainBody）
      → aesGcmEncryptPayload 加密响应 data
```

---

## 5. HTTP API

统一成功形态（业务成功 `code === 0`）：

```json
{
  "code": 0,
  "msg": "success",
  "encrypt": null,
  "data": {}
}
```

业务失败多数仍 **HTTP 200**，用 `body.code` 区分（与前端约定一致）。

### 5.1 `GET /` 服务信息

返回服务名与主要 API 列表。

### 5.2 `GET /health`

| 字段 | 含义 |
|------|------|
| `data.uptime` | 进程运行秒数 |
| `data.redis.ok` | PING 是否为 `PONG` |
| `data.redis.mode/host/port` | 当前 Redis 运行信息 |

### 5.3 `GET|POST /client/security/genFrontendId`

**响应 `data`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `frontendId` | string | 无横线 UUID |
| `expireTime` | number | 过期毫秒时间戳 |

### 5.4 `POST /client/security/genSecurityParam`

**请求 body：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `frontendId` | 是 | 也可放 header `frontendId` |
| `pubKey` | 是 | PEM 公钥，需含 `PUBLIC KEY` |

**响应 `data`：**

| 字段 | 说明 |
|------|------|
| `eDek` | `vault:v1:` + Base64(RSA 密文) |
| `eSignKey` | `{ ciphertext, iv, tag, aad }` AES-GCM 包 |

### 5.5 `POST /client/secure/echo`

加密传输 + 验签探测接口。

**Header（验签相关，名不区分大小写）：**

| Header | 说明 |
|--------|------|
| `frontendId` | 会话身份 |
| `sign` | HMAC-SHA256 十六进制（小写比对） |
| `nonce` | 一次性随机串 |
| `timestamp` | 毫秒时间戳 |
| `lang` | 参与签名，可空 |
| `token` | 参与签名，可空（与 Authorization 解耦） |

**Body：** `EncryptDataDto`（`encrypt=true` + `ciphertext` / `iv` / `tag` / `aad`）

**中间件顺序（不可乱）：**

1. `loadDekByFrontendId` — 校验身份，加载 `req.dek` / `req.signKey`  
2. `decryptRequestBody` — 解密得到 `req.plainBody`  
3. `verifyRequestSignature` — 用**解密前明文**重建 `param` 再验签  
4. handler — 业务结果加密写入 `data`，`encrypt: true`

---

## 6. 密码学约定

实现见 `src/utils/crypto.js`，与前端 Web Crypto 对齐。

| 用途 | 算法 |
|------|------|
| 保护 DEK | RSA-OAEP，Hash = SHA-256 |
| 保护 signKey / 业务体 | AES-256-GCM，IV 12 字节 |
| 接口签名 | HMAC-SHA256，输出 hex；`signKey` 按 **UTF-8 文本** 作密钥（勿再 Base64 解码） |

**签名串规则（与前端一致）：**

1. 参与字段：`lang`、`nonce`、`param`、`timestamp`、`token`  
2. `null` → `""`；键名升序；拼接为 `key=value&...`（不对 value 做 URL encode）  
3. `param`：加密接口为 `Base64(JSON.stringify(plainBody))`  

**恒定时间比较：** `safeEqualString` 使用 `crypto.timingSafeEqual`。

---

## 7. Redis 模型

| 逻辑 Key（再加前缀 `securelink:`） | 内容 | TTL |
|--------------------------------------|------|-----|
| `frontendId:{id}` | 创建元数据 JSON | `FRONTEND_ID_TTL_SECONDS`（默认 7 天） |
| `dek:{id}` | DEK Base64 | `SECURITY_KEY_TTL_SECONDS`（默认 2 小时） |
| `signKey:{id}` | signKey Base64 文本 | 同上 |
| `nonce:{frontendId}:{nonce}` | `"1"` | `NONCE_TTL_SECONDS`（默认 5 分钟） |

防重放：`SET key NX EX`，非 `OK` 即判定重放。

**模式：**

- `embedded`：`redis-memory-server` 临时实例，适合本地  
- `standalone`：连接外部 Redis  

---

## 8. 业务错误码

定义于 `src/constants/security.js`：

| code | 含义 |
|------|------|
| `0` | 成功 |
| `1002059` | frontendId 无效 / 过期 / 未协商出 DEK |
| `1002060` | 加密失败（预留） |
| `1002061` | 解密失败 |
| `1002062` | 密钥协商失败（KMS/公钥等问题） |
| `-201` | 签名无效、缺头、时间窗超时、nonce 重放 |

前端收到 `1002059` / `-201` 等时，通常应重新走身份 + 协商。

---

## 9. 环境变量

见 `server/.env`：

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | `8989` | 监听端口 |
| `NODE_ENV` | `development` | 环境 |
| `REDIS_MODE` | `embedded` | `embedded` / `standalone` |
| `REDIS_HOST` | `127.0.0.1` | standalone 主机 |
| `REDIS_PORT` | `6379` | standalone 端口 |
| `REDIS_PASSWORD` | 空 | 可选 |
| `REDIS_KEY_PREFIX` | `securelink:` | ioredis keyPrefix |
| `FRONTEND_ID_TTL_SECONDS` | `604800` | 7 天 |
| `SECURITY_KEY_TTL_SECONDS` | `7200` | 2 小时 |
| `TIMESTAMP_SKEW_MS` | `300000` | 时间窗 ±5 分钟 |
| `NONCE_TTL_SECONDS` | `300` | nonce TTL，建议 ≥ 时间窗 |

脚本可用 `API_BASE` 覆盖默认 `http://localhost:8989`。

---

## 10. 回归脚本（可选）

日常联调以页面「联调验证」为准。仅在改动 `crypto` / 验签 / 解密中间件后，启动服务再执行：

```bash
npm run test:flow
```

覆盖：协商 → `/client/secure/echo` → 响应解密 → 同 nonce 重放应失败。不进生产包、不挂 CI。

---

## 11. 扩展新加密业务接口

以 `secureEcho` 为模板：

```js
router.post(
  "/your-api",
  loadDekByFrontendId,
  decryptRequestBody,
  verifyRequestSignature,
  async (req, res, next) => {
    // 使用 req.plainBody、req.frontendId、req.dek
    const result = await doBusiness(req.plainBody);
    const encData = aesGcmEncryptPayload(req.dek, result);
    res.json({ code: 0, msg: "success", encrypt: true, data: encData });
  }
);
```

注意：验签依赖 `req.plainBody`，必须先解密再验签。

---

## 12. 与前端对齐要点

| 点 | 约定 |
|----|------|
| 端口 | 前端 `VITE_APP_API_URL=http://localhost:8989` |
| eDek 前缀 | `vault:v1:` 后为 RSA 密文 Base64 |
| 签名字段顺序 | 键名升序拼接 |
| timestamp | 字符串参与签名，与 header 数值一致 |
| 业务码 | HTTP 200 + `code`，不要只看 HTTP 状态 |

---

## 13. 运维注意

- 生产务必 `REDIS_MODE=standalone`，并限制 Redis 网络访问  
- embedded 仅本地；进程退出应走 `closeRedis`，避免残留内存 Redis 子进程  
- DEK / signKey 明文只在 Redis，注意 Redis 持久化与 ACL  
- 当前密钥在本进程 `crypto.randomBytes` 生成；接 Vault 时替换 `createSecurityParam` 内生成逻辑即可，对外字段不变  
