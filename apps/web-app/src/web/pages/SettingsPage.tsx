import { SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 160px)",
        gap: "16px",
        color: "#9CA3AF",
        textAlign: "center",
      }}
    >
      <SettingsIcon size={48} style={{ opacity: 0.3 }} />
      <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#1F2937" }}>
        Настройки
      </h2>
      <p style={{ fontSize: "16px" }}>Скоро</p>
    </div>
  );
}
