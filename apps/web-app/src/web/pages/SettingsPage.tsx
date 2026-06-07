import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, Globe2, HelpCircle, KeyRound, Pencil, SettingsIcon, ShieldCheck } from "lucide-react";
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
type FaqAudience = "citizen" | "staff";
type FaqItem = {
  question: string;
  answer: string;
};

const languageOptions: Array<{ value: Locale; label: string; hint: string }> = [
  { value: "ru", label: "Русский", hint: "RU" },
  { value: "kz", label: "Қазақша", hint: "KZ" },
  { value: "en", label: "English", hint: "EN" },
];

const faqCopy: Record<Locale, { title: string; description: string }> = {
  ru: {
    title: "FAQ",
    description: "Ответы на частые вопросы по вашей роли в iKOMEK 109.",
  },
  kz: {
    title: "FAQ",
    description: "iKOMEK 109 жүйесіндегі рөліңіз бойынша жиі қойылатын сұрақтарға жауаптар.",
  },
  en: {
    title: "FAQ",
    description: "Answers to common iKOMEK 109 questions for your role.",
  },
};

const faqItems: Record<FaqAudience, Record<Locale, FaqItem[]>> = {
  citizen: {
    ru: [
      {
        question: "Как создать обращение?",
        answer: "Откройте «Создать заявку», выберите категорию, укажите адрес на карте, добавьте описание и фото при необходимости.",
      },
      {
        question: "Как отследить статус?",
        answer: "Раздел «Мои заявки» показывает все обращения и статусы: ожидает, в работе или закрыто.",
      },
      {
        question: "Где написать оператору?",
        answer: "Откройте карточку заявки и перейдите в чат. Там сохраняется вся переписка по обращению.",
      },
      {
        question: "Можно ли подать обращение вне Астаны?",
        answer: "Нет, платформа принимает обращения только в зоне обслуживания iKOMEK 109: Астана и ближайшая городская зона.",
      },
    ],
    kz: [
      {
        question: "Өтінішті қалай жасауға болады?",
        answer: "«Өтініш жасау» бөлімін ашып, санатты таңдаңыз, картадан мекенжайды көрсетіңіз, сипаттама және қажет болса фото қосыңыз.",
      },
      {
        question: "Мәртебені қалай бақылауға болады?",
        answer: "«Менің өтініштерім» бөлімінде барлық өтініштер және олардың мәртебелері көрсетіледі: күтуде, жұмыста немесе жабық.",
      },
      {
        question: "Операторға қайдан жазамын?",
        answer: "Өтініш карточкасын ашып, чатқа өтіңіз. Өтініш бойынша барлық хат алмасу сол жерде сақталады.",
      },
      {
        question: "Астанадан тыс өтініш беруге бола ма?",
        answer: "Жоқ, платформа тек iKOMEK 109 қызмет көрсету аймағында: Астана және жақын қалалық аймақта өтініш қабылдайды.",
      },
    ],
    en: [
      {
        question: "How do I create a request?",
        answer: "Open New request, choose a category, set the address on the map, then add a description and photos if needed.",
      },
      {
        question: "How can I track status?",
        answer: "My requests shows all your submissions and their statuses: pending, in progress, or closed.",
      },
      {
        question: "Where can I message an operator?",
        answer: "Open the request card and go to chat. The full conversation stays attached to that request.",
      },
      {
        question: "Can I submit a request outside Astana?",
        answer: "No. The platform accepts requests only in the iKOMEK 109 service zone: Astana and nearby city areas.",
      },
    ],
  },
  staff: {
    ru: [
      {
        question: "Где обрабатывать обращения?",
        answer: "Операторская панель содержит очередь, фильтры, детали заявки и действия для обновления статуса.",
      },
      {
        question: "Что увидит гражданин после обновления?",
        answer: "Гражданин увидит новый статус, публичные комментарии и сообщения в чате своей заявки.",
      },
      {
        question: "Где смотреть аналитику?",
        answer: "Администраторский раздел показывает общие метрики, категории, динамику обращений и нагрузку операторов.",
      },
      {
        question: "Как публиковать новости?",
        answer: "В админ-разделе можно создать новость, выбрать тип, период, локацию и при необходимости отредактировать переводы.",
      },
    ],
    kz: [
      {
        question: "Өтініштер қайда өңделеді?",
        answer: "Оператор панелінде кезек, сүзгілер, өтініш мәліметтері және мәртебені жаңарту әрекеттері бар.",
      },
      {
        question: "Жаңартудан кейін тұрғын не көреді?",
        answer: "Тұрғын жаңа мәртебені, жария түсініктемелерді және өз өтінішінің чатындағы хабарламаларды көреді.",
      },
      {
        question: "Аналитиканы қайдан көремін?",
        answer: "Админ бөлімі жалпы метрикаларды, санаттарды, өтініш динамикасын және операторлар жүктемесін көрсетеді.",
      },
      {
        question: "Жаңалық қалай жарияланады?",
        answer: "Админ бөлімінде жаңалық жасап, түрін, кезеңін, локациясын таңдап, қажет болса аудармаларын түзете аласыз.",
      },
    ],
    en: [
      {
        question: "Where are requests processed?",
        answer: "The operator dashboard contains the queue, filters, request details, and status update actions.",
      },
      {
        question: "What does the citizen see after an update?",
        answer: "The citizen sees the new status, public notes, and chat messages for their request.",
      },
      {
        question: "Where can analytics be viewed?",
        answer: "The admin area shows platform metrics, categories, request trends, and operator workload.",
      },
      {
        question: "How are news posts published?",
        answer: "In the admin area, create a news item, select type, period, location, and edit translations if needed.",
      },
    ],
  },
};

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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

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
    mutationFn: async () => {
      if (currentUser?.hasLocalPassword === false) {
        return platformApi.setLocalPassword({ newPassword: passwordForm.newPassword });
      }

      await platformApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      return null;
    },
    onSuccess: (updatedUser) => {
      if (updatedUser) {
        queryClient.setQueryData(queryKeys.currentUser, updatedUser);
      }
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setIsPasswordVisible(false);
      toast.success(t("settings.passwordSaved"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const needsCurrentPassword = currentUser?.hasLocalPassword !== false;
    if ((needsCurrentPassword && !passwordForm.currentPassword) || !passwordForm.newPassword || !passwordForm.confirmPassword) {
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

    passwordMutation.mutate();
  }

  const passwordInputType = isPasswordVisible ? "text" : "password";
  const passwordVisibilityLabel = isPasswordVisible ? "Hide password" : "Show password";
  const activeLocale = normalizeLocale(i18n.language);
  const activeFaqCopy = faqCopy[activeLocale];
  const faqAudience: FaqAudience =
    currentUser?.roles.includes("operator") || currentUser?.roles.includes("admin") ? "staff" : "citizen";
  const activeFaqItems = faqItems[faqAudience][activeLocale];

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
              <p>
                {currentUser?.hasLocalPassword === false
                  ? t("settings.passwordSetupDescription")
                  : t("settings.passwordDescription")}
              </p>
            </div>
          </div>

          <form className="settings-form" onSubmit={submitPassword}>
            {currentUser?.hasLocalPassword !== false ? (
              <label>
                <span>{t("settings.currentPassword")}</span>
                <div className="settings-password-field">
                  <input
                    type={passwordInputType}
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="settings-password-toggle"
                    aria-label={passwordVisibilityLabel}
                    onClick={() => setIsPasswordVisible((value) => !value)}
                  >
                    {isPasswordVisible ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </label>
            ) : null}
            <label>
              <span>{t("settings.newPassword")}</span>
              <div className="settings-password-field">
                <input
                  type={passwordInputType}
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="settings-password-toggle"
                  aria-label={passwordVisibilityLabel}
                  onClick={() => setIsPasswordVisible((value) => !value)}
                >
                  {isPasswordVisible ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </label>
            <label>
              <span>{t("settings.confirmPassword")}</span>
              <div className="settings-password-field">
                <input
                  type={passwordInputType}
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="settings-password-toggle"
                  aria-label={passwordVisibilityLabel}
                  onClick={() => setIsPasswordVisible((value) => !value)}
                >
                  {isPasswordVisible ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
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

        <section className="settings-card settings-card--faq">
          <div className="settings-card__header">
            <span className="settings-card__icon settings-card__icon--gray">
              <HelpCircle size={20} />
            </span>
            <div>
              <h2>{activeFaqCopy.title}</h2>
              <p>{activeFaqCopy.description}</p>
            </div>
          </div>

          <div className="settings-faq-list">
            {activeFaqItems.map((item) => (
              <details key={item.question} className="settings-faq-item">
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
