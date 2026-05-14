import axios from "axios";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { KeyRound, LockKeyhole, Mail, RefreshCcw, Smartphone, User2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Input";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";
import type { AuthRegistrationChallenge } from "../../types/platform";

type AuthTab = "login" | "register" | "recover";
type RegisterForm = {
  name: string;
  email: string;
  phone: string;
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
    phone: "",
    password: "",
    language: "en",
  });
  const [verificationState, setVerificationState] = useState<AuthRegistrationChallenge | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const authContentKey = verificationState ? "verification" : tab === "recover" ? "recovery" : tab;
  const authHeaderDefaults = {
    login: {
      eyebrow: "Login",
      title: "Sign in to your existing iKOMEK account",
      subtitle:
        "Web and mobile applications use one authentication flow, profiles, requests, and chat history.",
    },
    register: {
      eyebrow: "Registration",
      title: "Create an account",
      subtitle: "Welcome! Please fill in your details to register.",
    },
    recovery: {
      eyebrow: "Recovery",
      title: "Recover access",
      subtitle: "Enter your details to restore access to your account.",
    },
    verification: {
      eyebrow: "Verification",
      title: "Verify your email",
      subtitle: "Enter the one-time code sent to your email to activate your iKOMEK account.",
    },
  } as const;
  const verificationEmail = verificationState?.email || registerForm.email;

  const languageOptions = useMemo(
    () => [
      { value: "en", label: "English" },
      { value: "ru", label: "Русский" },
      { value: "kz", label: "Қазақша" },
    ],
    [],
  );

  function handleAuthSuccess(result: Awaited<ReturnType<typeof platformApi.login>>) {
    startTransition(() => {
      if (result.user?.roles.includes("admin")) {
        navigate("/admin");
        return;
      }

      navigate(result.user?.roles.includes("operator") ? "/operator" : "/profile");
    });
  }

  function beginVerification(challenge: AuthRegistrationChallenge) {
    setVerificationState(challenge);
    setVerificationCode("");
    setVerificationError("");
    setResendCooldown(challenge.resendAvailableInSeconds);
    setTab("register");
  }

  function resetVerificationStep() {
    setVerificationState(null);
    setVerificationCode("");
    setVerificationError("");
    setResendCooldown(0);
  }

  useEffect(() => {
    if (resendCooldown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setResendCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (currentUserQuery.data) {
      navigate("/profile", { replace: true });
    }
  }, [currentUserQuery.data, navigate]);

  const loginMutation = useMutation({
    mutationFn: platformApi.login,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      toast.success(t("auth.feedback.loginSuccess"));
      handleAuthSuccess(result);
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.data?.code === "email_not_verified") {
        const data = error.response.data as {
          registration_id?: string;
          email?: string;
          resend_available_in_seconds?: number;
        };
        beginVerification({
          status: "verification_required",
          registrationId: data.registration_id ?? "",
          email: data.email ?? loginForm.email,
          expiresInSeconds: 0,
          resendAvailableInSeconds: Number(data.resend_available_in_seconds ?? 0),
        });
        setRegisterForm((value) => ({ ...value, email: data.email ?? value.email }));
        toast.error(t("auth.verification.loginBlocked"));
        return;
      }

      toast.error(getErrorMessage(error));
    },
  });

  const registerMutation = useMutation({
    mutationFn: platformApi.register,
    onSuccess: (challenge) => {
      beginVerification(challenge);
      toast.success(t("auth.verification.codeSent"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const verifyMutation = useMutation({
    mutationFn: platformApi.verifyEmail,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      resetVerificationStep();
      toast.success(t("auth.verification.verified"));
      handleAuthSuccess(result);
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setVerificationError(message);
      toast.error(message);
    },
  });

  const resendMutation = useMutation({
    mutationFn: platformApi.resendVerification,
    onSuccess: (challenge) => {
      beginVerification(challenge);
      toast.success(t("auth.verification.resent"));
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      toast.error(message);
    },
  });

  return (
    <div className="page-stack auth-page">
      <div className="auth-shell">
        <div className="auth-header">
          <span className="page-header__eyebrow">
            {t(`auth.${authContentKey}.eyebrow`, {
              defaultValue: authHeaderDefaults[authContentKey].eyebrow,
            })}
          </span>
          <h1>
            {t(`auth.${authContentKey}.title`, {
              defaultValue: authHeaderDefaults[authContentKey].title,
            })}
          </h1>
          <p>
            {t(`auth.${authContentKey}.subtitle`, {
              defaultValue: authHeaderDefaults[authContentKey].subtitle,
            })}
          </p>
        </div>

        <Card className="auth-panel auth-panel--centered" hover={false}>
          <Tabs
            value={tab}
            onChange={(value) => {
              const nextTab = value as AuthTab;
              setTab(nextTab);
              if (nextTab !== "register") {
                resetVerificationStep();
              }
            }}
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
            verificationState ? (
              <div className="form-stack auth-verify">
                <div className="auth-verify__box">
                  <p className="auth-verify__title">{t("auth.verification.titleText")}</p>
                  <p>
                    {t("auth.verification.sentTo", {
                      email: verificationEmail,
                    })}
                  </p>
                  <p>{t("auth.verification.instructions")}</p>
                </div>
                <form
                  className="form-stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!verificationState) {
                      return;
                    }
                    setVerificationError("");
                    verifyMutation.mutate({
                      registrationId: verificationState.registrationId,
                      code: verificationCode.trim(),
                    });
                  }}
                >
                  <Input
                    label={t("auth.verification.code")}
                    icon={<KeyRound size={16} />}
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t("auth.verification.codePlaceholder")}
                    helper={
                      verificationState.expiresInSeconds > 0
                        ? t("auth.verification.expiresInMinutes", {
                            minutes: Math.max(1, Math.ceil(verificationState.expiresInSeconds / 60)),
                          })
                        : undefined
                    }
                    error={verificationError || undefined}
                    required
                  />
                  <Button type="submit" isLoading={verifyMutation.isPending} fullWidth>
                    {t("auth.verification.confirm")}
                  </Button>
                </form>
                <div className="auth-verify__actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (!verificationState) {
                        return;
                      }
                      resendMutation.mutate({ registrationId: verificationState.registrationId });
                    }}
                    disabled={resendCooldown > 0}
                    isLoading={resendMutation.isPending}
                    iconLeft={<RefreshCcw size={16} />}
                  >
                    {resendCooldown > 0
                      ? t("auth.verification.resendIn", { seconds: resendCooldown })
                      : t("auth.verification.resend")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={resetVerificationStep}>
                    {t("auth.verification.editEmail")}
                  </Button>
                </div>
              </div>
            ) : (
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
                  label={t("auth.fields.phone")}
                  type="tel"
                  icon={<Smartphone size={16} />}
                  value={registerForm.phone}
                  onChange={(event) => setRegisterForm((value) => ({ ...value, phone: event.target.value }))}
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
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Button type="submit" isLoading={registerMutation.isPending} fullWidth>
                  {t("common.register")}
                </Button>
              </form>
            )
          ) : null}

          {tab === "recover" ? (
            <div className="form-stack auth-recover">
              <div className="auth-recover__box">
                <p className="auth-recover__title">{t("auth.recoverNotice.title")}</p>
                <p>{t("auth.recoverNotice.body")}</p>
                <p>{t("auth.recoverNotice.hint")}</p>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
