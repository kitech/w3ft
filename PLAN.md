# Cloudflare Workers - RSS Fetcher

## 项目概述

通过 Cloudflare Workers 提供一个 HTTP 服务，接收 GET 参数 `url`，获取目标 RSS 源的 XML 数据，自动检测并转换非 UTF-8 编码为 UTF-8 后返回。

## 项目结构

```
cf-webfetch/
├── wrangler.toml        # Cloudflare Workers 配置
├── package.json          # 项目依赖
└── src/
    └── index.js          # Worker 主逻辑
```

## 功能设计

### 请求方式

```
GET /?url=<RSS源URL>
```

### 响应设计

| 场景                     | HTTP 状态码 | Content-Type              | 响应内容                              |
| ------------------------ | ----------- | ------------------------- | ------------------------------------- |
| 缺少 url 参数            | 400         | application/json          | `{"error": "Missing url parameter"}` |
| url 格式无效             | 400         | application/json          | `{"error": "Invalid url"}`            |
| 源站请求失败             | 502         | application/json          | `{"error": "Failed to fetch RSS"}`    |
| 成功                     | 200         | application/xml; charset=utf-8 | 转换后的 UTF-8 XML 内容              |

### 编码检测与转换流程

1. 使用 `fetch()` 请求目标 URL，获取 `ArrayBuffer` 原始字节
2. 检测编码来源（优先级从高到低）：
   - HTTP 响应头 `Content-Type` 中的 `charset` 参数
   - XML 声明 `<?xml ... encoding="..."?>`
   - 默认假设为 `utf-8`
3. 使用 `TextDecoder` API 将 `ArrayBuffer` 按检测到的编码解码为 UTF-8 字符串
4. 返回转换后的内容

### 支持的编码

`TextDecoder` 原生支持，无需第三方库：
- `utf-8`, `gbk`, `gb2312`, `gb18030`
- `big5`, `iso-8859-1`, `windows-1252`
- `shift_jis`, `euc-jp`, `euc-kr`

## 核心伪代码

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    // 1. 参数校验
    if (!targetUrl) return jsonResponse(400, { error: "Missing url parameter" });
    try { new URL(targetUrl); } catch { return jsonResponse(400, { error: "Invalid url" }); }

    // 2. 请求目标 RSS
    const resp = await fetch(targetUrl);
    if (!resp.ok) return jsonResponse(502, { error: "Failed to fetch RSS" });

    // 3. 获取原始字节
    const buffer = await resp.arrayBuffer();

    // 4. 检测编码
    const charset = detectCharset(resp, buffer);

    // 5. 解码为 UTF-8
    const text = new TextDecoder(charset).decode(buffer);

    // 6. 返回
    return new Response(text, {
      headers: { "Content-Type": "application/xml; charset=utf-8" }
    });
  }
};
```

## 编码检测函数

```js
function detectCharset(response, buffer) {
  // 1. 从 Content-Type 头检测
  const contentType = response.headers.get("Content-Type") || "";
  const match1 = contentType.match(/charset=([^\s;]+)/i);
  if (match1) return match1[1].toLowerCase();

  // 2. 从 XML 声明检测（只读前512字节）
  const head = new TextDecoder("ascii").decode(buffer.slice(0, 512));
  const match2 = head.match(/<\?xml[^?]*encoding=["']([^"']+)["']/i);
  if (match2) return match2[1].toLowerCase();

  // 3. 默认 utf-8
  return "utf-8";
}
```

## 部署命令

```bash
# 初始化项目（首次）
npm init -y
npm install -D wrangler

# 本地开发
npx wrangler dev

# 部署到 Cloudflare
npx wrangler deploy
```

## wrangler.toml

```toml
name = "rss-fetcher"
main = "src/index.js"
compatibility_date = "2024-01-01"
```
