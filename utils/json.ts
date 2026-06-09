export function tryParseJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function formatJson(text: string): string | null {
  const parsed = tryParseJson(text);
  if (parsed === null) return null;
  return JSON.stringify(parsed, null, 2);
}
