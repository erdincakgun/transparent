import { lazy } from "react";

export const LoginPage = lazy(() => import("@/pages/login.tsx"));
export const LedgerCreatePage = lazy(
  () => import("@/pages/ledger-create.tsx"),
);
export const MfaEnrollPage = lazy(() => import("@/pages/mfa-enroll.tsx"));
export const MfaVerifyPage = lazy(() => import("@/pages/mfa-verify.tsx"));
export const MfaSettingsPage = lazy(() => import("@/pages/mfa-settings.tsx"));
export const Dashboard = lazy(() => import("@/layouts/dashboard.tsx"));
export const SettleUpPage = lazy(() => import("@/pages/settle-up.tsx"));
export const TransactionsPage = lazy(
  () => import("@/pages/transactions.tsx"),
);
export const AccountsPage = lazy(() => import("@/pages/accounts.tsx"));
export const UsersPage = lazy(() => import("@/pages/users.tsx"));
export const AccountCreatePage = lazy(
  () => import("@/pages/account-create.tsx"),
);
export const AccountDeletePage = lazy(
  () => import("@/pages/account-delete.tsx"),
);
export const TransactionCreatePage = lazy(
  () => import("@/pages/transaction-create.tsx"),
);
export const UserAddPage = lazy(() => import("@/pages/user-add.tsx"));
export const UserDeletePage = lazy(() => import("@/pages/user-delete.tsx"));
