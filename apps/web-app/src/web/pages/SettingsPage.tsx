import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, Globe2, KeyRound, Pencil, SettingsIcon, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { Locale } from "../../types/platform";
import { Button } from "../components/ui/Button";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";
import { session } from "../lib/session";

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const languageOptions: Array<{ value: Locale; label: string; hint: string }> = [
  { value: "ru", label: "Русский", hint: "RU" },
  { value: "kz", label: "Қазақша", hint: "KZ" },
  { value: "en", label: "English", hint: "EN" },
];

function normalizeLocale(locale: string): Locale {
  if (locale.startsWith("kz") || locale.startsWith("kk")) return "kz";
  if (locale.startsWith("en")) return "en";
  return "ru";
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });
  const currentUser = currentUserQuery.data;
  const [selectedLanguage, setSelectedLanguage] = useState<Locale>(() => normalizeLocale(i18n.language));
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    setSelectedLanguage(normalizeLocale(i18n.language));
  }, [i18n.language]);

  const languageMutation = useMutation({
    mutationFn: platformApi.updateLanguage,
    onSuccess: async (updatedUser, language) => {
      queryClient.setQueryData(queryKeys.currentUser, updatedUser);
      session.setLocale(language);
      await i18n.changeLanguage(language);
      toast.success(t("settings.languageSaved"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const passwordMutation = useMutation({
    mutationFn: platformApi.changePassword,
    onSuccess: () => {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success(t("settings.passwordSaved"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error(t("settings.passwordFillAll"));
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error(t("settings.passwordMin"));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t("settings.passwordMismatch"));
      return;
    }

    passwordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  }

  return (
    <motion.div
      className="settings-page"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <section className="settings-hero">
        <div className="settings-hero__icon">
          <SettingsIcon size={28} />
        </div>
        <div>
          <p className="cabinet-kicker">iKOMEK 109</p>
          <h1>{t("settings.title")}</h1>
          <p>{t("settings.subtitle")}</p>
        </div>
      </section>

      <div className="settings-grid">
        <section className="settings-card settings-card--profile">
          <div className="settings-card__header">
            <span className="settings-card__icon settings-card__icon--orange">
              <Pencil size={20} />
            </span>
            <div>
              <h2>{t("settings.profileTitle")}</h2>
              <p>{t("settings.profileDescription")}</p>
            </div>
          </div>

          <div className="settings-profile-preview">
            <div className="settings-profile-preview__avatar">
              {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : (currentUser?.name ?? "IK").split(" ").map((part) => part[0]).join("").slice(0, 2)}
            </div>
            <div>
              <strong>{currentUser?.name}</strong>
              <span>{currentUser?.email}</span>
            </div>
          </div>

          <Button type="button" fullWidth iconLeft={<Pencil size={16} />} onClick={() => navigate("/profile")}>
            {t("settings.editProfile")}
          </Button>
        </section>

        <section className="settings-card">
          <div className="settings-card__header">
            <span className="settings-card__icon settings-card__icon--blue">
              <KeyRound size={20} />
            </span>
            <div>
              <h2>{t("settings.passwordTitle")}</h2>
              <p>{t("settings.passwordDescription")}</p>
            </div>
          </div>

          <form className="settings-form" onSubmit={submitPassword}>
            <label>
              <span>{t("settings.currentPassword")}</span>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                autoComplete="current-password"
              />
            </label>
            <label>
              <span>{t("settings.newPassword")}</span>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                autoComplete="new-password"
              />
            </label>
            <label>
              <span>{t("settings.confirmPassword")}</span>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                autoComplete="new-password"
              />
            </label>
            <Button type="submit" isLoading={passwordMutation.isPending} iconLeft={<ShieldCheck size={16} />}>
              {t("settings.savePassword")}
            </Button>
          </form>
        </section>

        <section className="settings-card">
          <div className="settings-card__header">
            <span className="settings-card__icon settings-card__icon--green">
              <Globe2 size={20} />
            </span>
            <div>
              <h2>{t("settings.languageTitle")}</h2>
              <p>{t("settings.languageDescription")}</p>
            </div>
          </div>

          <div className="settings-language-list">
            {languageOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={selectedLanguage === option.value ? "is-active" : ""}
                onClick={() => setSelectedLanguage(option.value)}
              >
                <span>{option.label}</span>
                <small>{option.hint}</small>
                {selectedLanguage === option.value ? <CheckCircle2 size={18} /> : null}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            isLoading={languageMutation.isPending}
            onClick={() => languageMutation.mutate(selectedLanguage)}
          >
            {t("settings.saveLanguage")}
          </Button>
        </section>
      </div>
    </motion.div>
  );
}
