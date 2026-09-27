import type { AuthUser } from "@/types/auth";

/**
 * The one seeded account that still shows the app's original mock data
 * (points, owned vouchers) so the polished demo look has somewhere to live.
 * Every other account — including every new registration — sees real,
 * empty-by-default state instead of this hardcoded content.
 */
export const DEMO_ACCOUNT_EMAIL = "demo@disatravel.vn";

export function isDemoAccount(user: Pick<AuthUser, "email"> | null): boolean {
  return user?.email === DEMO_ACCOUNT_EMAIL;
}
