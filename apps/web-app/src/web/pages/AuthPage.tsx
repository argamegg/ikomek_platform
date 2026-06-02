import axios from "axios";
import { startTransition, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Show, UserButton, useAuth, useUser } from "@clerk/react";
import { useSignIn } from "@clerk/react/legacy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { KeyRound, LockKeyhole, Mail, RefreshCcw, ShieldCheck, Smartphone, User2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { isClerkConfigured } from "../app/clerk";
import { Card } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Input";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";
import { applyLoggedInQueryState } from "../lib/querySession";
import type { AuthRegistrationChallenge, User } from "../../types/platform";

type AuthTab = "login" | "register" | "recover";
type RegisterForm = {
  name: string;
  email: string;
  phone: string;
  password: string;
  language: "en" | "ru" | "kz";
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecordString(record: unknown, key: string) {
  if (!isPlainRecord(record)) {
    return undefined;
  }

  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getClerkMetadataString(user: unknown, keys: string[]) {
  if (!isPlainRecord(user)) {
    return undefined;
  }

  for (const metadataKey of ["publicMetadata", "unsafeMetadata"]) {
    const metadata = user[metadataKey];
    for (const key of keys) {
      const value = getRecordString(metadata, key);
      if (value) {
        return value;
      }
    }
  }

  return undefined;
}

function getClerkPrimaryPhone(user: unknown) {
  if (!isPlainRecord(user)) {
    return undefined;
  }

  const primaryPhoneNumber = user.primaryPhoneNumber;
  return getRecordString(primaryPhoneNumber, "phoneNumber") ?? getRecordString(primaryPhoneNumber, "phone_number");
}

function navigateToUserHome(user: User | undefined, navigate: ReturnType<typeof useNavigate>, replace = false) {
  const roles = user?.roles ?? [];
  navigate(roles.includes("admin") ? "/admin" : roles.includes("operator") ? "/operator" : "/profile", {
    replace,
  });
}

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
  const requiresLocalPassword = currentUserQuery.data?.hasLocalPassword === false;
  const authContentKey = verificationState ? "verification" : tab === "recover" ? "recovery" : tab;
  const authHeaderDefaults = {
    login: {
      eyebrow: "Login",
      title: "Sign in to your existing iKOMEK account",
      subtitle:
        "Sign in to view your profile, requests, and chat history in one place.",
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
    if (currentUserQuery.data && currentUserQuery.data.hasLocalPassword !== false) {
      navigate("/profile", { replace: true });
    }
  }, [currentUserQuery.data, navigate]);

  const loginMutation = useMutation({
    mutationFn: platformApi.login,
    onSuccess: async (result) => {
      await applyLoggedInQueryState(queryClient, result.user);
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
      await applyLoggedInQueryState(queryClient, result.user);
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
        <section className="auth-header" aria-labelledby="auth-page-title">
          <span className="page-header__eyebrow">
            {t(`auth.${authContentKey}.eyebrow`, {
              defaultValue: authHeaderDefaults[authContentKey].eyebrow,
            })}
          </span>
          <h1 id="auth-page-title">
            {t(`auth.${authContentKey}.title`, {
              defaultValue: authHeaderDefaults[authContentKey].title,
            })}
          </h1>
          <p>
            {t(`auth.${authContentKey}.subtitle`, {
              defaultValue: authHeaderDefaults[authContentKey].subtitle,
            })}
          </p>
        </section>

        <Card className="auth-panel" hover={false}>
          {!requiresLocalPassword ? (
            <Tabs
              className="auth-tabs"
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
          ) : null}

          {!verificationState && (requiresLocalPassword || tab !== "recover") ? (
            <ClerkAuthSection currentUser={currentUserQuery.data} />
          ) : null}

          {!requiresLocalPassword && tab === "login" ? (
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                loginMutation.mutate(loginForm);
              }}
            >
              <Input
                label={t("auth.fields.emailOrPhone")}
                type="text"
                icon={<Mail size={16} />}
                value={loginForm.email}
                onChange={(event) => setLoginForm((value) => ({ ...value, email: event.target.value }))}
                autoComplete="username"
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

          {!requiresLocalPassword && tab === "register" ? (
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

          {!requiresLocalPassword && tab === "recover" ? (
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

function ClerkAuthSection({ currentUser }: { currentUser?: User | null }) {
  const { t } = useTranslation();

  if (!isClerkConfigured) {
    return (
      <div className="auth-clerk auth-clerk--setup">
        <p className="auth-clerk__title">{t("auth.clerk.title")}</p>
        <p>{t("auth.clerk.setupRequired")}</p>
        <div className="auth-clerk__actions">
          <button type="button" className="auth-clerk__button auth-clerk__button--google" disabled>
            <span className="auth-clerk__google-mark" aria-hidden="true">G</span>
            <span>{t("auth.clerk.google")}</span>
          </button>
        </div>
        <div className="auth-divider">
          <span>{t("auth.clerk.orLegacy")}</span>
        </div>
      </div>
    );
  }

  return <ConfiguredClerkAuthSection currentUser={currentUser} />;
}

function ConfiguredClerkAuthSection({ currentUser }: { currentUser?: User | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isLoaded, signIn } = useSignIn();
  const { getToken, isSignedIn } = useAuth();
  const { isLoaded: isClerkUserLoaded, user: clerkUser } = useUser();
  const [isClerkSubmitting, setIsClerkSubmitting] = useState(false);
  const [hasStartedClerkSync, setHasStartedClerkSync] = useState(false);
  const [syncedClerkUserId, setSyncedClerkUserId] = useState<string | null>(null);
  const [clerkError, setClerkError] = useState("");
  const [localPasswordForm, setLocalPasswordForm] = useState({ password: "", confirmPassword: "" });

  function getClerkErrorMessage(error: unknown) {
    const clerkApiError = error as {
      errors?: Array<{ longMessage?: string; message?: string }>;
    };
    const firstError = clerkApiError.errors?.[0];
    return firstError?.longMessage ?? firstError?.message ?? (error instanceof Error ? error.message : t("auth.clerk.genericError"));
  }

  const getClerkBackendErrorMessage = useCallback((error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      return t("auth.clerk.linkSecretRequired");
    }

    return getErrorMessage(error);
  }, [t]);

  async function handleGoogleSignIn() {
    if (!isLoaded || !signIn) {
      return;
    }

    setClerkError("");
    setIsClerkSubmitting(true);

    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/auth",
        oidcPrompt: "select_account",
      });
    } catch (error) {
      setClerkError(getClerkErrorMessage(error));
      setIsClerkSubmitting(false);
    }
  }

  const clerkLoginMutation = useMutation({
    mutationFn: platformApi.loginWithClerk,
    onSuccess: async (result) => {
      await applyLoggedInQueryState(queryClient, result.user);
      setSyncedClerkUserId(clerkUser?.id ?? null);
      setHasStartedClerkSync(false);

      if (result.user?.hasLocalPassword === false) {
        return;
      }

      toast.success(t("auth.feedback.loginSuccess"));
      navigateToUserHome(result.user, navigate, true);
    },
    onError: (error) => {
      setClerkError(getClerkBackendErrorMessage(error));
      setHasStartedClerkSync(false);
    },
  });

  const localPasswordMutation = useMutation({
    mutationFn: platformApi.setLocalPassword,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(queryKeys.currentUser, updatedUser);
      setLocalPasswordForm({ password: "", confirmPassword: "" });
      toast.success(t("auth.clerk.localPasswordSaved"));
      navigateToUserHome(updatedUser, navigate, true);
    },
    onError: (error) => {
      setClerkError(getClerkBackendErrorMessage(error));
    },
  });

  function submitLocalPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClerkError("");

    if (!localPasswordForm.password || !localPasswordForm.confirmPassword) {
      setClerkError(t("auth.clerk.localPasswordFillAll"));
      return;
    }

    if (localPasswordForm.password.length < 6) {
      setClerkError(t("auth.clerk.localPasswordMin"));
      return;
    }

    if (localPasswordForm.password !== localPasswordForm.confirmPassword) {
      setClerkError(t("auth.clerk.localPasswordMismatch"));
      return;
    }

    localPasswordMutation.mutate({ newPassword: localPasswordForm.password });
  }

  const needsLocalPassword =
    currentUser?.hasLocalPassword === false || clerkLoginMutation.data?.user?.hasLocalPassword === false;

  useEffect(() => {
    if (
      !isSignedIn ||
      !isClerkUserLoaded ||
      !clerkUser ||
      hasStartedClerkSync ||
      clerkLoginMutation.isPending ||
      needsLocalPassword ||
      syncedClerkUserId === clerkUser.id
    ) {
      return;
    }

    setHasStartedClerkSync(true);
    setClerkError("");

    void getToken()
      .then((token) => {
        if (!token) {
          throw new Error(t("auth.clerk.missingToken"));
        }

        return clerkLoginMutation.mutateAsync({
          token,
          email: clerkUser.primaryEmailAddress?.emailAddress,
          fullName: clerkUser.fullName ?? clerkUser.username ?? undefined,
          phone: getClerkPrimaryPhone(clerkUser),
          gender: getClerkMetadataString(clerkUser, ["gender", "sex"]),
          birthDate: getClerkMetadataString(clerkUser, ["birthDate", "birth_date", "birthday", "date_of_birth"]),
          avatarUrl: clerkUser.imageUrl,
        });
      })
      .catch((error) => {
        setClerkError(getClerkBackendErrorMessage(error));
        setHasStartedClerkSync(false);
      });
  }, [
    clerkLoginMutation,
    clerkUser,
    getToken,
    getClerkBackendErrorMessage,
    hasStartedClerkSync,
    isClerkUserLoaded,
    isSignedIn,
    needsLocalPassword,
    syncedClerkUserId,
    t,
  ]);

  return (
    <div className="auth-clerk">
      <Show when="signed-out">
        <p className="auth-clerk__title">{t("auth.clerk.title")}</p>
        <p>{t("auth.clerk.subtitle")}</p>
        <div className="auth-clerk__actions">
          <button
            type="button"
            className="auth-clerk__button auth-clerk__button--google"
            onClick={handleGoogleSignIn}
            disabled={!isLoaded || isClerkSubmitting}
          >
            <span className="auth-clerk__google-mark" aria-hidden="true">G</span>
            <span>{t("auth.clerk.google")}</span>
          </button>
        </div>
        {clerkError ? <p className="auth-clerk__error">{clerkError}</p> : null}
        <div className="auth-divider">
          <span>{t("auth.clerk.orLegacy")}</span>
        </div>
      </Show>

      <Show when="signed-in">
        {needsLocalPassword ? (
          <form className="auth-local-password" onSubmit={submitLocalPassword}>
            <div className="auth-clerk__signed-in">
              <UserButton />
              <div>
                <p className="auth-clerk__title">{t("auth.clerk.localPasswordTitle")}</p>
                <p>{t("auth.clerk.localPasswordHint")}</p>
              </div>
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <Input
              label={t("auth.clerk.localPassword")}
              type="password"
              icon={<LockKeyhole size={16} />}
              value={localPasswordForm.password}
              onChange={(event) => setLocalPasswordForm((value) => ({ ...value, password: event.target.value }))}
              autoComplete="new-password"
              required
            />
            <Input
              label={t("auth.clerk.localPasswordConfirm")}
              type="password"
              icon={<LockKeyhole size={16} />}
              value={localPasswordForm.confirmPassword}
              onChange={(event) =>
                setLocalPasswordForm((value) => ({ ...value, confirmPassword: event.target.value }))
              }
              autoComplete="new-password"
              required
            />
            <Button type="submit" fullWidth isLoading={localPasswordMutation.isPending}>
              {t("auth.clerk.localPasswordSave")}
            </Button>
          </form>
        ) : (
          <div className="auth-clerk__signed-in">
            <UserButton />
            <div>
              <p className="auth-clerk__title">{t("auth.clerk.signedInTitle")}</p>
              <p>
                {clerkLoginMutation.isPending || hasStartedClerkSync
                  ? t("auth.clerk.syncing")
                  : t("auth.clerk.signedInHint")}
              </p>
            </div>
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
        )}
        {clerkError ? <p className="auth-clerk__error">{clerkError}</p> : null}
      </Show>
    </div>
  );
}
