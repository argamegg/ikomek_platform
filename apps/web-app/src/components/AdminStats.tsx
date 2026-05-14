import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, FileText, Users, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminPlatformStats, Locale } from "../types/platform";
import { getCategoryName } from "../utils/categoryUtils";
import { EmptyState } from "../web/components/ui/EmptyState";
import { platformApi, queryKeys } from "../web/services/platformApi";

const ACCENT = "#ff6b35";

type AdminStatCard = {
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

function buildStatCards(stats: AdminPlatformStats, t: (key: string) => string): AdminStatCard[] {
  return [
    {
      key: "totalRequests",
      label: t("admin.stats.totalRequests"),
      value: stats.totalRequests,
      icon: <FileText size={22} />,
      tone: "orange",
    },
    {
      key: "citizens",
      label: t("admin.stats.citizens"),
      value: stats.totalUsers,
      icon: <Users size={22} />,
      tone: "blue",
    },
    {
      key: "operators",
      label: t("admin.stats.operators"),
      value: stats.totalOperators,
      icon: <Wrench size={22} />,
      tone: "amber",
    },
    {
      key: "closed",
      label: t("admin.stats.closed"),
      value: stats.closed,
      icon: <CheckCircle2 size={22} />,
      tone: "green",
    },
  ];
}

export function AdminStats() {
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);

  const statsQuery = useQuery({
    queryKey: queryKeys.adminStats,
    queryFn: platformApi.getAdminStats,
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: platformApi.getCategories,
  });

  const stats = statsQuery.data;
  const categories = categoriesQuery.data ?? [];
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
  const maxCategoryCount = Math.max(...(stats?.topCategories ?? []).map((category) => category.count), 1);

  if (statsQuery.isLoading) {
    return <div className="cabinet-skeleton cabinet-skeleton--main" />;
  }

  if (!stats) {
    return (
      <section className="cabinet-section">
        <EmptyState title={t("admin.stats.title")} description={t("common.empty")} />
      </section>
    );
  }

  return (
    <>
      <motion.section className="cabinet-section" variants={sectionVariants} initial="hidden" animate="visible">
        <div className="cabinet-section__header">
          <div>
            <p className="cabinet-kicker">{t("cabinet.title")}</p>
            <h2>{t("admin.stats.title")}</h2>
          </div>
          <FileText size={22} />
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
      </motion.section>

      <motion.section
        className="cabinet-section cabinet-section--chart"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.32 }}
      >
        <div className="cabinet-section__header">
          <h2>{t("admin.activity.title")}</h2>
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
                formatter={(value) => [value, t("admin.stats.totalRequests")]}
              />
              <Bar dataKey="count" fill={ACCENT} radius={[10, 10, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      <motion.section className="cabinet-section" variants={sectionVariants} initial="hidden" animate="visible">
        <div className="cabinet-section__header">
          <h2>{t("admin.categories.title")}</h2>
        </div>
        {stats.topCategories.length ? (
          <div className="admin-category-list">
            {stats.topCategories.map((category) => (
              <motion.div className="admin-category-row" key={category.id || category.name} variants={cardVariants}>
                <div className="admin-category-row__header">
                  <strong>{getCategoryName(category.id || category.name, categories, i18n.language)}</strong>
                  <span>{category.count}</span>
                </div>
                <div className="admin-category-row__track">
                  <span style={{ width: `${Math.max((category.count / maxCategoryCount) * 100, 4)}%` }} />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState title={t("admin.categories.title")} description={t("common.empty")} />
        )}
      </motion.section>

      <motion.section className="cabinet-section" variants={sectionVariants} initial="hidden" animate="visible">
        <div className="cabinet-section__header">
          <h2>{t("admin.workload.title")}</h2>
        </div>
        {stats.operatorsWorkload.length ? (
          <div className="admin-workload-table-wrap">
            <table className="admin-workload-table">
              <thead>
                <tr>
                  <th>{t("admin.workload.operator")}</th>
                  <th>{t("admin.workload.inProgress")}</th>
                  <th>{t("admin.workload.closed")}</th>
                  <th>{t("admin.workload.total")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.operatorsWorkload.map((operator) => (
                  <tr key={operator.operatorId}>
                    <td>{operator.operatorName}</td>
                    <td>{operator.inProgress}</td>
                    <td>{operator.closed}</td>
                    <td>{operator.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={t("admin.workload.title")} description={t("common.empty")} />
        )}
      </motion.section>
    </>
  );
}
