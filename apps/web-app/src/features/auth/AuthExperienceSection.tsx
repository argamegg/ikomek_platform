import { type FormEvent, useState } from "react";
import type { Copy } from "../../App";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";
import type { Locale } from "../../types/platform";
import { Button } from "../../components/ui/Button";

type AuthMode = "login" | "register" | "recover";

type AuthExperienceSectionProps = {
  copy: Copy;
  onLogin: (payload: { email: string; password: string }) => Promise<void>;
  onRegister: (payload: {
    name: string;
    email: string;
    password: string;
    language: Locale;
  }) => Promise<void>;
  onRecover: (payload: { email: string }) => Promise<void>;
};

export function AuthExperienceSection({
  copy,
  onLogin,
  onRegister,
  onRecover,
}: AuthExperienceSectionProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    language: "en" as Locale,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      if (mode === "login") {
        await onLogin({ email: form.email, password: form.password });
        setStatus("Signed in successfully.");
      } else if (mode === "register") {
        await onRegister(form);
        setStatus("Account created successfully.");
      } else {
        await onRecover({ email: form.email });
        setStatus("Password recovery request submitted.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="section">
      <SectionHeading
        kicker={copy.auth.kicker}
        title={copy.auth.title}
        description={copy.auth.description}
      />
      <div className="auth-grid">
        <Card className="auth-panel">
          <div className="badge-row">
            <Button label="Login" variant="chip" isActive={mode === "login"} onClick={() => setMode("login")} />
            <Button label="Register" variant="chip" isActive={mode === "register"} onClick={() => setMode("register")} />
            <Button label="Recover" variant="chip" isActive={mode === "recover"} onClick={() => setMode("recover")} />
          </div>
          <form className="form-grid" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <label className="form-field">
                <span>Full name</span>
                <input
                  className="text-input"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>
            ) : null}
            <label className="form-field">
              <span>Email</span>
              <input
                className="text-input"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            {mode !== "recover" ? (
              <label className="form-field">
                <span>Password</span>
                <input
                  className="text-input"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  required
                />
              </label>
            ) : null}
            {mode === "register" ? (
              <label className="form-field">
                <span>Language</span>
                <select
                  className="text-input"
                  value={form.language}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, language: event.target.value as Locale }))
                  }
                >
                  <option value="en">English</option>
                  <option value="ru">Russian</option>
                  <option value="kz">Kazakh</option>
                </select>
              </label>
            ) : null}
            <Button
              label={isSubmitting ? "Please wait..." : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send recovery email"}
              type="submit"
              disabled={isSubmitting}
            />
          </form>
          {status ? <p className="form-status">{status}</p> : null}
        </Card>
        <Card>
          <h3>{copy.auth.statesTitle}</h3>
          <ul className="feature-list">
            {copy.auth.states.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}
