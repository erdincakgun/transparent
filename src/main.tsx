import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route } from "react-router";
import LoginPage from "@/pages/login.tsx";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import LedgerCreatePage from "@/pages/ledger-create.tsx";
import { RequireAuth } from "./components/require-auth.tsx";
import Dashboard from "./layouts/dashboard.tsx";
import SummaryPage from "./pages/summary.tsx";
import TransactionsPage from "./pages/transactions.tsx";
import AccountsPage from "./pages/accounts.tsx";
import UsersPage from "./pages/users.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<Dashboard />}>
                <Route path="/summary" element={<SummaryPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/users" element={<UsersPage />} />
              </Route>
              <Route path="/ledger-create" element={<LedgerCreatePage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </StrictMode>,
);
