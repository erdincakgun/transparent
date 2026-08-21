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

/**
 * The first block of a uuid — all an attribution can say when `auth.users` is
 * not exposed. `Actor` renders it on screen and the HTML report renders it in
 * a file, so the length of "the first block" is decided once.
 */
export function shortId(id: string) {
  return id.slice(0, 8);
}

/**
 * `signDisplay: "exceptZero"` is what puts the + back on a credit: a bare
 * "1,250.50" beside a "-1,100.00" reads as two unrelated figures, where "+" and
 * "−" read as two directions of the same one.
 */
const balanceFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
  signDisplay: "exceptZero",
});

export function formatBalance(balance: string) {
  return balanceFormat.format(Number(balance));
}

/**
 * What a sign cannot carry is *which way round it is*: the balance is credits
 * in minus debits out, so a **positive** balance is the account that pays
 * (`payer.balance > 0` in `002_settlement_transfers.sql`).
 */
export function balanceStanding(balance: string) {
  const value = Number(balance);

  if (!value) return "settled";

  return value > 0 ? "owes this" : "is owed this";
}
