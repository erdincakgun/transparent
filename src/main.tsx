import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route, Outlet } from "react-router";
import LoginPage from "@/pages/login.tsx";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import LedgerCreatePage from "@/pages/ledger-create.tsx";
import { RequireAuth } from "./components/require-auth.tsx";
import { RequireMfa } from "./components/require-mfa.tsx";
import MfaEnrollPage from "./pages/mfa-enroll.tsx";
import MfaVerifyPage from "./pages/mfa-verify.tsx";
import Dashboard from "./layouts/dashboard.tsx";
import SettleUpPage from "./pages/settle-up.tsx";
import TransactionsPage from "./pages/transactions.tsx";
import AccountsPage from "./pages/accounts.tsx";
import UsersPage from "./pages/users.tsx";
import AccountCreatePage from "./pages/account-create.tsx";
import AccountDeletePage from "./pages/account-delete.tsx";
import TransactionCreatePage from "./pages/transaction-create.tsx";
import UserAddPage from "./pages/user-add.tsx";
import UserDeletePage from "./pages/user-delete.tsx";
import { LedgerProvider } from "./components/ledger-provider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/mfa-enroll" element={<MfaEnrollPage />} />
              <Route path="/mfa-verify" element={<MfaVerifyPage />} />
              <Route element={<RequireMfa />}>
                <Route
                  element={
                    <LedgerProvider>
                      <Outlet />
                    </LedgerProvider>
                  }
                >
                  <Route element={<Dashboard />}>
                    <Route path="/" element={<SettleUpPage />} />
                    <Route
                      path="/transactions"
                      element={<TransactionsPage />}
                    />
                    <Route path="/accounts" element={<AccountsPage />} />
                    <Route path="/users" element={<UsersPage />} />
                  </Route>
                  <Route path="/ledger-create" element={<LedgerCreatePage />} />
                  <Route
                    path="/account-create"
                    element={<AccountCreatePage />}
                  />
                  <Route
                    path="/accounts/delete/:accountId"
                    element={<AccountDeletePage />}
                  />
                  <Route
                    path="/transaction-create"
                    element={<TransactionCreatePage />}
                  />
                  <Route path="/user-add" element={<UserAddPage />} />
                  <Route
                    path="/users/delete/:userId"
                    element={<UserDeletePage />}
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
