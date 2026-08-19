import { StrictMode, Suspense, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route, Outlet } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { RequireAuth } from "./components/require-auth.tsx";
import { RequireMfa } from "./components/require-mfa.tsx";
import { LedgerProvider } from "./components/ledger-provider.tsx";
import {
  LoginPage,
  LedgerCreatePage,
  LedgerDeletePage,
  LedgerDescribePage,
  MfaEnrollPage,
  MfaVerifyPage,
  MfaSettingsPage,
  Dashboard,
  SettleUpPage,
  TransactionsPage,
  AccountsPage,
  UsersPage,
  AccountCreatePage,
  AccountDeletePage,
  AccountDescribePage,
  TransactionCreatePage,
  UserAddPage,
  UserDeletePage,
} from "./lazy-pages.tsx";

function withSuspense(Component: ComponentType) {
  return (
    <Suspense fallback={null}>
      <Component />
    </Suspense>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={withSuspense(LoginPage)} />
            <Route element={<RequireAuth />}>
              <Route path="/mfa-enroll" element={withSuspense(MfaEnrollPage)} />
              <Route path="/mfa-verify" element={withSuspense(MfaVerifyPage)} />
              <Route element={<RequireMfa />}>
                <Route
                  path="/mfa-settings"
                  element={withSuspense(MfaSettingsPage)}
                />
                <Route
                  element={
                    <LedgerProvider>
                      <Outlet />
                    </LedgerProvider>
                  }
                >
                  <Route element={withSuspense(Dashboard)}>
                    <Route path="/" element={withSuspense(SettleUpPage)} />
                    <Route
                      path="/transactions"
                      element={withSuspense(TransactionsPage)}
                    />
                    <Route path="/accounts" element={withSuspense(AccountsPage)} />
                    <Route path="/users" element={withSuspense(UsersPage)} />
                  </Route>
                  <Route
                    path="/ledger-create"
                    element={withSuspense(LedgerCreatePage)}
                  />
                  <Route
                    path="/ledgers/delete/:ledgerId"
                    element={withSuspense(LedgerDeletePage)}
                  />
                  <Route
                    path="/ledgers/describe/:ledgerId"
                    element={withSuspense(LedgerDescribePage)}
                  />
                  <Route
                    path="/account-create"
                    element={withSuspense(AccountCreatePage)}
                  />
                  <Route
                    path="/accounts/delete/:accountId"
                    element={withSuspense(AccountDeletePage)}
                  />
                  <Route
                    path="/accounts/describe/:accountId"
                    element={withSuspense(AccountDescribePage)}
                  />
                  <Route
                    path="/transaction-create"
                    element={withSuspense(TransactionCreatePage)}
                  />
                  <Route path="/user-add" element={withSuspense(UserAddPage)} />
                  <Route
                    path="/users/delete/:userId"
                    element={withSuspense(UserDeletePage)}
                  />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </StrictMode>,
);
