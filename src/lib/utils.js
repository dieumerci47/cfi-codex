import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Fusionne des classes conditionnelles (clsx) en résolvant les conflits Tailwind.
 * @param {...any} inputs
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
