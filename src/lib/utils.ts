import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function trimAmount(amount: string) {
  const [whole, fraction = ""] = amount.split(".");
  const digits = fraction.replace(/0+$/, "");

  return digits ? `${whole}.${digits}` : whole;
}

export function shortId(id: string) {
  return id.slice(0, 8);
}

const balanceFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
  signDisplay: "exceptZero",
});

export function formatBalance(balance: string) {
  return balanceFormat.format(Number(balance));
}

export function balanceStanding(balance: string) {
  const value = Number(balance);

  if (!value) return "settled";

  return value > 0 ? "owes this" : "is owed this";
}
