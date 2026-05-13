import type { TFunction } from "i18next";
import { Link } from "react-router-dom";
import type { CivicRequest, Locale } from "../../../types/platform";
import { getDistrictName, getRequestDistrictId } from "../../../components/map/mapDistricts";
import { Badge } from "../ui/Badge";
import { formatDate, getPriorityTone, getStatusTone } from "../../lib/format";
import {
  localizeRequestDescription,
  localizeRequestPriority,
  localizeRequestProblemType,
  localizeRequestStatus,
} from "../../lib/requestMeta";

type ComplaintDetailsProps = {
  request: CivicRequest | null;
  locale: Locale;
  t: TFunction;
};

export function ComplaintDetails({ request, locale, t }: ComplaintDetailsProps) {
  if (!request) {
    return (
      <section className="complaint-details complaint-details--empty">
        <div className="analytics-section-title">
          <span>Детали заявки</span>
        </div>
        <p>Выберите маркер или заявку из списка, чтобы посмотреть детали обращения.</p>
      </section>
    );
  }

  return (
    <section className="complaint-details">
      <div className="analytics-section-title">
        <span>Детали заявки</span>
        <small>{formatDate(request.createdAt, locale)}</small>
      </div>
      <div className="complaint-details__content">
        <h3>
          {localizeRequestProblemType(
            request.categoryId || request.categoryName,
            request.title,
            t,
          )}
        </h3>
        <div className="complaint-details__badges">
          <Badge tone={getStatusTone(request.status)}>
            {localizeRequestStatus(request.statusLabel || request.status, t)}
          </Badge>
          <Badge tone={getPriorityTone(request.priority)}>
            {localizeRequestPriority(request.priority, t)}
          </Badge>
        </div>
        <dl>
          <div>
            <dt>Район</dt>
            <dd>{getDistrictName(getRequestDistrictId(request))}</dd>
          </div>
          <div>
            <dt>Адрес</dt>
            <dd>{request.address}</dd>
          </div>
          <div>
            <dt>Ответственный</dt>
            <dd>{request.assignment?.executorName || request.assignment?.departmentName || "Не назначен"}</dd>
          </div>
        </dl>
        <p>
          {localizeRequestDescription(
            request.description,
            request.categoryId,
            request.title,
            request.reasonId || request.reasonName,
            t,
          )}
        </p>
        <div className="complaint-details__actions">
          <Link to={`/requests/${request.id}`}>Перейти к заявке</Link>
          <Link to="/operator">Назначить оператору</Link>
        </div>
      </div>
    </section>
  );
}
