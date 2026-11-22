/**
 * 加密传输探测接口
 *
 * POST /client/secure/echo
 *
 * 中间件顺序：
 * 1. loadDekByFrontendId
 * 2. decryptRequestBody
 * 3. verifyRequestSignature
 * 4. handler（业务结果再 AES 加密返回）
 */
import { Router } from "express";
import {
  loadDekByFrontendId,
  decryptRequestBody,
} from "../middleware/cryptoTransport.js";
import { verifyRequestSignature } from "../middleware/verifySign.js";
import { aesGcmEncryptPayload } from "../utils/crypto.js";
import { SUCCESS_CODE } from "../constants/security.js";

const router = Router();

router.post(
  "/echo",
  loadDekByFrontendId,
  decryptRequestBody,
  verifyRequestSignature,
  async (req, res, next) => {
    try {
      const plainResult = {
        received: req.plainBody,
        serverMessage: "请求已解密并完成验签",
        frontendId: req.frontendId,
        signed: true,
        at: Date.now(),
      };

      const encData = aesGcmEncryptPayload(req.dek, plainResult);

      res.json({
        code: SUCCESS_CODE,
        msg: "success",
        encrypt: true,
        data: encData,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
