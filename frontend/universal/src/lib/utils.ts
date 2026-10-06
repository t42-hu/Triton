import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Resolves conditional utility classes with caller overrides taking precedence. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
