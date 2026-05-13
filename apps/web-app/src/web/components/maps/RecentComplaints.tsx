import type { TFunction } from "i18next";
import type { CivicRequest, Locale } from "../../../types/platform";
import { formatDate } from "../../lib/format";
import { localizeRequestProblemType } from "../../lib/requestMeta";
import { cn } from "../../lib/cn";

type RecentComplaintsProps = {
  requests: CivicRequest[];
  selectedRequestId: string | null;
  locale: Locale;
  t: TFunction;
  onSelectRequest: (request: CivicRequest) => void;
};

export function RecentComplaints({
  requests,
  selectedRequestId,
  locale,
  t,
  onSelectRequest,
}: RecentComplaintsProps) {
  return (
    <section className="recent-complaints">
      <div className="analytics-section-title">
        <span>Последние заявки</span>
      </div>
      <div className="recent-complaints__list">
        {requests.length > 0 ? (
          requests.map((request) => (
            <button
              key={request.id}
              type="button"
              className={cn(
                "recent-complaints__item",
                selectedRequestId === request.id && "recent-complaints__item--active",
              )}
              onClick={() => onSelectRequest(request)}
            >
              <strong>
                {localizeRequestProblemType(
                  request.categoryId || request.categoryName,
                  request.title,
                  t,
                )}
              </strong>
              <span>{request.address}</span>
              <small>{formatDate(request.createdAt, locale)}</small>
            </button>
          ))
        ) : (
          <p className="analytics-empty">Нет заявок в текущем фильтре</p>
        )}
      </div>
    </section>
  );
}
