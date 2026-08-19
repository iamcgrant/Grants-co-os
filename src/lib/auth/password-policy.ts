export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 12 characters and include upper, lower, a number, and a symbol.";

export function isStrongPassword(password: string): boolean {
  if (password.length < 12 || password.length > 128) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

export function assertStrongPassword(password: string): void {
  if (!isStrongPassword(password)) {
    throw new Error(PASSWORD_POLICY_MESSAGE);
  }
}
