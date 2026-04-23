import { startTransition, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Crosshair, UploadCloud } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";
import { getDistanceToAstanaKm, isWithinAstanaRequestZone } from "../lib/geoFence";

export function NewRequestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: platformApi.getCategories,
  });
  const reasonsQuery = useQuery({ queryKey: queryKeys.reasons, queryFn: platformApi.getReasons });
  const savedLocationsQuery = useQuery({
    queryKey: queryKeys.savedLocations,
    queryFn: platformApi.getSavedLocations,
  });

  const [form, setForm] = useState({
    savedLocationId: "",
    address: "",
    lat: "",
    lng: "",
    place: "",
    categoryId: "",
    reasonId: "",
    description: "",
    isPublic: true,
    attachments: [] as File[],
  });

  const filteredReasons = useMemo(
    () => (reasonsQuery.data ?? []).filter((reason) => reason.categoryId === form.categoryId),
    [form.categoryId, reasonsQuery.data],
  );
  const latitude = form.lat.trim() ? Number(form.lat) : null;
  const longitude = form.lng.trim() ? Number(form.lng) : null;
  const hasCoordinates = form.lat.trim().length > 0 && form.lng.trim().length > 0;
  const coordinatesAreValid =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);
  const isOutsideAstanaZone = coordinatesAreValid
    ? !isWithinAstanaRequestZone(latitude, longitude)
    : false;
  const distanceToAstanaKm = coordinatesAreValid ? getDistanceToAstanaKm(latitude, longitude) : null;
  const locationError = !hasCoordinates
    ? t("newRequest.locationRequired")
    : !coordinatesAreValid
      ? t("newRequest.invalidCoordinates")
      : isOutsideAstanaZone
        ? t("newRequest.outOfZone")
        : null;
  const canSubmit = coordinatesAreValid && !isOutsideAstanaZone;

  const createMutation = useMutation({
    mutationFn: platformApi.createRequest,
    onSuccess: async (request) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.myRequests }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicRequests }),
      ]);
      toast.success("Request submitted");
      startTransition(() => navigate(`/requests/${request.id}`));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  function fillFromSavedLocation(locationId: string) {
    const location = savedLocationsQuery.data?.find((item) => item.id === locationId);

    setForm((value) => ({
      ...value,
      savedLocationId: locationId,
      address: location?.address ?? value.address,
      lat: location ? String(location.point.lat) : value.lat,
      lng: location ? String(location.point.lng) : value.lng,
    }));
  }

  return (
    <div className="page-stack">
      <PageHeader title={t("newRequest.title")} description={t("newRequest.description")} />
      <div className="dashboard-grid dashboard-grid--wide">
        <Card className="section-card" hover={false}>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit) {
                return;
              }
              createMutation.mutate({
                address: form.address,
                savedLocationId: form.savedLocationId || undefined,
                lat: latitude ?? undefined,
                lng: longitude ?? undefined,
                place: form.place,
                categoryId: form.categoryId,
                reasonId: form.reasonId,
                description: form.description,
                isPublic: form.isPublic,
                attachments: form.attachments,
              });
            }}
          >
            <Select
              label="Saved place"
              value={form.savedLocationId}
              onChange={(event) => fillFromSavedLocation(event.target.value)}
            >
              <option value="">Select a saved place</option>
              {(savedLocationsQuery.data ?? []).map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </Select>
            <Input
              label={t("newRequest.address")}
              value={form.address}
              onChange={(event) => setForm((value) => ({ ...value, address: event.target.value }))}
              required
            />
            <div className="inline-grid">
              <Input
                label="Latitude"
                type="number"
                step="any"
                value={form.lat}
                onChange={(event) => setForm((value) => ({ ...value, lat: event.target.value }))}
              />
              <Input
                label="Longitude"
                type="number"
                step="any"
                value={form.lng}
                onChange={(event) => setForm((value) => ({ ...value, lng: event.target.value }))}
              />
            </div>
            {locationError ? (
              <p className="field__message field__message--error">{locationError}</p>
            ) : distanceToAstanaKm !== null ? (
              <p className="field__message">
                {t("newRequest.zoneHint", { distance: Math.round(distanceToAstanaKm) })}
              </p>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              iconLeft={<Crosshair size={16} />}
              onClick={() => {
                navigator.geolocation.getCurrentPosition((position) => {
                  setForm((value) => ({
                    ...value,
                    lat: String(position.coords.latitude),
                    lng: String(position.coords.longitude),
                  }));
                });
              }}
            >
              {t("newRequest.geolocate")}
            </Button>
            <Input
              label={t("newRequest.place")}
              value={form.place}
              onChange={(event) => setForm((value) => ({ ...value, place: event.target.value }))}
              required
            />
            <Select
              label={t("newRequest.category")}
              value={form.categoryId}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  categoryId: event.target.value,
                  reasonId: "",
                }))
              }
              required
            >
              <option value="">Select category</option>
              {(categoriesQuery.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              label={t("newRequest.reason")}
              value={form.reasonId}
              onChange={(event) => setForm((value) => ({ ...value, reasonId: event.target.value }))}
              required
            >
              <option value="">Select reason</option>
              {filteredReasons.map((reason) => (
                <option key={reason.id} value={reason.id}>
                  {reason.name}
                </option>
              ))}
            </Select>
            <Textarea
              label={t("newRequest.descriptionLabel")}
              rows={6}
              value={form.description}
              onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
              required
            />
            <label className="upload-dropzone">
              <UploadCloud size={18} />
              <span>{t("newRequest.attachments")}</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    attachments: Array.from(event.target.files ?? []),
                  }))
                }
              />
            </label>
            <label className="switcher">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(event) => setForm((value) => ({ ...value, isPublic: event.target.checked }))}
              />
              <span>{form.isPublic ? t("common.public") : t("common.private")}</span>
            </label>
            <Button type="submit" isLoading={createMutation.isPending} disabled={!canSubmit}>
              {t("common.create")}
            </Button>
          </form>
        </Card>

        <Card className="section-card sticky-card">
          <span className="section-card__eyebrow">{t("newRequest.summary")}</span>
          <h3>Ready to sync with the shared city backend</h3>
          <div className="summary-list">
            <div>
              <span>Address</span>
              <strong>{form.address || "—"}</strong>
            </div>
            <div>
              <span>Place</span>
              <strong>{form.place || "—"}</strong>
            </div>
            <div>
              <span>Visibility</span>
              <Badge tone={form.isPublic ? "info" : "neutral"}>
                {form.isPublic ? t("common.public") : t("common.private")}
              </Badge>
            </div>
            <div>
              <span>Files</span>
              <strong>{form.attachments.length}</strong>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
