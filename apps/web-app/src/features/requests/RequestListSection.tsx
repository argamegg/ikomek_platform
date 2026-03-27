import { useDeferredValue, useState } from "react";
import type { Copy } from "../../App";
import { RouterLink } from "../../router/router";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { filterRequests } from "../../store/requestStore";
import type { CivicRequest, RequestStatus } from "../../types/platform";
import { formatDate, formatStatus } from "../../utils/formatters";

type RequestListSectionProps = {
  copy: Copy;
  requests: CivicRequest[];
};

const statuses: Array<"all" | RequestStatus> = ["all", "pending", "in_progress", "closed"];

export function RequestListSection({ copy, requests }: RequestListSectionProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | RequestStatus>("all");
  const deferredQuery = useDeferredValue(query);
  const filteredRequests = filterRequests(requests, deferredQuery, status);

  return (
    <section className="section">
      <SectionHeading
        kicker={copy.requestList.kicker}
        title={copy.requestList.title}
        description={copy.requestList.description}
      />
      <Card className="toolbar-card">
        <input
          className="text-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title or address"
        />
        <div className="badge-row">
          {statuses.map((item) => (
            <Button
              key={item}
              label={item === "all" ? "All" : formatStatus(item)}
              variant="chip"
              isActive={status === item}
              onClick={() => setStatus(item)}
            />
          ))}
        </div>
      </Card>
      <div className="request-list">
        {filteredRequests.map((request) => (
          <Card key={request.id}>
            <div className="request-row">
              <div>
                <h3>{request.title}</h3>
                <p>{request.address}</p>
                <p>
                  Created {formatDate(request.createdAt)} • Updated {formatDate(request.updatedAt)}
                </p>
              </div>
              <div className="request-row__meta">
                <Badge
                  label={formatStatus(request.status)}
                  tone={
                    request.status === "closed"
                      ? "success"
                      : request.status === "in_progress"
                        ? "warning"
                        : "neutral"
                  }
                />
                <RouterLink to={`/requests/${request.id}`} className="button button--ghost">
                  Details
                </RouterLink>
                <RouterLink to={`/requests/${request.id}/chat`} className="button button--chip">
                  Chat
                </RouterLink>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
