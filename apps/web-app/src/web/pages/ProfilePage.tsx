import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Bell, MapPinned } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { formatDate } from "../lib/format";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: platformApi.getCurrentUser,
  });
  const savedLocationsQuery = useQuery({
    queryKey: queryKeys.savedLocations,
    queryFn: platformApi.getSavedLocations,
  });
  const notificationsQuery = useQuery({
    queryKey: [...queryKeys.notifications, i18n.language],
    queryFn: platformApi.getNotifications,
  });
  const districtsQuery = useQuery({ queryKey: queryKeys.districts, queryFn: platformApi.getDistricts });
  const [profileDraft, setProfileDraft] = useState<{
    name: string;
    phone: string;
    language: "en" | "ru" | "kz";
    notificationsEnabled: boolean;
  } | null>(null);
  const [locationForm, setLocationForm] = useState<{
    label: string;
    type: "home" | "work" | "study" | "road" | "environment" | "other";
    address: string;
    districtId: string;
    lat: string;
    lng: string;
  }>({
    label: "",
    type: "home",
    address: "",
    districtId: "",
    lat: "",
    lng: "",
  });

  const profileForm = useMemo(
    () =>
      profileDraft ?? {
        name: currentUserQuery.data?.name ?? "",
        phone: currentUserQuery.data?.phone ?? "",
        language: (currentUserQuery.data?.language ?? "en") as "en" | "ru" | "kz",
        notificationsEnabled: currentUserQuery.data?.notificationsEnabled ?? true,
      },
    [currentUserQuery.data?.language, currentUserQuery.data?.name, currentUserQuery.data?.notificationsEnabled, currentUserQuery.data?.phone, profileDraft],
  );

  const profileMutation = useMutation({
    mutationFn: platformApi.updateProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const locationMutation = useMutation({
    mutationFn: platformApi.createSavedLocation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.savedLocations });
      setModalOpen(false);
      toast.success("Saved place created");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="page-stack">
      <PageHeader
        title={t("profile.title")}
        action={<Button onClick={() => setModalOpen(true)}>{t("profile.addLocation")}</Button>}
      />
      <div className="dashboard-grid dashboard-grid--wide">
        <Card className="section-card" hover={false}>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              profileMutation.mutate(profileForm);
            }}
          >
            <Input
              label="Name"
              value={profileForm.name}
              onChange={(event) =>
                setProfileDraft((value) => ({ ...(value ?? profileForm), name: event.target.value }))
              }
            />
            <Input
              label="Phone"
              value={profileForm.phone}
              onChange={(event) =>
                setProfileDraft((value) => ({ ...(value ?? profileForm), phone: event.target.value }))
              }
            />
            <Select
              label="Language"
              value={profileForm.language}
              onChange={(event) =>
                setProfileDraft((value) => ({
                  ...(value ?? profileForm),
                  language: event.target.value as "en" | "ru" | "kz",
                }))
              }
            >
              <option value="en">English</option>
              <option value="ru">Русский</option>
              <option value="kz">Қазақша</option>
            </Select>
            <label className="switcher">
              <input
                type="checkbox"
                checked={profileForm.notificationsEnabled}
                onChange={(event) =>
                  setProfileDraft((value) => ({
                    ...(value ?? profileForm),
                    notificationsEnabled: event.target.checked,
                  }))
                }
              />
              <span>Notifications enabled</span>
            </label>
            <Button type="submit" isLoading={profileMutation.isPending}>
              {t("common.save")}
            </Button>
          </form>
        </Card>

        <Card className="section-card">
          <div className="section-card__header">
            <div>
              <span className="section-card__eyebrow">{t("profile.addLocation")}</span>
              <h3>Saved places</h3>
            </div>
            <MapPinned size={18} />
          </div>
          <div className="address-list">
            {(savedLocationsQuery.data ?? []).map((location) => (
              <div key={location.id} className="address-list__item">
                <strong>{location.label}</strong>
                <p>{location.address}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="section-card">
          <div className="section-card__header">
            <div>
              <span className="section-card__eyebrow">{t("profile.notifications")}</span>
              <h3>Latest activity</h3>
            </div>
            <Bell size={18} />
          </div>
          <div className="news-stack">
            {(notificationsQuery.data ?? []).map((notification) => (
              <article key={notification.id} className="news-stack__item">
                <strong>{notification.title}</strong>
                <p>{notification.description}</p>
                <span>{formatDate(notification.createdAt, i18n.language as "en" | "ru" | "kz")}</span>
              </article>
            ))}
          </div>
        </Card>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("profile.addLocation")}
        description="Add a new reusable address for future issue submissions."
      >
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            locationMutation.mutate({
              label: locationForm.label,
              type: locationForm.type,
              address: locationForm.address,
              districtId: locationForm.districtId,
              lat: Number(locationForm.lat),
              lng: Number(locationForm.lng),
            });
          }}
        >
          <Input
            label="Label"
            value={locationForm.label}
            onChange={(event) => setLocationForm((value) => ({ ...value, label: event.target.value }))}
          />
          <Select
            label="Type"
            value={locationForm.type}
            onChange={(event) =>
              setLocationForm((value) => ({
                ...value,
                type: event.target.value as "home" | "work" | "study" | "road" | "environment" | "other",
              }))
            }
          >
            <option value="home">Home</option>
            <option value="work">Work</option>
            <option value="study">Study</option>
            <option value="road">Road</option>
            <option value="environment">Environment</option>
            <option value="other">Other</option>
          </Select>
          <Input
            label="Address"
            value={locationForm.address}
            onChange={(event) => setLocationForm((value) => ({ ...value, address: event.target.value }))}
          />
          <Select
            label="District"
            value={locationForm.districtId}
            onChange={(event) =>
              setLocationForm((value) => ({ ...value, districtId: event.target.value }))
            }
          >
            <option value="">Select district</option>
            {(districtsQuery.data ?? []).map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </Select>
          <div className="inline-grid">
            <Input
              label="Latitude"
              value={locationForm.lat}
              onChange={(event) => setLocationForm((value) => ({ ...value, lat: event.target.value }))}
            />
            <Input
              label="Longitude"
              value={locationForm.lng}
              onChange={(event) => setLocationForm((value) => ({ ...value, lng: event.target.value }))}
            />
          </div>
          <Button type="submit" isLoading={locationMutation.isPending}>
            {t("common.create")}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
