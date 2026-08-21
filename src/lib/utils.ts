import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const trailingZeros = /0+$/;

export function trimAmount(amount: string) {
  const [whole, fraction = ""] = amount.split(".");
  const digits = fraction.replace(trailingZeros, "");

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

const amountFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatAmount(amount: string) {
  return amountFormat.format(Number(amount));
}

const timestampFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
  hourCycle: "h23",
});

export function formatTimestamp(timestamp: string) {
  return timestampFormat.format(new Date(timestamp));
}

export function balanceStanding(balance: string) {
  const value = Number(balance);

  if (value === 0) return "settled";

  return value > 0 ? "owes this" : "is owed this";
}

export function countLabel(count: number, noun: string) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}
