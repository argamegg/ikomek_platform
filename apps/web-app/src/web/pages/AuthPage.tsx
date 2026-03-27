import { startTransition, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { LockKeyhole, Mail, User2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Input";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";

type AuthTab = "login" | "register" | "recover";
type RegisterForm = {
  name: string;
  email: string;
  password: string;
  language: "en" | "ru" | "kz";
};

export function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });
  const [tab, setTab] = useState<AuthTab>("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    name: "",
    email: "",
    password: "",
    language: "en",
  });

  useEffect(() => {
    if (currentUserQuery.data) {
      navigate("/dashboard", { replace: true });
    }
  }, [currentUserQuery.data, navigate]);

  const loginMutation = useMutation({
    mutationFn: platformApi.login,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      toast.success("Signed in successfully");
      startTransition(() => {
        if (result.user?.roles.includes("admin")) {
          navigate("/admin");
          return;
        }

        navigate(result.user?.roles.includes("operator") ? "/operator" : "/dashboard");
      });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const registerMutation = useMutation({
    mutationFn: platformApi.register,
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Account created");
      startTransition(() => navigate("/dashboard"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="page-stack">
      <PageHeader title={t("auth.title")} description={t("auth.description")} />
      <div className="auth-grid">
        <Card className="auth-panel" hover={false}>
          <Tabs
            value={tab}
            onChange={(value) => setTab(value as AuthTab)}
            options={[
              { key: "login", label: t("auth.loginTab") },
              { key: "register", label: t("auth.registerTab") },
              { key: "recover", label: t("auth.recoverTab") },
            ]}
          />

          {tab === "login" ? (
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                loginMutation.mutate(loginForm);
              }}
            >
              <Input
                label={t("auth.fields.email")}
                type="email"
                icon={<Mail size={16} />}
                value={loginForm.email}
                onChange={(event) => setLoginForm((value) => ({ ...value, email: event.target.value }))}
                required
              />
              <Input
                label={t("auth.fields.password")}
                type="password"
                icon={<LockKeyhole size={16} />}
                value={loginForm.password}
                onChange={(event) => setLoginForm((value) => ({ ...value, password: event.target.value }))}
                required
              />
              <Button type="submit" isLoading={loginMutation.isPending} fullWidth>
                {t("common.login")}
              </Button>
            </form>
          ) : null}

          {tab === "register" ? (
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                registerMutation.mutate(registerForm);
              }}
            >
              <Input
                label={t("auth.fields.name")}
                icon={<User2 size={16} />}
                value={registerForm.name}
                onChange={(event) => setRegisterForm((value) => ({ ...value, name: event.target.value }))}
                required
              />
              <Input
                label={t("auth.fields.email")}
                type="email"
                icon={<Mail size={16} />}
                value={registerForm.email}
                onChange={(event) => setRegisterForm((value) => ({ ...value, email: event.target.value }))}
                required
              />
              <Input
                label={t("auth.fields.password")}
                type="password"
                icon={<LockKeyhole size={16} />}
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm((value) => ({ ...value, password: event.target.value }))
                }
                required
              />
              <Select
                label={t("auth.fields.language")}
                value={registerForm.language}
                onChange={(event) =>
                  setRegisterForm((value) => ({
                    ...value,
                    language: event.target.value as "en" | "ru" | "kz",
                  }))
                }
              >
                <option value="en">English</option>
                <option value="ru">Русский</option>
                <option value="kz">Қазақша</option>
              </Select>
              <Button type="submit" isLoading={registerMutation.isPending} fullWidth>
                {t("common.register")}
              </Button>
            </form>
          ) : null}

          {tab === "recover" ? (
            <div className="form-stack">
              <Card hover={false}>
                <p>
                  Password recovery is not exposed by the shared FastAPI backend yet.
                </p>
                <p>
                  Use one of the demo accounts or sign up for a new account from this page.
                </p>
              </Card>
            </div>
          ) : null}
        </Card>

        <Card className="auth-aside">
          <span className="section-card__eyebrow">Shared session model</span>
          <h3>One account, every channel.</h3>
          <p>
            Login, profile edits, request history, attachments, and operator chat are all sourced
            from the same FastAPI backend and database as the mobile application.
          </p>
          <ul className="bullet-list">
            <li>Bearer-token and cookie-based sessions are both supported.</li>
            <li>Role-aware redirects keep operator and admin flows fast.</li>
            <li>All post-auth data is refreshed through React Query after sign-in.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
