import { Role } from "@/generated/prisma/client";

/** Permissions matrix — least privilege by default */
export const PERMISSIONS = {
  VIEW_FINANCE_DASHBOARD: [Role.OWNER, Role.ADMIN],
  VIEW_REVENUE: [Role.OWNER, Role.ADMIN],
  VIEW_PAYOUTS: [Role.OWNER],
  VIEW_PROCESSOR_CREDENTIALS: [Role.OWNER],
  MANAGE_PAYMENTS: [Role.OWNER, Role.ADMIN, Role.MANAGER],
  ISSUE_REFUNDS: [Role.OWNER, Role.ADMIN],
  CREATE_CLIENT: [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CUSTOMER_SERVICE],
  VIEW_CLIENT: [
    Role.OWNER,
    Role.ADMIN,
    Role.MANAGER,
    Role.CUSTOMER_SERVICE,
    Role.FILE_PREPARER,
  ],
  VIEW_CLIENT_FINANCIALS: [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.CUSTOMER_SERVICE],
  VIEW_BANK_INFO: [Role.OWNER, Role.ADMIN],
  VIEW_CREDIT_DOCS: [
    Role.OWNER,
    Role.ADMIN,
    Role.MANAGER,
    Role.CUSTOMER_SERVICE,
    Role.FILE_PREPARER,
  ],
  MANAGE_CREDIT: [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.FILE_PREPARER],
  MANAGE_OPERATIONS: [
    Role.OWNER,
    Role.ADMIN,
    Role.MANAGER,
    Role.CUSTOMER_SERVICE,
    Role.FILE_PREPARER,
  ],
  VIEW_MARKETING: [Role.OWNER, Role.ADMIN, Role.MARKETING],
  MANAGE_STAFF: [Role.OWNER, Role.ADMIN],
  VIEW_OWN_CLIENT_PORTAL: [Role.CLIENT],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Forbidden: ${role} lacks ${permission}`);
  }
}

export function canAccessFinancialData(role: Role): boolean {
  return hasPermission(role, "VIEW_CLIENT_FINANCIALS");
}

export function canSeePayouts(role: Role): boolean {
  return hasPermission(role, "VIEW_PAYOUTS");
}
