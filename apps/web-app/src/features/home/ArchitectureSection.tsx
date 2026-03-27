import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";

export function ArchitectureSection() {
  return (
    <section className="section">
      <SectionHeading
        kicker="Platform contract"
        title="Shared backend and launch assumptions"
        description="This internal page documents the core launch principles enforced by the codebase."
      />
      <div className="cards-grid cards-grid--three">
        <Card>
          <h3>Shared data model</h3>
          <p>Web and mobile read and mutate the same requests, users, addresses, chats, media, and news entities.</p>
        </Card>
        <Card>
          <h3>Configurable API paths</h3>
          <p>Backend paths are driven by `VITE_API_*` variables so deployment can align with the existing service contract without rewriting UI modules.</p>
        </Card>
        <Card>
          <h3>Launch readiness</h3>
          <p>Routing, protected pages, forms, fetch services, session handling, and deployment instructions live together in this repository.</p>
        </Card>
      </div>
    </section>
  );
}
