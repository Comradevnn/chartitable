// Small pure helpers shared by the layer modules.

export function unitFor(quantity: number, unit: string): string {
  if (quantity !== 1) return unit;
  if (unit === "meals") return "meal";
  if (unit === "volunteer shifts") return "volunteer shift";
  if (unit === "pounds of produce") return "pound of produce";
  return unit;
}

// API URLs: absolute http(s) or a same-origin path. Anything else is dropped.
export function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.charAt(0) !== "/" || value.charAt(1) === "/" || value.charAt(1) === "\\") return null;
  return value;
}

// Host-authored hrefs (data-ct-href-<kind>) are trusted markup, so "#volunteer" or
// "about.html#help" is fine. Still refuse script-capable schemes and control chars.
export function hostHref(raw: string): string | null {
  const value = raw.trim();
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;
  if (/^(javascript|data|vbscript):/i.test(value)) return null;
  return value;
}

export function money(dollars: number): string {
  return "$" + dollars.toLocaleString("en-US");
}
