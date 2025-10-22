import { randomBytes } from "crypto";

export function renderDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0s";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  let time = "";
  if (minutes > 0) time += `${minutes}min `;
  time += `${seconds}s`;
  return time.trim();
}

export function renderTroops(troops: number): string {
  return renderNumber(troops / 10);
}

export function renderNumber(
  num: number | bigint,
  fixedPoints?: number,
): string {
  num = Number(num);
  num = Math.max(num, 0);

  if (num >= 10_000_000) {
    return (num / 1_000_000).toFixed(fixedPoints ?? 1) + "M";
  } else if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(fixedPoints ?? 2) + "M";
  } else if (num >= 100_000) {
    return Math.floor(num / 1_000) + "K";
  } else if (num >= 10_000) {
    return (num / 1_000).toFixed(fixedPoints ?? 1) + "K";
  } else {
    return Math.floor(num).toString();
  }
}

export function generateCryptoRandomUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(
    /[018]/g,
    (c: any) => (c ^ (randomBytes(1)[0] & (15 >> (c / 4)))).toString(16),
  );
}
