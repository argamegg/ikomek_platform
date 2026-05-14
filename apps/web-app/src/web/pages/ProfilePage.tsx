import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  LogOut,
  MapPinned,
  Pencil,
  Plus,
  Radio,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { CivicRequest, Locale, RequestStatus, UserRole } from "../../types/platform";
import { AdminStats } from "../../components/AdminStats";
import { OperatorStats } from "../../components/OperatorStats";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { formatDate, getStatusTone } from "../lib/format";
import { localizeRequestProblemType, localizeRequestStatus } from "../lib/requestMeta";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";

const ACCENT = "#ff6b35";
const MONTH_WINDOW = 6;

type StatKey = "total" | "closed" | "inProgress" | "pending";

type StatCard = {
  key: StatKey;
  label: string;
  value: number;
  icon: ReactNode;
  tone: "orange" | "green" | "blue" | "amber";
};

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
};

function normalizeLocale(locale: string): Locale {
  if (locale.startsWith("kz") || locale.startsWith("kk")) return "kz";
  if (locale.startsWith("ru")) return "ru";
  return "en";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getAverageClosingDays(requests: CivicRequest[]) {
  const closedDurations = requests
    .filter((request) => request.status === "closed")
    .map((request) => {
      const created = new Date(request.createdAt).getTime();
      const updated = new Date(request.updatedAt).getTime();
      return Number.isFinite(created) && Number.isFinite(updated) ? Math.max(updated - created, 0) : null;
    })
    .filter((value): value is number => value !== null);

  if (!closedDurations.length) return 0;

  const averageMs = closedDurations.reduce((sum, value) => sum + value, 0) / closedDurations.length;
  return Math.round((averageMs / 86_400_000) * 10) / 10;
}

function useAnimatedNumber(value: number) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 720;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      setDisplayValue(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return displayValue;
}

function AnimatedStatNumber({ value }: { value: number }) {
  const animatedValue = useAnimatedNumber(value);
  return <strong>{animatedValue}</strong>;
}

function buildMonthlyActivity(requests: CivicRequest[], locale: Locale, t: (key: string) => string) {
  const now = new Date();
  const months = Array.from({ length: MONTH_WINDOW }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (MONTH_WINDOW - 1 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
    return {
      key,
      month: new Intl.DateTimeFormat(locale, { month: "short" }).format(date),
      count: 0,
      tooltipLabel: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date),
    };
  });

  requests.forEach((request) => {
    const date = new Date(request.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
    const item = months.find((month) => month.key === key);
    if (item) {
      item.count += 1;
    }
  });

  return months.map((month) => ({
    ...month,
    requestsLabel: t("cabinet.stats.total"),
  }));
}

function formatMemberSince(value: string | undefined, fallback: string | undefined, locale: Locale) {
  const rawValue = value || fallback;
  if (!rawValue) return "—";

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
}

function statusIcon(status: RequestStatus) {
  if (status === "closed") return <CheckCircle2 size={18} />;
  if (status === "in_progress") return <Radio size={18} />;
  return <Clock3 size={18} />;
}

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const locale = normalizeLocale(i18n.language);

  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });
  const myRequestsQuery = useQuery({
    queryKey: [...queryKeys.myRequests, i18n.language],
    queryFn: platformApi.getMyRequests,
  });
  const savedLocationsQuery = useQuery({
    queryKey: queryKeys.savedLocations,
    queryFn: platformApi.getSavedLocations,
  });

  const currentUser = currentUserQuery.data;
  const requests = myRequestsQuery.data ?? [];
  const isLoading = currentUserQuery.isLoading || myRequestsQuery.isLoading;
  const savedLocations = savedLocationsQuery.data ?? [];

  const stats = useMemo(() => {
    const closed = requests.filter((request) => request.status === "closed").length;
    const inProgress = requests.filter((request) => request.status === "in_progress").length;
    const pending = requests.filter((request) => request.status === "pending").length;

    return {
      total: requests.length,
      closed,
      inProgress,
      pending,
      averageClosingDays: getAverageClosingDays(requests),
    };
  }, [requests]);

  const statCards: StatCard[] = [
    {
      key: "total",
      label: t("cabinet.stats.total"),
      value: stats.total,
      icon: <FileText size={22} />,
      tone: "orange",
    },
    {
      key: "closed",
      label: t("cabinet.stats.closed"),
      value: stats.closed,
      icon: <CheckCircle2 size={22} />,
      tone: "green",
    },
    {
      key: "inProgress",
      label: t("cabinet.stats.inProgress"),
      value: stats.inProgress,
      icon: <Radio size={22} />,
      tone: "blue",
    },
    {
      key: "pending",
      label: t("cabinet.stats.pending"),
      value: stats.pending,
      icon: <Clock3 size={22} />,
      tone: "amber",
    },
  ];

  const chartData = useMemo(
    () => buildMonthlyActivity(requests, locale, t),
    [locale, requests, t],
  );
  const recentRequests = useMemo(
    () => [...requests]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5),
    [requests],
  );
  const memberSince = formatMemberSince(currentUser?.createdAt, requests.at(-1)?.createdAt, locale);
  const userRoleLabel = currentUser ? t(`roles.${currentUser.primaryRole}`, currentUser.primaryRole) : "";

  async function handleLogout() {
    try {
      await platformApi.logout();
      await queryClient.invalidateQueries();
      navigate("/auth");
      toast.success(t("cabinet.logout"));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return (
      <div className="cabinet-page">
        <div className="cabinet-skeleton cabinet-skeleton--profile" />
        <div className="cabinet-skeleton cabinet-skeleton--main" />
      </div>
    );
  }

  return (
    <div className="cabinet-page">
      <motion.section
        className="cabinet-profile-card"
        initial={{ opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.32 }}
      >
        <div className="cabinet-profile-card__top">
          <div className="cabinet-avatar" aria-hidden="true">
            {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : getInitials(currentUser?.name ?? "IK")}
          </div>
          <p className="cabinet-kicker">{t("cabinet.title")}</p>
          <h1>{currentUser?.name}</h1>
          <span>{currentUser?.email}</span>
        </div>

        <div className="cabinet-profile-meta">
          <div>
            <span>{t("cabinet.memberSince")}</span>
            <strong>{memberSince}</strong>
          </div>
          <Badge tone={getRoleTone(currentUser?.primaryRole)}>{userRoleLabel}</Badge>
        </div>

        <Button
          type="button"
          variant="secondary"
          fullWidth
          iconLeft={<Pencil size={16} />}
          onClick={() => toast(t("cabinet.comingSoon"))}
        >
          {t("cabinet.editProfile")}
        </Button>

        <Button
          type="button"
          variant="ghost"
          fullWidth
          className="cabinet-logout"
          iconLeft={<LogOut size={16} />}
          onClick={() => void handleLogout()}
        >
          {t("cabinet.logout")}
        </Button>
      </motion.section>

      <div className="cabinet-main">
        {currentUser?.primaryRole === "admin" ? (
          <AdminStats />
        ) : currentUser?.primaryRole === "operator" ? (
          <OperatorStats />
        ) : (
          <>
        <motion.section
          className="cabinet-section"
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="cabinet-section__header">
            <div>
              <p className="cabinet-kicker">{t("cabinet.title")}</p>
              <h2>{t("cabinet.stats.title")}</h2>
            </div>
            <CalendarClock size={22} />
          </div>

          <div className="cabinet-stats-grid">
            {statCards.map((stat) => (
              <motion.article
                key={stat.key}
                className={`cabinet-stat-card cabinet-stat-card--${stat.tone}`}
                variants={cardVariants}
                whileHover={{ y: -2, boxShadow: "0 20px 38px rgba(15, 23, 42, 0.12)" }}
              >
                <div className="cabinet-stat-card__icon">{stat.icon}</div>
                <span>{stat.label}</span>
                <AnimatedStatNumber value={stat.value} />
              </motion.article>
            ))}
          </div>

          <motion.div className="cabinet-average" variants={cardVariants}>
            <Clock3 size={18} />
            <span>
              {t("cabinet.stats.avgDays")}: <strong>{stats.averageClosingDays}</strong> {t("cabinet.stats.days")}
            </span>
          </motion.div>
        </motion.section>

        <motion.section
          className="cabinet-section cabinet-section--chart"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.32 }}
        >
          <div className="cabinet-section__header">
            <h2>{t("cabinet.activity.title")}</h2>
          </div>
          <div className="cabinet-chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.22)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(255, 107, 53, 0.08)" }}
                  contentStyle={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)" }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel ?? ""}
                  formatter={(value) => [value, t("cabinet.stats.total")]}
                />
                <Bar dataKey="count" fill={ACCENT} radius={[10, 10, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section className="cabinet-section" variants={sectionVariants} initial="hidden" animate="visible">
          <div className="cabinet-section__header">
            <h2>{t("cabinet.recent.title")}</h2>
            {recentRequests.length ? <Link to="/requests">{t("cabinet.recent.all")}</Link> : null}
          </div>

          {recentRequests.length ? (
            <div className="cabinet-recent-list">
              {recentRequests.map((request) => (
                <motion.button
                  type="button"
                  key={request.id}
                  className="cabinet-recent-item"
                  variants={cardVariants}
                  onClick={() => navigate(`/requests/${request.id}`)}
                >
                  <span className="cabinet-recent-item__icon">{statusIcon(request.status)}</span>
                  <span className="cabinet-recent-item__content">
                    <strong>{localizeRequestProblemType(request.categoryId || request.categoryName, request.title, t)}</strong>
                    <small className="cabinet-recent-item__meta-line">📍 {request.address}</small>
                    <small className="cabinet-recent-item__meta-line">🕐 {formatDate(request.createdAt, locale)}</small>
                    <small className="cabinet-recent-item__meta-line">
                      💬 {t("cabinet.recent.category")}: {request.categoryName || localizeRequestProblemType(request.categoryId, request.title, t)}
                    </small>
                  </span>
                  <Badge tone={getStatusTone(request.status)}>
                    {localizeRequestStatus(request.statusLabel || request.status, t)}
                  </Badge>
                </motion.button>
              ))}
            </div>
          ) : (
            <EmptyState
              title={t("cabinet.recent.title")}
              description={t("common.empty")}
              action={
                <Link to="/requests/new">
                  <Button iconLeft={<Plus size={16} />}>{t("newRequest.title")}</Button>
                </Link>
              }
            />
          )}
        </motion.section>

        <motion.section className="cabinet-section" variants={sectionVariants} initial="hidden" animate="visible">
          <div className="cabinet-section__header">
            <div>
              <p className="cabinet-kicker">{t("profile.title")}</p>
              <h2>{t("cabinet.saved.title")}</h2>
            </div>
            <MapPinned size={22} />
          </div>

          {savedLocations.length ? (
            <div className="cabinet-saved-grid">
              {savedLocations.slice(0, 6).map((location) => (
                <motion.article key={location.id} className="cabinet-saved-card" variants={cardVariants}>
                  <strong>{location.label}</strong>
                  <p>{location.address}</p>
                </motion.article>
              ))}
            </div>
          ) : (
            <EmptyState title={t("cabinet.saved.title")} description={t("cabinet.saved.empty")} />
          )}
        </motion.section>

          </>
        )}
      </div>
    </div>
  );
}

function getRoleTone(role: UserRole | undefined) {
  if (role === "admin") return "danger";
  if (role === "operator") return "info";
  return "warning";
}
