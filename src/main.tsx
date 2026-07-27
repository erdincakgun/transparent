import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter, Routes, Route } from "react-router";
import { LoginForm } from "./components/login-form.tsx";
import { SignUpForm } from "./components/sign-up-form.tsx";
import { ForgotPasswordForm } from "./components/forgot-password-form.tsx";
import { UpdatePasswordForm } from "./components/update-password-form.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/sign-up" element={<SignUpForm />} />
        <Route path="/forgot-password" element={<ForgotPasswordForm />} />
        <Route path="/update-password" element={<UpdatePasswordForm />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
