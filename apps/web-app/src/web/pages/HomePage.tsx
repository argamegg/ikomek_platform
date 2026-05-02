import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  CircleHelp,
  CheckCircle2,
  Clock3,
  Droplets,
  Flame,
  MapPinned,
  Map,
  Radar,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Waves,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { NewsItem } from "../../types/platform";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { IssueMap } from "../components/maps/IssueMap";
import { formatDate, formatRelativeTime, getStatusTone } from "../lib/format";
import {
  getBorderColor,
  getNewsCategory,
  getNewsTypeMeta,
  getNewsTypes,
  NEWS_CATEGORY_COLOR,
} from "../lib/newsMeta";
import { platformApi, queryKeys } from "../services/platformApi";

function CountUpNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isInView = useInView(ref, { once: true, amount: 0.65 });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!isInView) {
      return;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 1200;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplayValue(Math.round(value * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isInView, value]);

  return <span ref={ref}>{displayValue}</span>;
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  const safeT = (key: string, fallback: string, options?: Record<string, unknown>) => {
    const value = t(key, { defaultValue: fallback, ...(options ?? {}) });
    return typeof value === "string" && value.trim().length > 0 ? value : fallback;
  };
  const publicRequestsQuery = useQuery({
    queryKey: queryKeys.publicRequests,
    queryFn: platformApi.getPublicRequests,
  });
  const alertsQuery = useQuery({
    queryKey: [...queryKeys.alerts, i18n.language],
    queryFn: platformApi.getAlerts,
    placeholderData: (previous) => previous ?? [],
  });
  const newsQuery = useQuery({
    queryKey: [...queryKeys.news, i18n.language],
    queryFn: platformApi.getNews,
    placeholderData: (previous) => previous ?? [],
  });
  const categoriesQuery = useQuery({
    queryKey: [...queryKeys.categories, i18n.language],
    queryFn: platformApi.getCategories,
    placeholderData: (previous) => previous ?? [],
  });

  const publicRequests = publicRequestsQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];
  const news = newsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const featuredUpdates = useMemo(() => {
    const merged = [...alerts, ...news].slice(0, 4);
    return merged;
  }, [alerts, news]);

  const highlightRequest = publicRequests[0] ?? null;
  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? null;

  const getLocalizedCategoryLabel = (category: { id?: string; code?: string; name?: string }) => {
    const key = category.code || category.id || "";
    const normalized = key.toLowerCase();
    const supported = new Set([
      "electricity",
      "water",
      "heating",
      "public_order",
      "sewage",
      "waste",
      "roads",
      "other",
    ]);

    if (supported.has(normalized)) {
      return t(`home.categoriesSection.labels.${normalized}`);
    }

    return category.name ?? "";
  };

  const getCategoryContent = (category: { id?: string; code?: string; name?: string }) => {
    const key = (category.code || category.id || "other").toLowerCase();

    switch (key) {
      case "electricity":
        return {
          Icon: Zap,
          summary: safeT(
            "home.categoriesSection.cards.electricity.description",
            "Lighting outages, power cuts, damaged lines, and electrical failures.",
          ),
          details: safeT(
            "home.categoriesSection.cards.electricity.details",
            "Use this category for outages, dangerous exposed cables, damaged transformers, or broken street lighting that requires an electrical response.",
          ),
          examples: safeT(
            "home.categoriesSection.cards.electricity.example",
            "Streetlights, cable faults, transformer issues.",
          ),
          whenToUse: safeT(
            "home.categoriesSection.cards.electricity.whenToUse",
            "Choose this category if the main issue is power, lighting, or electrical infrastructure.",
          ),
        };
      case "water":
        return {
          Icon: Droplets,
          summary: safeT(
            "home.categoriesSection.cards.water.description",
            "No water, weak pressure, leaks, and supply interruptions.",
          ),
          details: safeT(
            "home.categoriesSection.cards.water.details",
            "Use this category when homes, buildings, or outdoor infrastructure face water supply interruptions, visible leaks, or unstable pressure.",
          ),
          examples: safeT(
            "home.categoriesSection.cards.water.example",
            "Building supply issues, burst pipes, emergency leaks.",
          ),
          whenToUse: safeT(
            "home.categoriesSection.cards.water.whenToUse",
            "Choose this category if the main problem is drinking water supply, pressure, or leakage.",
          ),
        };
      case "heating":
        return {
          Icon: Flame,
          summary: safeT(
            "home.categoriesSection.cards.heating.description",
            "Heating problems in homes, cold radiators, and service disruptions.",
          ),
          details: safeT(
            "home.categoriesSection.cards.heating.details",
            "Use this category for cold apartments, unstable heating service, radiator problems, or other heating-system failures during the season.",
          ),
          examples: safeT(
            "home.categoriesSection.cards.heating.example",
            "No heat, uneven heating, recurring interruptions.",
          ),
          whenToUse: safeT(
            "home.categoriesSection.cards.heating.whenToUse",
            "Choose this category if the issue affects indoor heat supply or building heating systems.",
          ),
        };
      case "public_order":
        return {
          Icon: ShieldAlert,
          summary: safeT(
            "home.categoriesSection.cards.public_order.description",
            "Public disturbances, excessive noise, and unsafe or illegal activity.",
          ),
          details: safeT(
            "home.categoriesSection.cards.public_order.details",
            "Use this category for recurring disturbances in shared spaces, public safety concerns, or visible behavior that requires city attention.",
          ),
          examples: safeT(
            "home.categoriesSection.cards.public_order.example",
            "Night noise, disorder, conflicts in shared public spaces.",
          ),
          whenToUse: safeT(
            "home.categoriesSection.cards.public_order.whenToUse",
            "Choose this category if the issue is about safety, noise, or order in public areas.",
          ),
        };
      case "sewage":
        return {
          Icon: Waves,
          summary: safeT(
            "home.categoriesSection.cards.sewage.description",
            "Sewer blockages, bad odors, flooding, and emergency failures.",
          ),
          details: safeT(
            "home.categoriesSection.cards.sewage.details",
            "Use this category when wastewater systems overflow, drains are blocked, or strong sewage odors indicate a network problem.",
          ),
          examples: safeT(
            "home.categoriesSection.cards.sewage.example",
            "Blocked drains, overflowing sewage, strong smells near buildings.",
          ),
          whenToUse: safeT(
            "home.categoriesSection.cards.sewage.whenToUse",
            "Choose this category if the issue is related to sewer drainage, overflow, or sanitation risks.",
          ),
        };
      case "waste":
        return {
          Icon: Trash2,
          summary: safeT(
            "home.categoriesSection.cards.waste.description",
            "Overflowing bins, missed collection, and waste-related sanitation issues.",
          ),
          details: safeT(
            "home.categoriesSection.cards.waste.details",
            "Use this category for household waste collection problems, overflowing containers, or sanitation issues caused by delayed removal.",
          ),
          examples: safeT(
            "home.categoriesSection.cards.waste.example",
            "Full containers, illegal dumping, delayed cleanup.",
          ),
          whenToUse: safeT(
            "home.categoriesSection.cards.waste.whenToUse",
            "Choose this category if the main issue is garbage collection, overflowing bins, or illegal dumping.",
          ),
        };
      case "roads":
        return {
          Icon: Map,
          summary: safeT(
            "home.categoriesSection.cards.roads.description",
            "Potholes, damaged roads, unsafe surfaces, and marking problems.",
          ),
          details: safeT(
            "home.categoriesSection.cards.roads.details",
            "Use this category for damaged road surfaces, unsafe pavement conditions, broken curbs, or missing and faded markings.",
          ),
          examples: safeT(
            "home.categoriesSection.cards.roads.example",
            "Road damage, broken curbs, faded lane markings.",
          ),
          whenToUse: safeT(
            "home.categoriesSection.cards.roads.whenToUse",
            "Choose this category if transport safety or road condition is the main problem.",
          ),
        };
      default:
        return {
          Icon: CircleHelp,
          summary: safeT(
            "home.categoriesSection.cards.other.description",
            "Other city problems that do not fit the main reporting categories.",
          ),
          details: safeT(
            "home.categoriesSection.cards.other.details",
            "Use this category when the issue still needs city attention but does not clearly belong to electricity, water, roads, waste, or another main service group.",
          ),
          examples: safeT(
            "home.categoriesSection.cards.other.example",
            "Use this if your issue needs attention but belongs elsewhere.",
          ),
          whenToUse: safeT(
            "home.categoriesSection.cards.other.whenToUse",
            "Choose this category if none of the main categories describe your issue well enough.",
          ),
        };
    }
  };

  const getNewsPeriod = (item: NewsItem) => {
    const start = item.startAt || item.publishedAt;
    if (!start) {
      return "";
    }

    const locale = i18n.language === "kz" ? "kk-KZ" : i18n.language === "ru" ? "ru-RU" : "en-US";
    const formatter = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const startDate = new Date(start.endsWith("Z") ? start : `${start}Z`);
    const startLabel = Number.isNaN(startDate.getTime()) ? "" : formatter.format(startDate);
    const endDate = item.endAt ? new Date(item.endAt.endsWith("Z") ? item.endAt : `${item.endAt}Z`) : null;
    const endLabel = endDate && !Number.isNaN(endDate.getTime()) ? formatter.format(endDate) : "";
    return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
  };

  const getNewsPreview = (item: NewsItem) => item.summary || item.body;

  const getLocalizedRequestStatus = (status?: string) => {
    const normalized = (status ?? "").toLowerCase();

    switch (normalized) {
      case "pending":
        return t("home.requestStatus.pending");
      case "in_progress":
        return t("home.requestStatus.in_progress");
      case "closed":
        return t("home.requestStatus.closed");
      case "open":
        return t("home.requestStatus.open");
      case "resolved":
        return t("home.requestStatus.resolved");
      case "rejected":
        return t("home.requestStatus.rejected");
      default:
        return status ?? "";
    }
  };

  const stats = useMemo(
    () => [
      {
        id: "requests",
        value: publicRequests.length,
        label: safeT("home.stats.requests", "Public issues on the map"),
        detail: safeT("home.preview.issueStream", "Shared live issue stream"),
      },
      {
        id: "alerts",
        value: alerts.length,
        label: safeT("home.stats.alerts", "Active city alerts"),
        detail: safeT("home.preview.disruptions", "Priority notices and disruptions"),
      },
      {
        id: "categories",
        value: categories.length,
        label: safeT("home.stats.categories", "Service categories"),
        detail: safeT(
          "home.preview.syncedCategories",
          "Service categories synced with backend",
        ),
      },
    ],
    [alerts.length, categories.length, publicRequests.length, safeT],
  );

  const overviewHighlights = useMemo(
    () => [
      {
        id: "shared-backend",
        icon: ShieldCheck,
        eyebrow: safeT("home.overview.cardOneEyebrow", "One data source"),
        title: safeT("home.overview.cardOneTitle", "One backend powers every channel."),
        body: safeT(
          "home.overview.cardOneBody",
          "The web experience, mobile app, operators, and city admins all work on the same requests, statuses, and content stream.",
        ),
      },
      {
        id: "live-operations",
        icon: Radar,
        eyebrow: safeT("home.overview.cardTwoEyebrow", "Live operations"),
        title: safeT("home.overview.cardTwoTitle", "Fast response across the whole lifecycle."),
        body: safeT(
          "home.overview.cardTwoBody",
          "From the first citizen report to the final resolution, updates move through a shared queue instead of disconnected interfaces.",
        ),
      },
      {
        id: "public-awareness",
        icon: BellRing,
        eyebrow: safeT("home.alertsStory.eyebrow", "Public awareness"),
        title: safeT("home.alertsStory.title", "News and alerts stay close to action."),
        body: safeT(
          "home.alertsStory.body",
          "Residents can track disruptions, city notices, and issue hotspots in the same product surface where requests are created.",
        ),
      },
    ],
    [safeT],
  );

  const steps = useMemo(
    () => [
      {
        id: "report",
        step: "01",
        title: safeT("home.how.stepOneTitle", "Citizen reports the issue"),
        body: safeT(
          "home.how.stepOneBody",
          "A resident submits a request with category, location, photos, and details from mobile or web.",
        ),
      },
      {
        id: "triage",
        step: "02",
        title: safeT("home.how.stepTwoTitle", "Operators triage and assign"),
        body: safeT(
          "home.how.stepTwoBody",
          "Call center staff review incoming reports, update status, and coordinate the proper response path.",
        ),
      },
      {
        id: "resolve",
        step: "03",
        title: safeT("home.how.stepThreeTitle", "City services resolve"),
        body: safeT(
          "home.how.stepThreeBody",
          "The request progresses through shared statuses with comments, notes, and supporting communication.",
        ),
      },
      {
        id: "result",
        step: "04",
        title: safeT("home.how.stepFourTitle", "Resident sees the result"),
        body: safeT(
          "home.how.stepFourBody",
          "The same person who reported the issue can track updates and close the loop with confidence.",
        ),
      },
    ],
    [safeT],
  );

  return (
    <div className="home-landing">
      <motion.section
        className="home-landing__section home-hero"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, ease: "easeOut" }}
      >
        <div className="home-hero__content">
          <div className="home-hero__copy">
            <Badge tone="warning" className="home-hero__badge">
              {t("home.badge")}
            </Badge>
            <h1>{t("home.title")}</h1>
            <p>{t("home.description")}</p>
            <div className="home-hero__actions">
              <Link to="/requests/new">
                <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ duration: 0.2 }}>
                  <Button size="lg" iconRight={<ArrowRight size={16} />}>
                    {t("home.primary")}
                  </Button>
                </motion.div>
              </Link>
              <Link to="/map">
                <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ duration: 0.2 }}>
                  <Button size="lg" variant="secondary" iconLeft={<MapPinned size={16} />}>
                    {t("home.secondary")}
                  </Button>
                </motion.div>
              </Link>
            </div>
          </div>

          <motion.div
            className="home-hero__visual"
            initial={{ opacity: 0, x: 32, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.12, ease: "easeOut" }}
          >
            <div className="home-hero__visual-orbit home-hero__visual-orbit--one" />
            <div className="home-hero__visual-orbit home-hero__visual-orbit--two" />
            <div className="home-hero__visual-panel home-hero__visual-panel--primary">
              <span>{t("home.preview.signalLabel")}</span>
              <strong>{t("home.preview.activeMapPoints", { count: publicRequests.length || 0 })}</strong>
              <p>{t("home.preview.sharedQueue")}</p>
            </div>
            <div className="home-hero__visual-row">
              <div className="home-hero__visual-chip">
                <small>{t("home.preview.categories")}</small>
                <strong>{categories.length}</strong>
              </div>
              <div className="home-hero__visual-chip">
                <small>{t("home.preview.alerts")}</small>
                <strong>{alerts.length}</strong>
              </div>
            </div>
            <div className="home-hero__visual-strip">
              {featuredUpdates.slice(0, 3).map((item, index) => (
                (() => {
                  const types = getNewsTypes(item);
                  const primaryMeta = getNewsTypeMeta(types[0]);
                  const category = getNewsCategory(item);
                  const Icon = primaryMeta.icon;

                  return (
                    <motion.article
                      key={item.id}
                      className="home-hero__signal"
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.22 + index * 0.08, duration: 0.45 }}
                    >
                      <div className="home-hero__signal-top">
                        <span
                          className="home-hero__signal-type"
                          style={{
                            backgroundColor: `${primaryMeta.color}14`,
                            color: primaryMeta.color,
                          }}
                        >
                          <Icon size={14} />
                          {types[0]}
                        </span>
                        <span
                          className="home-hero__signal-category"
                          style={{ backgroundColor: NEWS_CATEGORY_COLOR }}
                        >
                          {category}
                        </span>
                      </div>
                      <strong>{item.title}</strong>
                      <span>{formatRelativeTime(item.startAt, i18n.language as "en" | "ru" | "kz")}</span>
                    </motion.article>
                  );
                })()
              ))}
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        className="home-landing__section home-overview"
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.7 }}
      >
        <div className="home-section-heading">
          <span>{t("home.overview.eyebrow")}</span>
          <h2>{t("home.overview.title")}</h2>
          <p>{t("home.overview.description")}</p>
        </div>

        <div className="home-overview__grid">
          <div className="home-overview__narrative">
            <p>{t("home.overview.narrative")}</p>
            <div className="home-overview__metrics">
              <div>
                <strong>{publicRequests.length || 0}</strong>
                <span>{t("home.overview.visibleIssues")}</span>
              </div>
              <div>
                <strong>{featuredUpdates.length || 0}</strong>
                <span>{t("home.alertsStory.landingMetric")}</span>
              </div>
            </div>
          </div>

          <motion.div
            className="home-overview__cards"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            variants={{
              hidden: {},
              show: {
                transition: {
                  staggerChildren: 0.12,
                },
              },
            }}
          >
            {overviewHighlights.map((item) => {
              const Icon = item.icon;

              return (
                <motion.article
                  key={item.id}
                  className="home-overview__card"
                  variants={{
                    hidden: { opacity: 0, y: 26 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                  }}
                >
                  <div className="home-overview__icon">
                    <Icon size={18} />
                  </div>
                  <span>{item.eyebrow}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </motion.article>
              );
            })}
          </motion.div>
        </div>
      </motion.section>

      <section className="home-landing__section home-stats">
        <div className="home-section-heading home-section-heading--centered">
          <span>{t("home.statsSection.eyebrow")}</span>
          <h2>{t("home.statsSection.title")}</h2>
        </div>

        <div className="home-stats__grid">
          {stats.map((stat, index) => (
            <motion.article
              key={stat.id}
              className="home-stats__item"
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <small>{stat.label}</small>
              <strong>
                <CountUpNumber value={stat.value} />
              </strong>
              <p>{stat.detail}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <motion.section
        className="home-landing__section home-categories"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.65 }}
      >
        <div className="home-section-heading">
          <span>{t("home.categoriesSection.eyebrow")}</span>
          <h2>{t("home.categoriesSection.title")}</h2>
          <p>{t("home.categoriesSection.description")}</p>
        </div>

        <div className="home-categories__grid">
          {categoriesQuery.isLoading
            ? Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="home-categories__skeleton" />
              ))
            : categories.slice(0, 8).map((category, index) => {
                const { Icon, summary } = getCategoryContent(category);

                return (
                  <motion.button
                    key={category.id}
                    type="button"
                    className="home-categories__item home-categories__button"
                    style={{
                      ["--category-accent" as string]:
                        (category as { color?: string }).color ?? "#ff6b00",
                    }}
                    whileHover={{ y: -10, scale: 1.02 }}
                    transition={{ duration: 0.24 }}
                    onClick={() => setActiveCategoryId(category.id)}
                    aria-haspopup="dialog"
                    aria-expanded={activeCategoryId === category.id}
                  >
                    <div className="home-categories__top">
                      <span className="home-categories__count">{String(index + 1).padStart(2, "0")}</span>
                      <div className="home-categories__icon">
                        <Icon size={18} />
                      </div>
                    </div>
                    <div className="home-categories__body">
                      <strong>{getLocalizedCategoryLabel(category)}</strong>
                      <p>{summary}</p>
                    </div>
                  </motion.button>
                );
              })}
        </div>
      </motion.section>

      <Modal
        open={Boolean(activeCategory)}
        onClose={() => setActiveCategoryId(null)}
        title={
          activeCategory
            ? getLocalizedCategoryLabel(activeCategory)
            : safeT("home.categoriesSection.eyebrow", "What you can report")
        }
        description={
          activeCategory
            ? getCategoryContent(activeCategory).summary
            : undefined
        }
        closeLabel={safeT("home.categoriesSection.modal.close", "Close category details")}
      >
        {activeCategory ? (
          (() => {
            const { Icon, details, examples, whenToUse } = getCategoryContent(activeCategory);

            return (
              <div className="home-categories-modal">
                <div className="home-categories-modal__hero">
                  <div
                    className="home-categories-modal__icon"
                    style={{
                      ["--category-accent" as string]:
                        (activeCategory as { color?: string }).color ?? "#ff6b00",
                    }}
                  >
                    <Icon size={22} />
                  </div>
                  <div className="home-categories-modal__meta">
                    <span>{safeT("home.categoriesSection.modal.problemType", "Problem type")}</span>
                    <strong>{getLocalizedCategoryLabel(activeCategory)}</strong>
                  </div>
                </div>

                <div className="home-categories-modal__section">
                  <h4>{safeT("home.categoriesSection.modal.detailsTitle", "What gets resolved")}</h4>
                  <p>{details}</p>
                </div>

                <div className="home-categories-modal__section">
                  <h4>{safeT("home.categoriesSection.modal.examplesTitle", "Examples")}</h4>
                  <p>{examples}</p>
                </div>

                <div className="home-categories-modal__section home-categories-modal__section--soft">
                  <h4>{safeT("home.categoriesSection.modal.whenToUseTitle", "When to use this category")}</h4>
                  <p>{whenToUse}</p>
                </div>
              </div>
            );
          })()
        ) : null}
      </Modal>

      <motion.section
        className="home-landing__section home-news"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.65 }}
      >
        <div className="home-section-heading">
          <span>{t("home.newsPreview.eyebrow")}</span>
          <h2>{t("home.newsPreview.title")}</h2>
          <p>{t("home.newsPreview.description")}</p>
        </div>

        <div className="home-news__grid">
          {featuredUpdates.slice(0, 3).map((item, index) => (
            (() => {
              const types = getNewsTypes(item);
              const primaryMeta = getNewsTypeMeta(types[0]);
              const category = getNewsCategory(item);
              const period = getNewsPeriod(item);
              const borderColor = getBorderColor(item.startAt, item.endAt);
              const createdAtLabel = formatDate(
                item.publishedAt || item.startAt,
                i18n.language as "en" | "ru" | "kz",
              );

              return (
                <Link key={item.id} to="/news" className="home-news__link">
                  <motion.article
                    className={index === 0 ? "home-news__card home-news__card--featured" : "home-news__card"}
                    whileHover={{ y: -10, scale: 1.015 }}
                    transition={{ duration: 0.24 }}
                  >
                    <div className="home-news__accent" style={{ backgroundColor: borderColor }} />
                    <div
                      className="home-news__image"
                      style={{
                        background: `linear-gradient(135deg, ${primaryMeta.color}24 0%, rgba(255,255,255,0.98) 100%)`,
                      }}
                    >
                      <div className="home-news__image-glow" />
                      <div className="news-card-types home-news__types">
                        {types.map((type, index) => {
                          const meta = getNewsTypeMeta(type);
                          const TypeIcon = meta.icon;
                          return (
                            <div key={`${item.id}-${type}-${index}`} className="news-card-type-block">
                              <span
                                className="home-news__type-icon"
                                style={{ backgroundColor: meta.color, color: "#fff" }}
                              >
                                <TypeIcon size={24} />
                              </span>
                              <div className="news-card-type-meta">
                                <span className="type-name" style={{ color: meta.color }}>
                                  {type}
                                </span>
                                {index === 0 ? <span className="type-date">{createdAtLabel}</span> : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="home-news__body">
                      <div className="home-news__title">
                        <h3>{item.title}</h3>
                      </div>
                      <div className="home-news__summary">
                        <p>{getNewsPreview(item)}</p>
                      </div>
                      <div className="home-news__meta">
                        {period ? (
                          <span>
                            <Clock3 size={14} />
                            {period}
                          </span>
                        ) : (
                          <span className="home-news__meta-spacer" aria-hidden="true" />
                        )}
                        <span className="news-category-chip">{category}</span>
                      </div>
                    </div>
                  </motion.article>
                </Link>
              );
            })()
          ))}
        </div>
      </motion.section>

      <motion.section
        className="home-landing__section home-map-preview"
        initial={{ opacity: 0, scale: 0.97, y: 40 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7 }}
      >
        <div className="home-section-heading">
          <span>{t("home.mapPreview.eyebrow")}</span>
          <h2>{t("home.mapPreview.title")}</h2>
          <p>{t("home.mapPreview.description")}</p>
        </div>

        <div className="home-map-preview__shell">
          <div className="home-map-preview__overlay">
            <div className="home-map-preview__pills">
              <span className="home-map-preview__pulse">
                <i />
                {t("home.preview.liveIssuePulse")}
              </span>
              <span>{t("home.preview.mapPoints", { count: publicRequests.length || 0 })}</span>
              <span>{t("home.preview.alertsCount", { count: alerts.length || 0 })}</span>
            </div>
            {highlightRequest ? (
              <motion.div
                className="home-map-preview__focus"
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: 0.15 }}
              >
                <small>{t("home.preview.selectedIssue")}</small>
                <strong>{highlightRequest.title}</strong>
                <p>{highlightRequest.address}</p>
                <Badge tone={getStatusTone(highlightRequest.status)}>
                  {highlightRequest.statusLabel ?? getLocalizedRequestStatus(highlightRequest.status)}
                </Badge>
              </motion.div>
            ) : null}
          </div>

          <div className="home-map-preview__canvas">
            <IssueMap requests={publicRequests.slice(0, 16)} mode="all" />
          </div>
        </div>
      </motion.section>

      <motion.section
        className="home-landing__section home-how"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.65 }}
      >
        <div className="home-section-heading home-section-heading--centered">
          <span>{t("home.how.eyebrow")}</span>
          <h2>{t("home.how.title")}</h2>
        </div>

        <div className="home-how__timeline">
          {steps.map((item, index) => (
            <motion.article
              key={item.id}
              className="home-how__step"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
            >
              <div className="home-how__step-number">{item.step}</div>
              <div className="home-how__step-body">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="home-landing__section home-cta"
        initial={{ opacity: 0, scale: 0.94 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6 }}
      >
        <div className="home-cta__content">
          <Badge tone="warning">{t("home.cta.badge")}</Badge>
          <h2>{t("home.cta.title")}</h2>
          <p>{t("home.cta.description")}</p>
          <Link to="/requests/new">
            <motion.div whileHover={{ scale: 1.03, y: -4 }} transition={{ duration: 0.22 }}>
              <Button size="lg" iconRight={<ArrowRight size={16} />}>
                {t("home.cta.button")}
              </Button>
            </motion.div>
          </Link>
          <div className="home-cta__trust">
            <CheckCircle2 size={18} />
            <span>{t("home.cta.trust")}</span>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
