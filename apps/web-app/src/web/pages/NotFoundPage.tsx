import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <Card className="section-card">
      <EmptyState
        title={t("notFound.title")}
        description={t("notFound.description")}
        action={
          <Link to="/">
            <Button>{t("nav.home")}</Button>
          </Link>
        }
      />
    </Card>
  );
}
