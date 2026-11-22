/**
 * 对象转 QueryString
 *
 * GET 验签时 param 取查询串；把 params 对象拼成 key=value&key=value
 *
 * @param obj 查询参数对象
 * @param options.encode 是否 URL 编码，默认 true
 * @param options.includeEmpty null/空字符串是否保留为 key=，默认 true
 * @param options.separator 拼接分隔符，默认 &
 */
export const objectToQueryString = (obj: any, options: any = {}) => {
  const { encode = true, includeEmpty = true, separator = "&" } = options;

  // 非对象或空对象：签名里 param 应为空串
  if (typeof obj !== "object" || obj === null || !Object.keys(obj).length) {
    return "";
  }

  const parts: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    // undefined 直接跳过，不参与签名串
    if (value === undefined) continue;

    // null / 空串：按方案“空值可保留为空”
    if (value === null || value === "") {
      if (includeEmpty) {
        const encodedKey = encode ? encodeURIComponent(key) : key;
        parts.push(`${encodedKey}=`);
      }
      continue;
    }

    // 数组：拆成多个同名 key
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === null || item === undefined) return;
        const encodedKey = encode ? encodeURIComponent(key) : key;
        const encodedValue = encode
          ? encodeURIComponent(String(item))
          : String(item);
        parts.push(`${encodedKey}=${encodedValue}`);
      });
      continue;
    }

    // 嵌套对象：先 JSON 再编码，避免 [object Object]
    if (typeof value === "object") {
      const encodedKey = encode ? encodeURIComponent(key) : key;
      const encodedValue = encode
        ? encodeURIComponent(JSON.stringify(value))
        : JSON.stringify(value);
      parts.push(`${encodedKey}=${encodedValue}`);
      continue;
    }

    // 普通标量
    const encodedKey = encode ? encodeURIComponent(key) : key;
    const encodedValue = encode
      ? encodeURIComponent(String(value))
      : String(value);
    parts.push(`${encodedKey}=${encodedValue}`);
  }

  return parts.join(separator);
};
