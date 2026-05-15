import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Copy } from "../../App";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";
import type { CivicRequest } from "../../types/platform";
import { formatDate, formatStatus } from "../../utils/formatters";

type RequestDetailsSectionProps = {
  copy: Copy;
  requestId: string;
  loadRequest: (requestId: string) => Promise<CivicRequest>;
};

export function RequestDetailsSection({
  copy,
  requestId,
  loadRequest,
}: RequestDetailsSectionProps) {
  const { t } = useTranslation();
  const [request, setRequest] = useState<CivicRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void loadRequest(requestId)
      .then((value) => {
        if (isMounted) {
          setRequest(value);
          setError(null);
        }
      })
      .catch((reason) => {
        if (isMounted) {
          setError(reason instanceof Error ? reason.message : "Failed to load request.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [requestId, loadRequest]);

  if (error) {
    return <section className="section"><p>{error}</p></section>;
  }

  if (!request) {
    return <section className="section"><p>Loading request details...</p></section>;
  }

  return (
    <section className="section">
      <SectionHeading
        kicker={copy.requestDetails.kicker}
        title={copy.requestDetails.title}
        description={copy.requestDetails.description}
      />
      <div className="cards-grid cards-grid--two">
        <Card>
          <div className="badge-row">
            <Badge label={formatStatus(request.status)} tone="warning" />
            <Badge label={t(`priority.${request.priority}`)} className={`badge--priority-${request.priority}`} />
          </div>
          <h3>{request.title}</h3>
          <ul className="feature-list">
            <li>Address: {request.address}</li>
            <li>Place: {request.place}</li>
            <li>Description: {request.description}</li>
            <li>District: {request.districtId}</li>
            <li>Created: {formatDate(request.createdAt)}</li>
          </ul>
        </Card>
        <Card>
          <h3>Status history</h3>
          <div className="timeline">
            {request.statusHistory.map((item) => (
              <div key={item.id} className="timeline__item">
                <span className="timeline__dot" />
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.note}</p>
                  <span>{formatDate(item.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
