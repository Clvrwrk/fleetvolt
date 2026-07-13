export function safeReviewPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/caas";
  }
  return value;
}

