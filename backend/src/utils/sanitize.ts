/**
 * Escape special regex characters in user-supplied search strings
 * to prevent ReDoS (Regular Expression Denial of Service) attacks.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
