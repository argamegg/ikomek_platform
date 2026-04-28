import type { Copy } from "../../App";
import heroImage from "../../assets/hero.png";
import { homeBenefits } from "../../data/platformData";
import { RouterLink } from "../../router/router";
import type { NewsItem, RequestCategory, User } from "../../types/platform";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";

type HomePageSectionProps = {
  copy: Copy;
  currentUser: User | null;
  categories: RequestCategory[];
  alerts: NewsItem[];
  news: NewsItem[];
};

export function HomePageSection({
  copy,
  currentUser,
  categories,
  alerts,
  news,
}: HomePageSectionProps) {
  return (
    <section className="section">
      <SectionHeading
        kicker={copy.home.kicker}
        title={copy.home.title}
        description={copy.home.description}
      />
      <div className="hero-grid">
        <Card className="hero-card hero-card--primary">
          <div className="hero-card__media">
            <img src={heroImage} alt="Astana smart city platform" />
          </div>
          <p className="eyebrow">{copy.sharedSystem.title}</p>
          <h3>{copy.home.heroTitle}</h3>
          <p>{copy.sharedSystem.description}</p>
          <p style={{ fontSize: "14px", color: "#64748b" }}>
  Platform prototype for smart city interaction.
</p>
          <div className="hero-card__pills">
            <RouterLink to={currentUser ? "/requests/new" : "/auth"} className="button button--primary">
              Submit a city issue
            </RouterLink>
            <RouterLink to="/map" className="button button--ghost">
              Explore live map
            </RouterLink>
          </div>
        </Card>
        <Card className="hero-card">
          <h3>Launch blocks</h3>
          <ul className="feature-list">
            <li>Urgent alerts are visible to every visitor from the public home page.</li>
            <li>Request submission routes authenticated residents into the shared request flow.</li>
            <li>News, map visibility, and account entry create a government-grade civic front door.</li>
          </ul>
          <div className="badge-row">
            {categories.slice(0, 4).map((category) => (
              <span key={category.id} className="hero-card__service-chip">
                {category.name}
              </span>
            ))}
          </div>
        </Card>
      </div>
      <div className="cards-grid cards-grid--three">
        {homeBenefits.map((item) => (
          <Card key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </Card>
        ))}
      </div>
      <div className="cards-grid cards-grid--two">
        <Card>
          <h3>Urgent city alerts</h3>
          <ul className="feature-list">
            {alerts.slice(0, 3).map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong> • {item.location ?? "Astana"}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3>Latest news</h3>
          <ul className="feature-list">
            {news.slice(0, 3).map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong> • {item.category}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}
