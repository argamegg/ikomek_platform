import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, FileText, Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Locale, OperatorStats as OperatorStatsData, RequestStatus } from "../types/platform";
import { EmptyState } from "../web/components/ui/EmptyState";
import { Badge } from "../web/components/ui/Badge";
import { formatDate, getStatusTone } from "../web/lib/format";
import { localizeRequestStatus } from "../web/lib/requestMeta";
import { platformApi, queryKeys } from "../web/services/platformApi";

const ACCENT = "#ff6b35";

type OperatorStatCard = {
  key: string;
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

function formatMonthLabel(month: string, locale: Locale, format: "short" | "long") {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  if (Number.isNaN(date.getTime())) return month;

  return new Intl.DateTimeFormat(locale, {
    month: format,
    year: format === "long" ? "numeric" : undefined,
  }).format(date);
}

function statusIcon(status: RequestStatus) {
  if (status === "closed") return <CheckCircle2 size={18} />;
  if (status === "in_progress") return <Radio size={18} />;
  return <Clock3 size={18} />;
}

function buildStatCards(stats: OperatorStatsData, t: (key: string) => string): OperatorStatCard[] {
  return [
    {
      key: "assigned",
      label: t("operator.stats.assigned"),
      value: stats.totalAssigned,
      icon: <FileText size={22} />,
      tone: "orange",
    },
    {
      key: "closed",
      label: t("operator.stats.closed"),
      value: stats.closed,
      icon: <CheckCircle2 size={22} />,
      tone: "green",
    },
    {
      key: "inProgress",
      label: t("operator.stats.inProgress"),
      value: stats.inProgress,
      icon: <Radio size={22} />,
      tone: "blue",
    },
    {
      key: "queue",
      label: t("operator.stats.queue"),
      value: stats.pendingQueue,
      icon: <Clock3 size={22} />,
      tone: "amber",
    },
  ];
}

export function OperatorStats() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = normalizeLocale(i18n.language);

  const statsQuery = useQuery({
    queryKey: queryKeys.operatorStats,
    queryFn: platformApi.getOperatorStats,
  });

  const stats = statsQuery.data;
  const statCards = useMemo(() => stats ? buildStatCards(stats, t) : [], [stats, t]);
  const chartData = useMemo(
    () =>
      (stats?.monthlyActivity ?? []).map((item) => ({
        ...item,
        label: formatMonthLabel(item.month, locale, "short"),
        tooltipLabel: formatMonthLabel(item.month, locale, "long"),
      })),
    [locale, stats?.monthlyActivity],
  );

  if (statsQuery.isLoading) {
    return <div className="cabinet-skeleton cabinet-skeleton--main" />;
  }

  if (!stats) {
    return (
      <section className="cabinet-section">
        <EmptyState title={t("operator.stats.title")} description={t("common.empty")} />
      </section>
    );
  }

  return (
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
            <h2>{t("operator.stats.title")}</h2>
          </div>
          <Clock3 size={22} />
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
            {t("operator.stats.avgDays")}: <strong>{stats.avgCloseDays}</strong> {t("operator.stats.days")}
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
          <h2>{t("operator.activity.title")}</h2>
        </div>
        <div className="cabinet-chart">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.22)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(255, 107, 53, 0.08)" }}
                contentStyle={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)" }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel ?? ""}
                formatter={(value) => [value, t("operator.stats.assigned")]}
              />
              <Bar dataKey="count" fill={ACCENT} radius={[10, 10, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      <motion.section className="cabinet-section" variants={sectionVariants} initial="hidden" animate="visible">
        <div className="cabinet-section__header">
          <h2>{t("operator.recent.title")}</h2>
        </div>

        {stats.recentRequests.length ? (
          <div className="cabinet-recent-list">
            {stats.recentRequests.map((request) => (
              <motion.button
                type="button"
                key={request.id}
                className="cabinet-recent-item"
                variants={cardVariants}
                onClick={() => navigate(`/requests/${request.id}`)}
              >
                <span className="cabinet-recent-item__icon">{statusIcon(request.status)}</span>
                <span className="cabinet-recent-item__content">
                  <strong>{request.categoryName || t("requestDetails.title")}</strong>
                  <small className="cabinet-recent-item__meta-line">📍 {request.address}</small>
                  <small className="cabinet-recent-item__meta-line">🕐 {formatDate(request.updatedAt || request.createdAt, locale)}</small>
                  <small className="cabinet-recent-item__meta-line">
                    💬 {t("cabinet.recent.category")}: {request.categoryName || "—"}
                  </small>
                </span>
                <Badge tone={getStatusTone(request.status)}>
                  {localizeRequestStatus(request.status, t)}
                </Badge>
              </motion.button>
            ))}
          </div>
        ) : (
          <EmptyState title={t("operator.recent.title")} description={t("common.empty")} />
        )}
      </motion.section>
    </>
  );
}
