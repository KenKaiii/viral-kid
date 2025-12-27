/**
 * Format model pricing for display
 */
export function formatModelPrice(pricing?: string | null): string {
  if (!pricing) return "Free";
  try {
    const parsed: unknown = JSON.parse(pricing);
    if (!parsed || typeof parsed !== "object") return "Free";
    const record = parsed as Record<string, unknown>;
    const promptPrice = parseFloat(String(record.prompt || "0"));
    if (promptPrice === 0) return "Free";
    const pricePerMillion = promptPrice * 1_000_000;
    if (pricePerMillion < 0.01) return "<$0.01/1M";
    return `$${pricePerMillion.toFixed(2)}/1M`;
  } catch {
    return "Free";
  }
}

/**
 * Format model name by removing provider prefix
 */
export function formatModelName(name: string): string {
  return name.replace(/^[^:]+:\s*/, "");
}

/**
 * Format a number with compact notation (1K, 1M, etc.)
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
