/**
 * 安全接口路由
 * - GET|POST /client/security/genFrontendId
 * - POST /client/security/genSecurityParam
 */
import { Router } from "express";
import { SUCCESS_CODE } from "../constants/security.js";
import {
  createFrontendId,
  createSecurityParam,
  SecurityError,
} from "../services/securityService.js";

const router = Router();

/** 统一成功返回 */
function ok(res, data) {
  res.json({
    code: SUCCESS_CODE,
    msg: "success",
    encrypt: null,
    data,
  });
}

/** 申请 frontendId */
async function handleGenFrontendId(_req, res, next) {
  try {
    const data = await createFrontendId();
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

router.get("/genFrontendId", handleGenFrontendId);
router.post("/genFrontendId", handleGenFrontendId);

/** 密钥协商：body { frontendId, pubKey } */
router.post("/genSecurityParam", async (req, res, next) => {
  try {
    const frontendId =
      req.body?.frontendId || req.headers["frontendid"] || req.headers["frontendId"];
    const pubKey = req.body?.pubKey;

    const data = await createSecurityParam({ frontendId, pubKey });
    ok(res, data);
  } catch (err) {
    // 业务错误：HTTP 仍 200，把 code/msg 写进 body，方便前端按业务码处理
    if (err instanceof SecurityError) {
      return res.status(err.status || 200).json({
        code: err.code,
        msg: err.message,
        encrypt: null,
        data: null,
      });
    }
    next(err);
  }
});

export default router;
