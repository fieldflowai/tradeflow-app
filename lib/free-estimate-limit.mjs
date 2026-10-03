export const FREE_DAILY_ESTIMATE_LIMIT_MIN = 0;
export const FREE_DAILY_ESTIMATE_LIMIT_MAX = 1000;

export function parseFreeDailyEstimateLimit(value) {
  if (!Number.isInteger(value)) return null;
  if (value < FREE_DAILY_ESTIMATE_LIMIT_MIN || value > FREE_DAILY_ESTIMATE_LIMIT_MAX) return null;
  return value;
}

export function canManageFreeDailyEstimateLimit(role) {
  return role === "super_admin";
}

export function isFreeEstimateLimitError(error) {
  return Boolean(error && typeof error === "object" && "message" in error &&
    typeof error.message === "string" && error.message.includes("FREE_DAILY_ESTIMATE_LIMIT"));
}
