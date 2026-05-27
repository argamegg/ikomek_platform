import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, PointerEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  LogOut,
  MapPinned,
  MapPin,
  Pencil,
  Plus,
  Radio,
  Trash2,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { CivicRequest, Locale, RequestStatus, SavedLocationType, UserRole } from "../../types/platform";
import { AdminStats } from "../../components/AdminStats";
import { OperatorStats } from "../../components/OperatorStats";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { LocationPickerMap } from "../components/maps/LocationPickerMap";
import { formatDate, getStatusTone } from "../lib/format";
import { ASTANA_CENTER_LAT, ASTANA_CENTER_LNG } from "../lib/geoFence";
import { localizeRequestProblemType, localizeRequestStatus } from "../lib/requestMeta";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";
import { applyLoggedOutQueryState } from "../lib/querySession";
import { searchAstanaAddresses } from "../lib/locationGeocoding";

const ACCENT = "#ff6b35";
const MONTH_WINDOW = 6;
const SAVED_LOCATION_TYPES: SavedLocationType[] = ["home", "work", "study", "family", "other"];
const AVATAR_CROP_SIZE = 512;
const NAME_INPUT_PATTERN = /^[\p{L}\s]*$/u;
const NAME_INPUT_CLEANUP_PATTERN = /[^\p{L}\s]/gu;

type StatKey = "total" | "closed" | "inProgress" | "pending";
type ProfileFormState = {
  firstName: string;
  lastName: string;
  displayName: string;
  gender: string;
  birthDate: string;
  phone: string;
  avatarUrl: string;
  language: Locale;
  notificationsEnabled: boolean;
};
type AvatarCropState = {
  source: string;
  cropX: number;
  cropY: number;
  cropSize: number;
};
type AvatarDragState = {
  pointerId: number;
  mode: "move" | "resize";
  corner?: "nw" | "ne" | "sw" | "se";
  startX: number;
  startY: number;
  cropX: number;
  cropY: number;
  cropSize: number;
};

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

function hasUsableCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001);
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

function splitProfileName(name: string | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function sanitizeProfileNameInput(value: string) {
  return value.replace(NAME_INPUT_CLEANUP_PATTERN, "").replace(/\s{2,}/g, " ");
}

function sanitizeBirthDateInput(value: string) {
  return value.replace(/[^\d-]/g, "");
}

function cropAvatarImage(crop: AvatarCropState) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_CROP_SIZE;
      canvas.height = AVATAR_CROP_SIZE;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas is not available"));
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, AVATAR_CROP_SIZE, AVATAR_CROP_SIZE);

      const coverScale = Math.max(1 / image.naturalWidth, 1 / image.naturalHeight);
      const renderedWidth = image.naturalWidth * coverScale;
      const renderedHeight = image.naturalHeight * coverScale;
      const renderedX = (1 - renderedWidth) / 2;
      const renderedY = (1 - renderedHeight) / 2;
      const sourceX = Math.max(0, (crop.cropX - renderedX) / coverScale);
      const sourceY = Math.max(0, (crop.cropY - renderedY) / coverScale);
      const sourceSize = Math.min(
        image.naturalWidth - sourceX,
        image.naturalHeight - sourceY,
        crop.cropSize / coverScale,
      );

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        AVATAR_CROP_SIZE,
        AVATAR_CROP_SIZE,
      );
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    image.onerror = reject;
    image.src = crop.source;
  });
}

function clampAvatarCrop(cropX: number, cropY: number, cropSize: number) {
  const size = Math.min(0.96, Math.max(0.28, cropSize));
  return {
    cropSize: size,
    cropX: Math.min(1 - size, Math.max(0, cropX)),
    cropY: Math.min(1 - size, Math.max(0, cropY)),
  };
}

function getNextAvatarCrop(drag: AvatarDragState, deltaX: number, deltaY: number) {
  if (drag.mode === "move") {
    return clampAvatarCrop(drag.cropX + deltaX, drag.cropY + deltaY, drag.cropSize);
  }

  const delta = drag.corner?.includes("n") || drag.corner?.includes("w")
    ? -((deltaX + deltaY) / 2)
    : (deltaX + deltaY) / 2;
  const nextSize = drag.cropSize + delta;
  const sizeDelta = nextSize - drag.cropSize;
  const cropX = drag.corner?.includes("w") ? drag.cropX - sizeDelta : drag.cropX;
  const cropY = drag.corner?.includes("n") ? drag.cropY - sizeDelta : drag.cropY;
  return clampAvatarCrop(cropX, cropY, nextSize);
}

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const locale = normalizeLocale(i18n.language);
  const [savedFormOpen, setSavedFormOpen] = useState(false);
  const [savedForm, setSavedForm] = useState({
    label: "",
    type: "home" as SavedLocationType,
    address: "",
    lat: "",
    lng: "",
  });
  const [savedMapCoordinate, setSavedMapCoordinate] = useState<{ lat: number; lng: number } | null>(null);
  const [savedGeocodeHint, setSavedGeocodeHint] = useState("");
  const [isSavedGeocoding, setIsSavedGeocoding] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [avatarCrop, setAvatarCrop] = useState<AvatarCropState | null>(null);
  const avatarDragRef = useRef<AvatarDragState | null>(null);
  const [profileNameError, setProfileNameError] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    firstName: "",
    lastName: "",
    displayName: "",
    gender: "",
    birthDate: "",
    phone: "",
    avatarUrl: "",
    language: locale,
    notificationsEnabled: true,
  });

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
    enabled: currentUserQuery.data?.primaryRole === "citizen",
  });

  const currentUser = currentUserQuery.data;
  const isCitizen = currentUser?.primaryRole === "citizen";
  const requests = useMemo(() => myRequestsQuery.data ?? [], [myRequestsQuery.data]);
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

  const resetSavedForm = () => {
    setSavedForm({ label: "", type: "home", address: "", lat: "", lng: "" });
    setSavedMapCoordinate(null);
    setSavedGeocodeHint("");
  };

  const applySavedMapCoordinate = (coordinate: { lat: number; lng: number }, hint?: string) => {
    setSavedMapCoordinate(coordinate);
    setSavedForm((current) => ({
      ...current,
      lat: coordinate.lat.toFixed(6),
      lng: coordinate.lng.toFixed(6),
    }));
    setSavedGeocodeHint(hint ?? t("cabinet.saved.mapHint"));
  };

  const handleSavedCoordinateInput = (field: "lat" | "lng", value: string) => {
    const nextForm = { ...savedForm, [field]: value };
    setSavedForm(nextForm);

    const lat = Number(nextForm.lat);
    const lng = Number(nextForm.lng);
    if (hasUsableCoordinate(lat, lng)) {
      setSavedMapCoordinate({ lat, lng });
      setSavedGeocodeHint(t("cabinet.saved.mapHint"));
    }
  };

  const findSavedAddressOnMap = async () => {
    const address = savedForm.address.trim();
    setIsSavedGeocoding(true);

    try {
      if (!address) {
        applySavedMapCoordinate(
          { lat: ASTANA_CENTER_LAT, lng: ASTANA_CENTER_LNG },
          t("cabinet.saved.mapFallback"),
        );
        return;
      }

      const [suggestion] = await searchAstanaAddresses(address, i18n.resolvedLanguage ?? "ru");
      if (!suggestion || !hasUsableCoordinate(suggestion.lat, suggestion.lng)) {
        applySavedMapCoordinate(
          { lat: ASTANA_CENTER_LAT, lng: ASTANA_CENTER_LNG },
          t("cabinet.saved.mapFallback"),
        );
        return;
      }

      applySavedMapCoordinate(
        { lat: suggestion.lat, lng: suggestion.lng },
        t("cabinet.saved.approximateFound"),
      );
    } finally {
      setIsSavedGeocoding(false);
    }
  };

  const createSavedLocationMutation = useMutation({
    mutationFn: async () => {
      const label = savedForm.label.trim();
      const address = savedForm.address.trim();
      let lat = Number(savedForm.lat);
      let lng = Number(savedForm.lng);

      if (!label || !address) {
        throw new Error(t("cabinet.saved.formRequired"));
      }

      if (!hasUsableCoordinate(lat, lng)) {
        const [suggestion] = await searchAstanaAddresses(address, i18n.resolvedLanguage ?? "ru");
        if (!suggestion || !hasUsableCoordinate(suggestion.lat, suggestion.lng)) {
          applySavedMapCoordinate(
            { lat: ASTANA_CENTER_LAT, lng: ASTANA_CENTER_LNG },
            t("cabinet.saved.mapFallback"),
          );
          throw new Error(t("cabinet.saved.addressNotFound"));
        }
        lat = suggestion.lat;
        lng = suggestion.lng;
      }

      return platformApi.createSavedLocation({
        label,
        type: savedForm.type,
        address,
        districtId: "",
        lat,
        lng,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.savedLocations });
      resetSavedForm();
      setSavedFormOpen(false);
      toast.success(t("cabinet.saved.created"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const deleteSavedLocationMutation = useMutation({
    mutationFn: platformApi.deleteSavedLocation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.savedLocations });
      toast.success(t("cabinet.saved.deleted"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const profileDisplayName = `${profileForm.firstName} ${profileForm.lastName}`.trim();

  useEffect(() => {
    if (!profileEditorOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [profileEditorOpen]);

  useEffect(() => {
    if (!currentUser) return;
    const name = splitProfileName(currentUser.name);
    setProfileForm({
      firstName: name.firstName,
      lastName: name.lastName,
      displayName: currentUser.displayName || name.firstName || currentUser.name,
      gender: currentUser.gender ?? "",
      birthDate: currentUser.birthDate ?? "",
      phone: currentUser.phone ?? "",
      avatarUrl: currentUser.avatarUrl ?? "",
      language: currentUser.language,
      notificationsEnabled: currentUser.notificationsEnabled,
    });
  }, [currentUser]);

  const updateProfileMutation = useMutation({
    mutationFn: platformApi.updateProfile,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.currentUser });
      const previousUser = queryClient.getQueryData(queryKeys.currentUser);
      queryClient.setQueryData(queryKeys.currentUser, (current: typeof currentUser) => current ? {
        ...current,
        name: payload.name,
        displayName: payload.displayName,
        gender: payload.gender,
        birthDate: payload.birthDate,
        avatarUrl: payload.avatarUrl,
      } : current);
      return { previousUser };
    },
    onSuccess: (updatedUser, payload) => {
      queryClient.setQueryData(queryKeys.currentUser, {
        ...updatedUser,
        name: payload.name,
        displayName: payload.displayName,
        gender: payload.gender,
        birthDate: payload.birthDate,
        avatarUrl: payload.avatarUrl,
      });
      toast.success(t("cabinet.profileEditor.saved"));
      setProfileEditorOpen(false);
    },
    onError: (error, _payload, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(queryKeys.currentUser, context.previousUser);
      }
      toast.error(getErrorMessage(error));
    },
  });

  function updateProfileForm<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    if (key === "firstName" || key === "lastName") {
      setProfileNameError(false);
    }
    setProfileForm((current) => ({ ...current, [key]: value }));
  }

  function handleProfileNameInput(key: "firstName" | "lastName", value: string) {
    updateProfileForm(key, sanitizeProfileNameInput(value));
  }

  function handleProfileNameBeforeInput(event: FormEvent<HTMLInputElement>) {
    const data = (event.nativeEvent as InputEvent).data;
    if (data && !NAME_INPUT_PATTERN.test(data)) {
      event.preventDefault();
    }
  }

  function handleBirthDateInput(value: string) {
    updateProfileForm("birthDate", sanitizeBirthDateInput(value));
  }

  function handleBirthDateBeforeInput(event: FormEvent<HTMLInputElement>) {
    const data = (event.nativeEvent as InputEvent).data;
    if (data && /\D/.test(data)) {
      event.preventDefault();
    }
  }

  function handleAvatarChange(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarCrop({
          source: reader.result,
          cropX: 0.08,
          cropY: 0.05,
          cropSize: 0.84,
        });
      }
    };
    reader.readAsDataURL(file);
  }

  function handleAvatarCropStart(
    event: PointerEvent<HTMLDivElement | HTMLButtonElement>,
    mode: AvatarDragState["mode"],
    corner?: AvatarDragState["corner"],
  ) {
    if (!avatarCrop) return;
    event.preventDefault();
    event.stopPropagation();
    const stage = event.currentTarget.closest(".avatar-crop-stage") as HTMLElement | null;
    stage?.setPointerCapture(event.pointerId);
    avatarDragRef.current = {
      pointerId: event.pointerId,
      mode,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      cropX: avatarCrop.cropX,
      cropY: avatarCrop.cropY,
      cropSize: avatarCrop.cropSize,
    };
  }

  function handleAvatarDragMove(event: PointerEvent<HTMLDivElement>) {
    const drag = avatarDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = (event.clientX - drag.startX) / rect.width;
    const deltaY = (event.clientY - drag.startY) / rect.height;
    setAvatarCrop((current) => current ? {
      ...current,
      ...getNextAvatarCrop(drag, deltaX, deltaY),
    } : current);
  }

  function handleAvatarDragEnd(event: PointerEvent<HTMLDivElement>) {
    if (avatarDragRef.current?.pointerId === event.pointerId) {
      avatarDragRef.current = null;
    }
  }

  async function applyAvatarCrop() {
    if (!avatarCrop) return;
    try {
      const croppedAvatar = await cropAvatarImage(avatarCrop);
      updateProfileForm("avatarUrl", croppedAvatar);
      setAvatarCrop(null);
    } catch {
      toast.error(t("cabinet.profileEditor.photoError"));
    }
  }

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstName = profileForm.firstName.trim();
    const lastName = profileForm.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (!firstName || !lastName) {
      setProfileNameError(true);
      toast.error(t("cabinet.profileEditor.nameRequired"));
      return;
    }

    updateProfileMutation.mutate({
      name: fullName,
      phone: currentUser?.phone ?? "",
      displayName: profileDisplayName,
      gender: profileForm.gender,
      birthDate: profileForm.birthDate,
      avatarUrl: profileForm.avatarUrl,
      language: currentUser?.language ?? locale,
      notificationsEnabled: currentUser?.notificationsEnabled ?? true,
    });
  }

  async function handleLogout() {
    try {
      await platformApi.logout();
      await applyLoggedOutQueryState(queryClient);
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
          onClick={() => setProfileEditorOpen(true)}
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
                    <small className="cabinet-recent-item__meta-line">🕐 {formatDate(request.updatedAt || request.createdAt, locale)}</small>
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

        {isCitizen ? (
        <motion.section className="cabinet-section" variants={sectionVariants} initial="hidden" animate="visible">
          <div className="cabinet-section__header">
            <div>
              <p className="cabinet-kicker">{t("profile.title")}</p>
              <h2>{t("cabinet.saved.title")}</h2>
            </div>
            <Button
              type="button"
              variant="secondary"
              iconLeft={<Plus size={16} />}
              onClick={() => setSavedFormOpen((value) => !value)}
            >
              {t("cabinet.saved.add")}
            </Button>
          </div>

          {savedFormOpen ? (
            <form
              className="cabinet-saved-form"
              onSubmit={(event) => {
                event.preventDefault();
                createSavedLocationMutation.mutate();
              }}
            >
              <label>
                <span>{t("cabinet.saved.label")}</span>
                <input
                  value={savedForm.label}
                  onChange={(event) => setSavedForm((current) => ({ ...current, label: event.target.value }))}
                  placeholder={t("cabinet.saved.labelPlaceholder")}
                />
              </label>
              <label>
                <span>{t("cabinet.saved.type")}</span>
                <select
                  value={savedForm.type}
                  onChange={(event) => setSavedForm((current) => ({ ...current, type: event.target.value as SavedLocationType }))}
                >
                  {SAVED_LOCATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`savedLocationTypes.${type}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cabinet-saved-form__wide">
                <span>{t("cabinet.saved.address")}</span>
                <input
                  value={savedForm.address}
                  onChange={(event) => {
                    setSavedForm((current) => ({
                      ...current,
                      address: event.target.value,
                      lat: "",
                      lng: "",
                    }));
                    setSavedMapCoordinate(null);
                    setSavedGeocodeHint("");
                  }}
                  placeholder={t("cabinet.saved.addressPlaceholder")}
                />
              </label>
              <div className="cabinet-saved-form__actions">
                <Button
                  type="button"
                  variant="secondary"
                  iconLeft={<MapPinned size={16} />}
                  onClick={() => void findSavedAddressOnMap()}
                  disabled={isSavedGeocoding}
                >
                  {isSavedGeocoding ? t("cabinet.saved.findingAddress") : t("cabinet.saved.findOnMap")}
                </Button>
                <p>{savedGeocodeHint || t("cabinet.saved.coordinatesHint")}</p>
              </div>
              {savedMapCoordinate ? (
                <div className="cabinet-saved-form__map">
                  <div className="cabinet-saved-form__map-title">
                    <strong>{t("cabinet.saved.mapTitle")}</strong>
                    <span>{t("cabinet.saved.mapHint")}</span>
                  </div>
                  <LocationPickerMap
                    coordinate={savedMapCoordinate}
                    onCoordinateChange={(coordinate) => applySavedMapCoordinate(coordinate)}
                  />
                </div>
              ) : null}
              <label>
                <span>{t("cabinet.saved.latitude")}</span>
                <input
                  value={savedForm.lat}
                  onChange={(event) => handleSavedCoordinateInput("lat", event.target.value)}
                  placeholder="51.1694"
                  inputMode="decimal"
                />
              </label>
              <label>
                <span>{t("cabinet.saved.longitude")}</span>
                <input
                  value={savedForm.lng}
                  onChange={(event) => handleSavedCoordinateInput("lng", event.target.value)}
                  placeholder="71.4149"
                  inputMode="decimal"
                />
              </label>
              <Button
                type="submit"
                disabled={createSavedLocationMutation.isPending}
                iconLeft={<MapPinned size={16} />}
              >
                {createSavedLocationMutation.isPending ? t("common.loading") : t("cabinet.saved.save")}
              </Button>
            </form>
          ) : null}

          {savedLocations.length ? (
            <div className="cabinet-saved-grid">
              {savedLocations.map((location) => (
                <motion.article key={location.id} className="cabinet-saved-card" variants={cardVariants}>
                  <div className="cabinet-saved-card__top">
                    <span>{t(`savedLocationTypes.${location.type}`)}</span>
                    <button
                      type="button"
                      onClick={() => deleteSavedLocationMutation.mutate(location.id)}
                      aria-label={t("common.delete")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <strong>{location.label}</strong>
                  <p>{location.address}</p>
                  <small>
                    <MapPin size={13} />
                    {location.point.lat.toFixed(5)}, {location.point.lng.toFixed(5)}
                  </small>
                </motion.article>
              ))}
            </div>
          ) : (
            <EmptyState title={t("cabinet.saved.title")} description={t("cabinet.saved.empty")} />
          )}
        </motion.section>
        ) : null}

          </>
        )}
      </div>

      {profileEditorOpen ? (
        <div
          className="profile-editor-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setProfileEditorOpen(false);
            }
          }}
        >
          <motion.form
            className="profile-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-editor-title"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleProfileSubmit}
          >
            <div className="profile-editor-modal__header">
              <div>
                <p className="cabinet-kicker">{t("cabinet.title")}</p>
                <h2 id="profile-editor-title">{t("cabinet.profileEditor.title")}</h2>
              </div>
              <button
                type="button"
                className="profile-editor-modal__close"
                onClick={() => setProfileEditorOpen(false)}
                aria-label={t("common.close")}
              >
                <X size={22} />
              </button>
            </div>

            <div className="profile-editor-modal__hero">
              <div className="profile-editor-avatar-wrap">
                <div className="profile-editor-avatar" aria-hidden="true">
                  {profileForm.avatarUrl ? <img src={profileForm.avatarUrl} alt="" /> : getInitials(profileDisplayName || currentUser?.name || "IK")}
                </div>
                <label className="profile-editor-avatar-edit" title={t("cabinet.profileEditor.changePhoto")}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleAvatarChange(event.target.files?.[0])}
                  />
                  <Pencil size={14} />
                </label>
              </div>
              {profileForm.avatarUrl ? (
                <button
                  type="button"
                  className="profile-editor-avatar-remove"
                  onClick={() => updateProfileForm("avatarUrl", "")}
                >
                  <Trash2 size={14} />
                  {t("cabinet.profileEditor.removePhoto")}
                </button>
              ) : null}
              <label className="profile-editor-field profile-editor-field--wide">
                <span>{t("cabinet.profileEditor.displayName")}</span>
                <input
                  value={profileDisplayName}
                  placeholder={t("cabinet.profileEditor.displayNamePlaceholder")}
                  readOnly
                />
                <small>{t("cabinet.profileEditor.displayNameHint")}</small>
              </label>
            </div>

            <div className="profile-editor-modal__scroll">
              <section className="profile-editor-panel">
                <h3>{t("cabinet.profileEditor.personalData")}</h3>
                <div className="profile-editor-grid">
                <label className={`profile-editor-field ${profileNameError ? "profile-editor-field--error" : ""}`}>
                  <span>{t("cabinet.profileEditor.firstName")}</span>
                  <input
                    value={profileForm.firstName}
                    onBeforeInput={handleProfileNameBeforeInput}
                    onChange={(event) => handleProfileNameInput("firstName", event.target.value)}
                    autoComplete="given-name"
                  />
                </label>
                <label className={`profile-editor-field ${profileNameError ? "profile-editor-field--error" : ""}`}>
                  <span>{t("cabinet.profileEditor.lastName")}</span>
                  <input
                    value={profileForm.lastName}
                    onBeforeInput={handleProfileNameBeforeInput}
                    onChange={(event) => handleProfileNameInput("lastName", event.target.value)}
                    autoComplete="family-name"
                  />
                </label>
                {profileNameError ? (
                  <p className="profile-editor-error">{t("cabinet.profileEditor.nameRequired")}</p>
                ) : null}
                <div className="profile-editor-field">
                  <span>{t("cabinet.profileEditor.gender")}</span>
                  <div className="profile-editor-segmented" role="group" aria-label={t("cabinet.profileEditor.gender")}>
                    {(["male", "female"] as const).map((gender) => (
                      <button
                        key={gender}
                        type="button"
                        className={profileForm.gender === gender ? "is-active" : ""}
                        onClick={() => updateProfileForm("gender", gender)}
                      >
                        {t(`cabinet.profileEditor.genders.${gender}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="profile-editor-field">
                  <span>{t("cabinet.profileEditor.birthDate")}</span>
                  <input
                    type="date"
                    value={profileForm.birthDate}
                    inputMode="numeric"
                    onBeforeInput={handleBirthDateBeforeInput}
                    onChange={(event) => handleBirthDateInput(event.target.value)}
                  />
                </label>
                </div>
              </section>

              <div className="profile-editor-actions">
                <Button type="button" variant="ghost" onClick={() => setProfileEditorOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" isLoading={updateProfileMutation.isPending}>
                  {t("cabinet.profileEditor.save")}
                </Button>
              </div>
            </div>
          </motion.form>

          {avatarCrop ? (
            <div className="avatar-crop-backdrop" role="presentation">
              <div className="avatar-crop-modal" role="dialog" aria-modal="true" aria-label={t("cabinet.profileEditor.cropPhoto")}>
                <div
                  className="avatar-crop-stage"
                  onPointerDown={(event) => handleAvatarCropStart(event, "move")}
                  onPointerMove={handleAvatarDragMove}
                  onPointerUp={handleAvatarDragEnd}
                  onPointerCancel={handleAvatarDragEnd}
                >
                  <img
                    src={avatarCrop.source}
                    alt=""
                    draggable={false}
                  />
                  <div className="avatar-crop-mask" />
                  <div
                    className="avatar-crop-frame"
                    style={{
                      left: `${avatarCrop.cropX * 100}%`,
                      top: `${avatarCrop.cropY * 100}%`,
                      width: `${avatarCrop.cropSize * 100}%`,
                      height: `${avatarCrop.cropSize * 100}%`,
                    }}
                  >
                    {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                      <button
                        key={corner}
                        type="button"
                        className={`avatar-crop-handle avatar-crop-handle--${corner}`}
                        aria-label={t("cabinet.profileEditor.photoScale")}
                        onPointerDown={(event) => handleAvatarCropStart(event, "resize", corner)}
                      />
                    ))}
                  </div>
                </div>

                <div className="avatar-crop-actions">
                  <button type="button" className="avatar-crop-action avatar-crop-action--ghost" onClick={() => setAvatarCrop(null)}>
                    <X size={22} />
                    {t("common.cancel")}
                  </button>
                  <button type="button" className="avatar-crop-action avatar-crop-action--primary" onClick={() => void applyAvatarCrop()}>
                    <Check size={22} />
                    {t("common.done")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function getRoleTone(role: UserRole | undefined) {
  if (role === "admin") return "danger";
  if (role === "operator") return "info";
  return "warning";
}
