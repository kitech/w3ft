function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function detectCharset(response, buffer) {
  const contentType = response.headers.get("Content-Type") || "";
  const match1 = contentType.match(/charset=([^\s;]+)/i);
  if (match1) {
    return match1[1].toLowerCase();
  }

  const head = new TextDecoder("ascii").decode(buffer.slice(0, 512));
  const match2 = head.match(/<\?xml[^?]*encoding=["']([^"']+)["']/i);
  if (match2) {
    return match2[1].toLowerCase();
  }

  return "utf-8";
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return jsonResponse(400, { error: "Missing url parameter" });
    }

    try {
      new URL(targetUrl);
    } catch {
      return jsonResponse(400, { error: "Invalid url" });
    }

    let resp;
    try {
      resp = await fetch(targetUrl);
    } catch {
      return jsonResponse(502, { error: "Failed to fetch RSS" });
    }

    if (!resp.ok) {
      return jsonResponse(502, { error: `Upstream returned ${resp.status}` });
    }

    const buffer = await resp.arrayBuffer();
    const charset = detectCharset(resp, buffer);
    const text = new TextDecoder(charset).decode(buffer);

    return new Response(text, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  },
};
