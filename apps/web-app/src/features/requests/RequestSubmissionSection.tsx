import { type FormEvent, useMemo, useState } from "react";
import type { Copy } from "../../App";
import { requestFlowSteps } from "../../data/platformData";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";
import type {
  RequestCategory,
  RequestReason,
  SavedLocation,
} from "../../types/platform";

type RequestSubmissionSectionProps = {
  copy: Copy;
  savedLocations: SavedLocation[];
  categories: RequestCategory[];
  reasons: RequestReason[];
  onSubmit: (payload: {
    address: string;
    savedLocationId?: string;
    lat?: number;
    lng?: number;
    place: string;
    categoryId: string;
    reasonId: string;
    description: string;
    isPublic: boolean;
    attachments: File[];
  }) => Promise<unknown>;
};

export function RequestSubmissionSection({
  copy,
  savedLocations,
  categories,
  reasons,
  onSubmit,
}: RequestSubmissionSectionProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    savedLocationId: savedLocations[0]?.id ?? "",
    address: savedLocations[0]?.address ?? "",
    lat: savedLocations[0]?.point.lat ?? 51.1,
    lng: savedLocations[0]?.point.lng ?? 71.43,
    place: "",
    categoryId: categories[0]?.id ?? "",
    reasonId: "",
    description: "",
    isPublic: true,
    attachments: [] as File[],
  });

  const filteredReasons = useMemo(
    () => reasons.filter((reason) => reason.categoryId === form.categoryId),
    [reasons, form.categoryId],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      await onSubmit({
        ...form,
        reasonId: form.reasonId || filteredReasons[0]?.id || "",
      });
      setStatus("Request submitted successfully.");
      setForm((current) => ({
        ...current,
        description: "",
        attachments: [],
      }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="section">
      <SectionHeading
        kicker={copy.requestFlow.kicker}
        title={copy.requestFlow.title}
        description={copy.requestFlow.description}
      />
      <div className="flow-grid">
        {requestFlowSteps.map((step, index) => (
          <Card key={step} className="flow-card">
            <span className="flow-card__index">{index + 1}</span>
            <h3>{step}</h3>
          </Card>
        ))}
      </div>
      <Card>
        <form className="form-grid form-grid--two" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Saved address</span>
            <select
              className="text-input"
              value={form.savedLocationId}
              onChange={(event) => {
                const selected = savedLocations.find((item) => item.id === event.target.value);
                setForm((current) => ({
                  ...current,
                  savedLocationId: event.target.value,
                  address: selected?.address ?? current.address,
                  lat: selected?.point.lat ?? current.lat,
                  lng: selected?.point.lng ?? current.lng,
                }));
              }}
            >
              <option value="">Manual entry</option>
              {savedLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label} • {location.address}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Address</span>
            <input
              className="text-input"
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              required
            />
          </label>
          <label className="form-field">
            <span>Issue type</span>
            <select
              className="text-input"
              value={form.categoryId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  categoryId: event.target.value,
                  reasonId: "",
                  place: "",
                }))
              }
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Reason</span>
            <select
              className="text-input"
              value={form.reasonId}
              onChange={(event) => setForm((current) => ({ ...current, reasonId: event.target.value }))}
            >
              {filteredReasons.map((reason) => (
                <option key={reason.id} value={reason.id}>
                  {reason.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Place</span>
            <select
              className="text-input"
              value={form.place}
              onChange={(event) => setForm((current) => ({ ...current, place: event.target.value }))}
              required
            >
              <option value="">Select place</option>
              {filteredReasons
                .flatMap((reason) => reason.placeOptions)
                .filter((value, index, items) => items.indexOf(value) === index)
                .map((place) => (
                  <option key={place} value={place}>
                    {place}
                  </option>
                ))}
            </select>
          </label>
          <label className="form-field">
            <span>Latitude</span>
            <input
              className="text-input"
              type="number"
              step="0.0001"
              value={form.lat}
              onChange={(event) => setForm((current) => ({ ...current, lat: Number(event.target.value) }))}
            />
          </label>
          <label className="form-field">
            <span>Longitude</span>
            <input
              className="text-input"
              type="number"
              step="0.0001"
              value={form.lng}
              onChange={(event) => setForm((current) => ({ ...current, lng: Number(event.target.value) }))}
            />
          </label>
          <label className="form-field form-field--full">
            <span>Description</span>
            <textarea
              className="text-input text-input--area"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={5}
              required
            />
          </label>
          <label className="form-field form-field--full">
            <span>Attachments</span>
            <input
              className="text-input"
              type="file"
              multiple
              accept="image/*"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  attachments: Array.from(event.target.files ?? []),
                }))
              }
            />
          </label>
          <label className="form-field form-field--full form-field--checkbox">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(event) => setForm((current) => ({ ...current, isPublic: event.target.checked }))}
            />
            <span>Allow this request to appear in public city map analytics.</span>
          </label>
          <Button
            label={isSubmitting ? "Submitting..." : "Submit request"}
            type="submit"
            disabled={isSubmitting}
          />
        </form>
        {status ? <p className="form-status">{status}</p> : null}
      </Card>
    </section>
  );
}
