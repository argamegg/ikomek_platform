import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  CircleAlert,
  Crosshair,
  FileImage,
  ImagePlus,
  LoaderCircle,
  MapPin,
  UploadCloud,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { CivicRequest, SavedLocation, SavedLocationType } from "../../types/platform";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Textarea } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { IssueMap } from "../components/maps/IssueMap";
import { LocationPickerMap } from "../components/maps/LocationPickerMap";
import { getErrorMessage, platformApi, queryKeys } from "../services/platformApi";
import { getDistanceToAstanaKm, isWithinAstanaRequestZone } from "../lib/geoFence";
import {
  reverseGeocodeAstanaPoint,
  searchAstanaAddresses,
  type GeocodedAddressSuggestion,
} from "../lib/locationGeocoding";

const EMPTY_VALUE = "—";
const MIN_DESCRIPTION_LENGTH = 10;
const STEP_ORDER = ["location", "type", "description", "media", "review"] as const;
const SAVED_LOCATION_TYPES: SavedLocationType[] = ["home", "work", "study", "family", "other"];

type StepKey = (typeof STEP_ORDER)[number];

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${size} B`;
}

export function NewRequestPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addressSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseGeocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressSearchAbortRef = useRef<AbortController | null>(null);
  const reverseGeocodeAbortRef = useRef<AbortController | null>(null);
  const addressInputSourceRef = useRef<"manual" | "suggestion" | "reverse" | "saved" | "device">("manual");
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [attemptedNextStep, setAttemptedNextStep] = useState<StepKey | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [addressSearchState, setAddressSearchState] = useState<"idle" | "resolved" | "no-results" | "error">("idle");
  const [addressSuggestions, setAddressSuggestions] = useState<GeocodedAddressSuggestion[]>([]);
  const [searchPreview, setSearchPreview] = useState<GeocodedAddressSuggestion | null>(null);
  const [reverseLookupFailed, setReverseLookupFailed] = useState(false);
  const [saveLocationOpen, setSaveLocationOpen] = useState(false);
  const [saveLocationForm, setSaveLocationForm] = useState({
    label: "",
    type: "home" as SavedLocationType,
  });
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

  const categories = categoriesQuery.data ?? [];
  const savedLocations = savedLocationsQuery.data ?? [];
  const filteredReasons = useMemo(
    () => (reasonsQuery.data ?? []).filter((reason) => reason.categoryId === form.categoryId),
    [form.categoryId, reasonsQuery.data],
  );
  const selectedCategory = categories.find((category) => category.id === form.categoryId) ?? null;
  const selectedReason = filteredReasons.find((reason) => reason.id === form.reasonId) ?? null;
  const selectedSavedLocation = savedLocations.find((location) => location.id === form.savedLocationId) ?? null;
  const latitude = form.lat.trim() ? Number(form.lat) : null;
  const longitude = form.lng.trim() ? Number(form.lng) : null;
  const hasCoordinates = form.lat.trim().length > 0 && form.lng.trim().length > 0;
  const coordinatesAreValid =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);
  const selectedCoordinate = coordinatesAreValid ? { lat: latitude, lng: longitude } : null;
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
  const descriptionIsValid = form.description.trim().length >= MIN_DESCRIPTION_LENGTH;

  const placeSuggestions = useMemo(() => {
    const collected = selectedReason?.placeOptions?.length
      ? selectedReason.placeOptions
      : filteredReasons.flatMap((reason) => reason.placeOptions);

    return Array.from(new Set(collected.filter(Boolean))).slice(0, 6);
  }, [filteredReasons, selectedReason]);

  const attachmentPreviews = useMemo(
    () =>
      form.attachments.map((file) => ({
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    [form.attachments],
  );

  useEffect(() => {
    return () => {
      attachmentPreviews.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, [attachmentPreviews]);

  useEffect(() => {
    return () => {
      if (addressSearchTimeoutRef.current) {
        clearTimeout(addressSearchTimeoutRef.current);
      }

      if (reverseGeocodeTimeoutRef.current) {
        clearTimeout(reverseGeocodeTimeoutRef.current);
      }

      addressSearchAbortRef.current?.abort();
      reverseGeocodeAbortRef.current?.abort();
    };
  }, []);

  const locationStepValid = Boolean(form.address.trim()) && !locationError;
  const typeStepValid = Boolean(form.categoryId && form.reasonId);
  const descriptionStepValid = descriptionIsValid;
  const mediaStepPassable = true;
  const allRequiredStepsValid = locationStepValid && typeStepValid && descriptionStepValid;

  const missingFields = useMemo(() => {
    const fields: string[] = [];

    if (!form.address.trim()) {
      fields.push(t("newRequest.missingFields.address"));
    }

    if (locationError) {
      fields.push(t("newRequest.missingFields.location"));
    }

    if (!form.categoryId) {
      fields.push(t("newRequest.missingFields.category"));
    }

    if (!form.reasonId) {
      fields.push(t("newRequest.missingFields.reason"));
    }

    if (!form.description.trim()) {
      fields.push(t("newRequest.missingFields.description"));
    } else if (!descriptionIsValid) {
      fields.push(t("newRequest.descriptionTooShort"));
    }

    return fields;
  }, [descriptionIsValid, form.address, form.categoryId, form.description, form.reasonId, locationError, t]);

  const stepMeta = useMemo(
    () => [
      {
        key: "location" as StepKey,
        title: t("newRequest.steps.location"),
        description: t("newRequest.stepDescriptions.location"),
        complete: locationStepValid,
        canContinue: locationStepValid,
      },
      {
        key: "type" as StepKey,
        title: t("newRequest.steps.type"),
        description: t("newRequest.stepDescriptions.type"),
        complete: typeStepValid,
        canContinue: typeStepValid,
      },
      {
        key: "description" as StepKey,
        title: t("newRequest.steps.description"),
        description: t("newRequest.stepDescriptions.description"),
        complete: descriptionStepValid,
        canContinue: descriptionStepValid,
      },
      {
        key: "media" as StepKey,
        title: t("newRequest.steps.attachments"),
        description: t("newRequest.stepDescriptions.attachments"),
        complete: currentStep > 3 || form.attachments.length > 0,
        canContinue: mediaStepPassable,
        optional: true,
      },
      {
        key: "review" as StepKey,
        title: t("newRequest.steps.review"),
        description: t("newRequest.stepDescriptions.review"),
        complete: allRequiredStepsValid,
        canContinue: allRequiredStepsValid,
      },
    ],
    [allRequiredStepsValid, currentStep, descriptionStepValid, form.attachments.length, locationStepValid, mediaStepPassable, t, typeStepValid],
  );

  const maxUnlockedStep = useMemo(() => {
    let unlocked = 0;

    for (let index = 0; index < stepMeta.length - 1; index += 1) {
      if (stepMeta[index].canContinue) {
        unlocked = index + 1;
      } else {
        break;
      }
    }

    return unlocked;
  }, [stepMeta]);

  const currentStepKey = STEP_ORDER[currentStep];
  const shouldShowValidation = attemptedNextStep === currentStepKey;
  const canSubmit = missingFields.length === 0 && allRequiredStepsValid;

  const summaryRequest = useMemo<CivicRequest | null>(() => {
    if (!coordinatesAreValid) {
      return null;
    }

    return {
      id: "request-preview",
      citizenId: "preview",
      title: selectedReason?.name ?? selectedCategory?.name ?? t("newRequest.summaryMapTitle"),
      address: form.address || t("newRequest.summaryMapTitle"),
      districtId: selectedSavedLocation?.districtId ?? "",
      point: { lat: latitude, lng: longitude },
      place: form.place || EMPTY_VALUE,
      categoryId: form.categoryId || "preview",
      categoryName: selectedCategory?.name,
      reasonId: form.reasonId || "",
      reasonName: selectedReason?.name,
      description: form.description || t("newRequest.summaryMapEmpty"),
      status: "pending",
      statusLabel: t("newRequest.summaryStatusDraft"),
      priority: "medium",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublic: form.isPublic,
      attachments: [],
      statusHistory: [],
      messages: [],
    };
  }, [
    coordinatesAreValid,
    form.address,
    form.categoryId,
    form.description,
    form.isPublic,
    form.place,
    form.reasonId,
    latitude,
    longitude,
    selectedCategory?.name,
    selectedReason?.name,
    selectedSavedLocation?.districtId,
    t,
  ]);

  const createMutation = useMutation({
    mutationFn: platformApi.createRequest,
    onSuccess: async (request) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.myRequests }),
        queryClient.invalidateQueries({ queryKey: queryKeys.publicRequests }),
      ]);
      toast.success(t("newRequest.success"));
      startTransition(() => navigate(`/requests/${request.id}`));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const createSavedLocationMutation = useMutation({
    mutationFn: () => {
      if (!coordinatesAreValid || latitude === null || longitude === null) {
        throw new Error(t("newRequest.invalidCoordinates"));
      }

      const label = saveLocationForm.label.trim();
      if (!label) {
        throw new Error(t("cabinet.saved.formRequired"));
      }

      return platformApi.createSavedLocation({
        label,
        type: saveLocationForm.type,
        address: form.address.trim(),
        districtId: "",
        lat: latitude,
        lng: longitude,
      });
    },
    onSuccess: async (location) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.savedLocations });
      setForm((current) => ({ ...current, savedLocationId: location.id }));
      setSaveLocationOpen(false);
      setSaveLocationForm({ label: "", type: "home" });
      toast.success(t("newRequest.locationSaved"));
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  function updateForm<Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateLocationForm(
    updates: Partial<Pick<typeof form, "savedLocationId" | "address" | "lat" | "lng">>,
  ) {
    setForm((current) => ({
      ...current,
      ...updates,
    }));
  }

  function resetLocationAssistState() {
    setReverseLookupFailed(false);
    setAddressSuggestions([]);
    setSearchPreview(null);
    setAddressSearchState("idle");
    setIsSearchingAddress(false);
    addressSearchAbortRef.current?.abort();
    if (addressSearchTimeoutRef.current) {
      clearTimeout(addressSearchTimeoutRef.current);
    }
  }

  function handleAddressInputChange(value: string) {
    addressInputSourceRef.current = "manual";
    setReverseLookupFailed(false);
    updateLocationForm({
      savedLocationId: "",
      address: value,
    });
  }

  function applySuggestedLocation(suggestion: GeocodedAddressSuggestion, source: "suggestion" | "saved" = "suggestion") {
    addressInputSourceRef.current = source;
    setReverseLookupFailed(false);
    setSearchPreview(suggestion);
    setAddressSuggestions([]);
    setAddressSearchState("resolved");
    setIsSearchingAddress(false);
    updateLocationForm({
      savedLocationId: "",
      address: suggestion.label,
      lat: String(suggestion.lat),
      lng: String(suggestion.lng),
    });
  }

  function scheduleReverseGeocode(lat: number, lng: number) {
    reverseGeocodeAbortRef.current?.abort();
    if (reverseGeocodeTimeoutRef.current) {
      clearTimeout(reverseGeocodeTimeoutRef.current);
    }

    setReverseLookupFailed(false);
    reverseGeocodeTimeoutRef.current = setTimeout(() => {
      const controller = new AbortController();
      reverseGeocodeAbortRef.current = controller;

      void reverseGeocodeAstanaPoint(lat, lng, i18n.resolvedLanguage ?? "en", controller.signal)
        .then((address) => {
          if (!address.trim()) {
            setReverseLookupFailed(true);
            return;
          }

          addressInputSourceRef.current = "reverse";
          setAddressSuggestions([]);
          setSearchPreview(null);
          setAddressSearchState("idle");
          setReverseLookupFailed(false);
          updateLocationForm({
            savedLocationId: "",
            address,
            lat: String(lat),
            lng: String(lng),
          });
        })
        .catch((error: unknown) => {
          if (
            error instanceof DOMException &&
            error.name === "AbortError"
          ) {
            return;
          }

          setReverseLookupFailed(true);
        });
    }, 250);
  }

  function applySavedLocation(location: SavedLocation | null) {
    addressInputSourceRef.current = location ? "saved" : "manual";
    addressSearchAbortRef.current?.abort();
    setReverseLookupFailed(false);
    setIsSearchingAddress(false);
    setAddressSuggestions([]);
    setSearchPreview(null);
    setAddressSearchState("idle");

    setForm((current) => ({
      ...current,
      savedLocationId: location?.id ?? "",
      address: location?.address ?? current.address,
      lat: location ? String(location.point.lat) : current.lat,
      lng: location ? String(location.point.lng) : current.lng,
      place: location?.type ?? current.place,
    }));
  }

  function appendFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setForm((current) => ({
      ...current,
      attachments: [...current.attachments, ...files],
    }));
  }

  function removeAttachment(fileName: string) {
    setForm((current) => ({
      ...current,
      attachments: current.attachments.filter((file) => file.name !== fileName),
    }));
  }

  function goToStep(nextStep: number) {
    if (nextStep < 0 || nextStep > maxUnlockedStep) {
      return;
    }

    setDirection(nextStep > currentStep ? 1 : -1);
    setCurrentStep(nextStep);
    setAttemptedNextStep(null);
  }

  function handleNextStep() {
    if (!stepMeta[currentStep].canContinue) {
      setAttemptedNextStep(currentStepKey);
      return;
    }

    goToStep(Math.min(currentStep + 1, STEP_ORDER.length - 1));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || !coordinatesAreValid) {
      setAttemptedNextStep("review");
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
  }

  function handleLocateMe() {
    if (!navigator.geolocation) {
      toast.error(t("newRequest.geolocateUnavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        addressInputSourceRef.current = "device";
        addressSearchAbortRef.current?.abort();
        setIsSearchingAddress(false);
        setAddressSuggestions([]);
        setSearchPreview(null);
        setAddressSearchState("idle");
        updateLocationForm({
          savedLocationId: "",
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude),
        });
        scheduleReverseGeocode(position.coords.latitude, position.coords.longitude);
      },
      () => toast.error(t("newRequest.geolocateError")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function openSaveLocationForm() {
    setSaveLocationForm((current) => ({
      ...current,
      label: current.label || selectedSavedLocation?.label || form.place || form.address.split(",")[0]?.trim() || t("cabinet.saved.labelPlaceholder"),
    }));
    setSaveLocationOpen(true);
  }

  function handleMapCoordinateChange(coordinate: { lat: number; lng: number }) {
    addressInputSourceRef.current = "reverse";
    addressSearchAbortRef.current?.abort();
    setIsSearchingAddress(false);
    setAddressSuggestions([]);
    setSearchPreview(null);
    setAddressSearchState("idle");
    updateLocationForm({
      savedLocationId: "",
      lat: String(coordinate.lat),
      lng: String(coordinate.lng),
    });
    scheduleReverseGeocode(coordinate.lat, coordinate.lng);
  }

  function getPlaceOptionLabel(option: string) {
    return t(`newRequest.placeOptions.${option}`, { defaultValue: option.replace(/_/g, " ") });
  }

  useEffect(() => {
    if (addressInputSourceRef.current !== "manual") {
      return;
    }

    const query = form.address.trim();

    if (query.length < 3) {
      resetLocationAssistState();
      return;
    }

    if (addressSearchTimeoutRef.current) {
      clearTimeout(addressSearchTimeoutRef.current);
    }

    addressSearchTimeoutRef.current = setTimeout(() => {
      addressSearchAbortRef.current?.abort();
      const controller = new AbortController();
      addressSearchAbortRef.current = controller;
      setIsSearchingAddress(true);

      void searchAstanaAddresses(query, i18n.resolvedLanguage ?? "en", controller.signal)
        .then((results) => {
          setIsSearchingAddress(false);
          setAddressSuggestions(results);

          if (results.length === 0) {
            setSearchPreview(null);
            setAddressSearchState("no-results");
            return;
          }

          setSearchPreview(results[0]);
          setAddressSearchState("resolved");
          updateLocationForm({
            savedLocationId: "",
            lat: String(results[0].lat),
            lng: String(results[0].lng),
          });
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          setIsSearchingAddress(false);
          setSearchPreview(null);
          setAddressSuggestions([]);
          setAddressSearchState("error");
        });
    }, 450);

    return () => {
      if (addressSearchTimeoutRef.current) {
        clearTimeout(addressSearchTimeoutRef.current);
      }
    };
  }, [form.address, i18n.resolvedLanguage]);

  function getStepValidationMessage(stepKey: StepKey) {
    switch (stepKey) {
      case "location":
        return locationError ?? t("newRequest.stepErrors.location");
      case "type":
        return t("newRequest.stepErrors.type");
      case "description":
        return !form.description.trim()
          ? t("newRequest.stepErrors.descriptionRequired")
          : t("newRequest.stepErrors.descriptionLength", { count: MIN_DESCRIPTION_LENGTH });
      case "review":
        return t("newRequest.stepErrors.review");
      default:
        return null;
    }
  }

  const validationMessage = shouldShowValidation ? getStepValidationMessage(currentStepKey) : null;
  const addressAssistText = isSearchingAddress
    ? t("newRequest.addressSearchLoading")
    : addressSearchState === "no-results"
      ? t("newRequest.addressSearchNoResults")
      : addressSearchState === "error"
        ? t("newRequest.addressSearchError")
        : searchPreview
          ? t("newRequest.addressSearchResolved", { address: searchPreview.secondaryLabel ?? searchPreview.label })
          : t("newRequest.addressSearchHint");
  const locationMapHint = reverseLookupFailed
    ? t("newRequest.locationMapFallback")
    : t("newRequest.locationMapHint");

  function renderLocationStep() {
    return (
      <>
        <div className="request-flow-section__header">
          <div className="request-flow-section__meta">
            <span className="request-flow-section__step">1</span>
            <div>
              <h2>{t("newRequest.locationTitle")}</h2>
              <p>{t("newRequest.locationDescription")}</p>
            </div>
          </div>
          <Badge tone={locationError ? "warning" : "success"}>
            {locationError ? t("newRequest.sectionStatusNeedsAttention") : t("newRequest.sectionStatusReady")}
          </Badge>
        </div>

        {savedLocations.length > 0 ? (
          <div className="request-flow-saved">
            <div className="request-flow-subtitle">
              <strong>{t("newRequest.savedPlacesTitle")}</strong>
              <span>{t("newRequest.savedPlacesDescription")}</span>
            </div>
            <div className="request-flow-saved__grid">
              <button
                type="button"
                className={`request-flow-saved__item${!form.savedLocationId ? " is-selected" : ""}`}
                onClick={() => applySavedLocation(null)}
              >
                <span>{t("newRequest.manualLocationTitle")}</span>
                <small>{t("newRequest.manualLocationDescription")}</small>
              </button>
              {savedLocations.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  className={`request-flow-saved__item${form.savedLocationId === location.id ? " is-selected" : ""}`}
                  onClick={() => applySavedLocation(location)}
                >
                  <span>{location.label}</span>
                  <small>{t(`savedLocationTypes.${location.type}`)} · {location.address}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {locationStepValid && !selectedSavedLocation ? (
          <div className="request-flow-save-current">
            <div>
              <strong>{t("newRequest.saveCurrentLocation")}</strong>
              <span>{t("newRequest.saveCurrentLocationHint")}</span>
            </div>
            <Button type="button" variant="secondary" iconLeft={<MapPin size={16} />} onClick={openSaveLocationForm}>
              {t("cabinet.saved.add")}
            </Button>
          </div>
        ) : null}

        {saveLocationOpen ? (
          <div className="request-flow-save-form">
            <label>
              <span>{t("cabinet.saved.label")}</span>
              <input
                value={saveLocationForm.label}
                onChange={(event) => setSaveLocationForm((current) => ({ ...current, label: event.target.value }))}
                placeholder={t("cabinet.saved.labelPlaceholder")}
              />
            </label>
            <label>
              <span>{t("cabinet.saved.type")}</span>
              <select
                value={saveLocationForm.type}
                onChange={(event) => setSaveLocationForm((current) => ({ ...current, type: event.target.value as SavedLocationType }))}
              >
                {SAVED_LOCATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`savedLocationTypes.${type}`)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              onClick={() => createSavedLocationMutation.mutate()}
              disabled={createSavedLocationMutation.isPending}
            >
              {createSavedLocationMutation.isPending ? t("common.loading") : t("cabinet.saved.save")}
            </Button>
          </div>
        ) : null}

        <div className="request-flow-location">
          <label className="field request-flow-location-search">
            <span className="field__label">{t("newRequest.address")}</span>
            <span className="field__control">
              <input
                className="field__input"
                placeholder={t("newRequest.addressPlaceholder")}
                value={form.address}
                onChange={(event) => handleAddressInputChange(event.target.value)}
                required
              />
              {isSearchingAddress ? <LoaderCircle size={18} className="request-flow-location-search__spinner" /> : null}
            </span>
            <span className="field__message">{addressAssistText}</span>

            {addressSuggestions.length > 0 ? (
              <div className="request-flow-location-search__suggestions">
                {addressSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="request-flow-location-search__suggestion"
                    onClick={() => applySuggestedLocation(suggestion)}
                  >
                    <strong>{suggestion.secondaryLabel ?? suggestion.label}</strong>
                    <span>{suggestion.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </label>

          <div className="request-flow-location-map-block">
            <div className="request-flow-subtitle">
              <strong>{t("newRequest.locationMapTitle")}</strong>
              <span>{t("newRequest.locationMapDescription")}</span>
            </div>

            <LocationPickerMap coordinate={selectedCoordinate} onCoordinateChange={handleMapCoordinateChange} />

            <div className="request-flow-location-map-block__hint">
              <MapPin size={16} />
              <span>{locationMapHint}</span>
            </div>
          </div>

          <div className="request-flow-actions">
            <Button
              type="button"
              variant="secondary"
              iconLeft={<Crosshair size={16} />}
              onClick={handleLocateMe}
            >
              {t("newRequest.geolocate")}
            </Button>
            <div className={`request-flow-zone${locationError ? " is-error" : ""}`}>
              <MapPin size={16} />
              <span>
                {locationError
                  ? locationError
                  : t("newRequest.zoneHint", { distance: Math.round(distanceToAstanaKm ?? 0) })}
              </span>
            </div>
          </div>

          <details className="request-flow-advanced">
            <summary>{t("newRequest.advancedCoordinates")}</summary>
            <div className="inline-grid">
              <Input
                label={t("newRequest.latitude")}
                type="number"
                step="any"
                value={form.lat}
                onChange={(event) => updateForm("lat", event.target.value)}
              />
              <Input
                label={t("newRequest.longitude")}
                type="number"
                step="any"
                value={form.lng}
                onChange={(event) => updateForm("lng", event.target.value)}
              />
            </div>
          </details>
        </div>
      </>
    );
  }

  function renderTypeStep() {
    return (
      <>
        <div className="request-flow-section__header">
          <div className="request-flow-section__meta">
            <span className="request-flow-section__step">2</span>
            <div>
              <h2>{t("newRequest.typeTitle")}</h2>
              <p>{t("newRequest.typeDescription")}</p>
            </div>
          </div>
        </div>

        <div className="request-flow-subtitle">
          <strong>{t("newRequest.categoryTitle")}</strong>
          <span>{t("newRequest.categoryDescription")}</span>
        </div>
        <div className="request-flow-choice-grid request-flow-choice-grid--cards">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`request-flow-choice request-flow-choice--card${form.categoryId === category.id ? " is-selected" : ""}`}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  categoryId: category.id,
                  reasonId: "",
                  place: "",
                }))
              }
            >
              <span className="request-flow-choice__badge">{category.code.toUpperCase().slice(0, 3)}</span>
              <strong>{category.name}</strong>
            </button>
          ))}
        </div>

        <div className="request-flow-subtitle">
          <strong>{t("newRequest.reasonTitle")}</strong>
          <span>
            {form.categoryId
              ? t("newRequest.reasonDescription")
              : t("newRequest.reasonPlaceholderHint")}
          </span>
        </div>
        {form.categoryId ? (
          <div className="request-flow-choice-grid request-flow-choice-grid--chips">
            {filteredReasons.map((reason) => (
              <button
                key={reason.id}
                type="button"
                className={`request-flow-chip${form.reasonId === reason.id ? " is-selected" : ""}`}
                onClick={() => updateForm("reasonId", reason.id)}
              >
                {reason.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="request-flow-empty">{t("newRequest.selectCategoryFirst")}</div>
        )}

        {placeSuggestions.length > 0 ? (
          <>
            <div className="request-flow-subtitle">
              <strong>{t("newRequest.placeTitle")}</strong>
              <span>{t("newRequest.placeDescription")}</span>
            </div>
            <div className="request-flow-choice-grid request-flow-choice-grid--chips">
              {placeSuggestions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`request-flow-chip${form.place === option ? " is-selected" : ""}`}
                  onClick={() => updateForm("place", option)}
                >
                  {getPlaceOptionLabel(option)}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </>
    );
  }

  function renderDescriptionStep() {
    return (
      <>
        <div className="request-flow-section__header">
          <div className="request-flow-section__meta">
            <span className="request-flow-section__step">3</span>
            <div>
              <h2>{t("newRequest.descriptionTitle")}</h2>
              <p>{t("newRequest.descriptionDescription")}</p>
            </div>
          </div>
        </div>

        <Input
          label={t("newRequest.place")}
          placeholder={t("newRequest.placePlaceholder")}
          value={form.place}
          onChange={(event) => updateForm("place", event.target.value)}
          helper={t("newRequest.placeHelper")}
          required
        />
        <Textarea
          label={t("newRequest.descriptionLabel")}
          rows={7}
          placeholder={t("newRequest.descriptionPlaceholder")}
          helper={t("newRequest.descriptionHelper")}
          error={
            shouldShowValidation && !descriptionIsValid
              ? (!form.description.trim()
                  ? t("newRequest.stepErrors.descriptionRequired")
                  : t("newRequest.stepErrors.descriptionLength", { count: MIN_DESCRIPTION_LENGTH }))
              : undefined
          }
          value={form.description}
          onChange={(event) => updateForm("description", event.target.value)}
          required
        />
      </>
    );
  }

  function renderMediaStep() {
    return (
      <>
        <div className="request-flow-section__header">
          <div className="request-flow-section__meta">
            <span className="request-flow-section__step">4</span>
            <div>
              <h2>{t("newRequest.attachmentsTitle")}</h2>
              <p>{t("newRequest.attachmentsDescription")}</p>
            </div>
          </div>
          <Badge tone="info">{t("newRequest.optional")}</Badge>
        </div>

        <div
          className={`request-flow-upload${isDraggingFiles ? " is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDraggingFiles(true);
          }}
          onDragLeave={() => setIsDraggingFiles(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDraggingFiles(false);
            appendFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <div className="request-flow-upload__icon">
            <UploadCloud size={20} />
          </div>
          <div className="request-flow-upload__copy">
            <strong>{t("newRequest.uploadTitle")}</strong>
            <p>{t("newRequest.uploadDescription")}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            iconLeft={<ImagePlus size={16} />}
            onClick={() => fileInputRef.current?.click()}
          >
            {t("newRequest.chooseFiles")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="request-flow-upload__input"
            onChange={(event) => appendFiles(Array.from(event.target.files ?? []))}
          />
        </div>

        {attachmentPreviews.length > 0 ? (
          <div className="request-flow-files">
            {attachmentPreviews.map(({ file, previewUrl }) => (
              <div key={`${file.name}-${file.size}`} className="request-flow-file">
                <div className="request-flow-file__preview">
                  {previewUrl ? (
                    <img src={previewUrl} alt={file.name} />
                  ) : (
                    <FileImage size={18} />
                  )}
                </div>
                <div className="request-flow-file__meta">
                  <strong>{file.name}</strong>
                  <span>{formatFileSize(file.size)}</span>
                </div>
                <button
                  type="button"
                  className="request-flow-file__remove"
                  onClick={() => removeAttachment(file.name)}
                >
                  {t("newRequest.removeFile")}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="request-flow-visibility">
          <div className="request-flow-visibility__copy">
            <strong>{t("newRequest.visibilityTitle")}</strong>
            <p>{t("newRequest.visibilityDescription")}</p>
          </div>
          <label className="switcher request-flow-switcher">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(event) => updateForm("isPublic", event.target.checked)}
            />
            <span>{form.isPublic ? t("newRequest.visibilityPublic") : t("newRequest.visibilityPrivate")}</span>
          </label>
        </div>
      </>
    );
  }

  function renderReviewStep() {
    return (
      <>
        <div className="request-flow-section__header">
          <div className="request-flow-section__meta">
            <span className="request-flow-section__step">5</span>
            <div>
              <h2>{t("newRequest.reviewTitle")}</h2>
              <p>{t("newRequest.reviewDescription")}</p>
            </div>
          </div>
        </div>

        <div className="request-flow-review request-flow-review--final">
          <div className="request-flow-review__status">
            <Badge tone={canSubmit ? "success" : "warning"}>
              {canSubmit ? t("newRequest.summaryStatusReady") : t("newRequest.summaryStatusDraft")}
            </Badge>
            <span>
              {canSubmit
                ? t("newRequest.reviewReady")
                : t("newRequest.reviewPending", { count: missingFields.length })}
            </span>
          </div>
          {missingFields.length > 0 ? (
            <ul className="request-flow-inline-missing">
              {missingFields.map((field) => (
                <li key={field}>
                  <CircleAlert size={16} />
                  <span>{field}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </>
    );
  }

  function renderCurrentStep() {
    switch (currentStepKey) {
      case "location":
        return renderLocationStep();
      case "type":
        return renderTypeStep();
      case "description":
        return renderDescriptionStep();
      case "media":
        return renderMediaStep();
      case "review":
        return renderReviewStep();
      default:
        return null;
    }
  }

  return (
    <div className="page-stack request-flow-page">
      <PageHeader title={t("newRequest.title")} description={t("newRequest.description")} />

      <div className="request-stepper" aria-label={t("newRequest.progressLabel")}>
        {stepMeta.map((step, index) => {
          const isActive = index === currentStep;
          const isDisabled = index > maxUnlockedStep;

          return (
            <motion.button
              key={step.key}
              type="button"
              className={`request-stepper__item${step.complete ? " is-complete" : ""}${isActive ? " is-active" : ""}`}
              disabled={isDisabled}
              onClick={() => goToStep(index)}
              whileTap={isDisabled ? undefined : { scale: 0.98 }}
              animate={step.complete ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={{ duration: 0.26 }}
            >
              <div className="request-stepper__index">
                {step.complete ? <CheckCircle2 size={18} /> : <span>{index + 1}</span>}
              </div>
              <div className="request-stepper__copy">
                <strong>{step.title}</strong>
                <p>
                  {step.description}
                  {step.optional ? ` • ${t("newRequest.optional")}` : ""}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <form className="request-flow-layout" onSubmit={handleSubmit}>
        <div className="request-flow-main">
          <Card className="section-card request-flow-stage" hover={false}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentStepKey}
                className="request-flow-stage__content"
                initial={{ opacity: 0, x: direction > 0 ? 34 : -34 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction > 0 ? -34 : 34 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
              >
                {renderCurrentStep()}
              </motion.div>
            </AnimatePresence>

            {validationMessage ? (
              <div className="request-flow-inline-error">
                <CircleAlert size={16} />
                <span>{validationMessage}</span>
              </div>
            ) : null}

            <div className="request-flow-stage__actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => goToStep(Math.max(currentStep - 1, 0))}
                disabled={currentStep === 0}
              >
                {t("newRequest.back")}
              </Button>

              {currentStep === STEP_ORDER.length - 1 ? (
                <Button type="submit" size="lg" isLoading={createMutation.isPending} disabled={!canSubmit}>
                  {t("newRequest.submit")}
                </Button>
              ) : (
                <Button type="button" size="lg" onClick={handleNextStep}>
                  {currentStepKey === "media" ? t("newRequest.continueToReview") : t("newRequest.next")}
                </Button>
              )}
            </div>
          </Card>
        </div>

        <aside className="request-flow-side">
          <Card className="section-card sticky-card request-flow-summary" hover={false}>
            <div className="request-flow-summary__header">
              <div>
                <span className="section-card__eyebrow">{t("newRequest.summary")}</span>
                <h3>{t("newRequest.summaryTitle")}</h3>
              </div>
              <Badge tone={canSubmit ? "success" : "warning"}>
                {canSubmit ? t("newRequest.summaryStatusReady") : t("newRequest.summaryStatusDraft")}
              </Badge>
            </div>

            {summaryRequest ? (
              <div className="request-flow-summary__map">
                <IssueMap requests={[summaryRequest]} mode="all" />
              </div>
            ) : (
              <div className="request-flow-summary__empty-map">
                <MapPin size={18} />
                <span>{t("newRequest.summaryMapEmpty")}</span>
              </div>
            )}

            <div className="summary-list request-flow-summary__list">
              <div>
                <span>{t("newRequest.summaryItems.address")}</span>
                <strong>{form.address || EMPTY_VALUE}</strong>
              </div>
              <div>
                <span>{t("newRequest.summaryItems.place")}</span>
                <strong>{form.place ? getPlaceOptionLabel(form.place) : EMPTY_VALUE}</strong>
              </div>
              <div>
                <span>{t("newRequest.summaryItems.category")}</span>
                <strong>{selectedCategory?.name || EMPTY_VALUE}</strong>
              </div>
              <div>
                <span>{t("newRequest.summaryItems.reason")}</span>
                <strong>{selectedReason?.name || EMPTY_VALUE}</strong>
              </div>
              <div>
                <span>{t("newRequest.summaryItems.files")}</span>
                <strong>{t("newRequest.attachmentsCount", { count: form.attachments.length })}</strong>
              </div>
              <div>
                <span>{t("newRequest.summaryItems.visibility")}</span>
                <strong>{form.isPublic ? t("newRequest.visibilityPublic") : t("newRequest.visibilityPrivate")}</strong>
              </div>
              <div>
                <span>{t("newRequest.summaryItems.coordinates")}</span>
                <strong>
                  {coordinatesAreValid ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : EMPTY_VALUE}
                </strong>
              </div>
            </div>

            <div className="request-flow-summary__checks">
              <div className="request-flow-subtitle">
                <strong>{t("newRequest.missingFieldsTitle")}</strong>
                <span>{t("newRequest.summaryDescription")}</span>
              </div>
              {missingFields.length > 0 ? (
                <ul className="request-flow-summary__missing">
                  {missingFields.map((field) => (
                    <li key={field}>
                      <CircleAlert size={16} />
                      <span>{field}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="request-flow-summary__ready">
                  <CheckCircle2 size={18} />
                  <span>{t("newRequest.summaryReadyDescription")}</span>
                </div>
              )}
            </div>
          </Card>
        </aside>
      </form>
    </div>
  );
}
