import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Return the first element of a Set, or undefined if empty. */
export function firstOf<T>(set: Set<T>): T | undefined {
  for (const item of set) {
    return item;
  }
  return undefined;
}
