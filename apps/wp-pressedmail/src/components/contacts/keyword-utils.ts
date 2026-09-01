export const normalizeKeyword = (keyword: string) =>
  keyword.trim().replace(/\s+/g, " ").toLowerCase();

export const splitKeywords = (value: string) =>
  value.split(",").map(normalizeKeyword).filter(Boolean);
