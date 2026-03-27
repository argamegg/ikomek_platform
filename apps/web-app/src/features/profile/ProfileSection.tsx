import { type FormEvent, useState } from "react";
import type { Copy } from "../../App";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";
import type { District, SavedLocation, User } from "../../types/platform";

type ProfileSectionProps = {
  copy: Copy;
  currentUser: User;
  savedLocations: SavedLocation[];
  districts: District[];
  onUpdateProfile: (payload: {
    name: string;
    phone: string;
    language: "en" | "ru" | "kz";
    notificationsEnabled: boolean;
  }) => Promise<unknown>;
  onCreateSavedLocation: (payload: {
    label: string;
    type: "home" | "work" | "study" | "road" | "environment" | "other";
    address: string;
    districtId: string;
    lat: number;
    lng: number;
  }) => Promise<unknown>;
};

export function ProfileSection({
  copy,
  currentUser,
  savedLocations,
  districts,
  onUpdateProfile,
  onCreateSavedLocation,
}: ProfileSectionProps) {
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: currentUser.name,
    phone: currentUser.phone ?? "",
    language: currentUser.language,
    notificationsEnabled: currentUser.notificationsEnabled,
  });
  const [locationForm, setLocationForm] = useState({
    label: "",
    type: "other" as const,
    address: "",
    districtId: districts[0]?.id ?? "",
    lat: 51.1,
    lng: 71.43,
  });

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onUpdateProfile(profileForm);
      setProfileStatus("Profile updated.");
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : "Profile update failed.");
    }
  }

  async function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onCreateSavedLocation(locationForm);
      setLocationStatus("Saved location created.");
      setLocationForm((current) => ({ ...current, label: "", address: "" }));
    } catch (error) {
      setLocationStatus(error instanceof Error ? error.message : "Saved location creation failed.");
    }
  }

  return (
    <section className="section">
      <SectionHeading
        kicker={copy.profile.kicker}
        title={copy.profile.title}
        description={copy.profile.description}
      />
      <div className="cards-grid cards-grid--two">
        <Card>
          <h3>Profile settings</h3>
          <form className="form-grid" onSubmit={submitProfile}>
            <label className="form-field">
              <span>Name</span>
              <input
                className="text-input"
                value={profileForm.name}
                onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>Phone</span>
              <input
                className="text-input"
                value={profileForm.phone}
                onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>Language</span>
              <select
                className="text-input"
                value={profileForm.language}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    language: event.target.value as "en" | "ru" | "kz",
                  }))
                }
              >
                <option value="en">English</option>
                <option value="ru">Russian</option>
                <option value="kz">Kazakh</option>
              </select>
            </label>
            <label className="form-field form-field--checkbox">
              <input
                type="checkbox"
                checked={profileForm.notificationsEnabled}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    notificationsEnabled: event.target.checked,
                  }))
                }
              />
              <span>Enable notifications</span>
            </label>
            <Button label="Save profile" type="submit" />
          </form>
          {profileStatus ? <p className="form-status">{profileStatus}</p> : null}
        </Card>
        <Card>
          <h3>Add saved location</h3>
          <form className="form-grid" onSubmit={submitLocation}>
            <label className="form-field">
              <span>Label</span>
              <input
                className="text-input"
                value={locationForm.label}
                onChange={(event) => setLocationForm((current) => ({ ...current, label: event.target.value }))}
                required
              />
            </label>
            <label className="form-field">
              <span>Type</span>
              <select
                className="text-input"
                value={locationForm.type}
                onChange={(event) =>
                  setLocationForm((current) => ({
                    ...current,
                    type: event.target.value as typeof locationForm.type,
                  }))
                }
              >
                <option value="home">Home</option>
                <option value="work">Work</option>
                <option value="study">Study</option>
                <option value="road">Road</option>
                <option value="environment">Environment</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="form-field">
              <span>Address</span>
              <input
                className="text-input"
                value={locationForm.address}
                onChange={(event) => setLocationForm((current) => ({ ...current, address: event.target.value }))}
                required
              />
            </label>
            <label className="form-field">
              <span>District</span>
              <select
                className="text-input"
                value={locationForm.districtId}
                onChange={(event) =>
                  setLocationForm((current) => ({ ...current, districtId: event.target.value }))
                }
              >
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
            </label>
            <Button label="Add saved location" type="submit" />
          </form>
          {locationStatus ? <p className="form-status">{locationStatus}</p> : null}
          <div className="saved-locations-list">
            {savedLocations.map((item) => (
              <div key={item.id} className="saved-locations-list__item">
                <strong>{item.label}</strong>
                <span>{item.address}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
