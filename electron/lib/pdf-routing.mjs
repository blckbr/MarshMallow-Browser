function headerValue(headers, name) {
  const key = Object.keys(headers || {}).find((item) => item.toLowerCase() === String(name).toLowerCase());
  const value = key ? headers[key] : null;
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export function isPdfUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return /^https?:$/i.test(url.protocol) && /\.pdf$/i.test(url.pathname || "");
  } catch {
    return false;
  }
}

export function isPdfMime(value) {
  return /^application\/pdf(?:\s*;|$)/i.test(String(value || "").trim());
}

export function shouldInterceptPdfResponse(details = {}) {
  if (String(details.resourceType || "") !== "mainFrame") return false;
  if (!/^https?:\/\//i.test(String(details.url || ""))) return false;
  return isPdfMime(headerValue(details.responseHeaders, "content-type"));
}
