import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function trimAmount(amount: string) {
  const [whole, fraction = ""] = amount.split(".")
  const digits = fraction.replace(/0+$/, "")

  return digits ? `${whole}.${digits}` : whole
}
