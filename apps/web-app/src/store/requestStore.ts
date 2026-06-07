import type { CivicRequest } from "../types/platform";

export function getCitizenRequestSummary(requests: CivicRequest[]) {
  return {
    total: requests.length,
    active: requests.filter((request) => request.status === "in_progress").length,
    pending: requests.filter((request) => request.status === "pending").length,
    closed: requests.filter((request) => request.status === "closed").length,
  };
}

export function getOperatorPriorityQueue(requests: CivicRequest[]) {
  return [...requests].sort((left, right) => {
    const priorityWeight = { high: 3, medium: 2, low: 1, unset: 0 };
    return priorityWeight[right.priority] - priorityWeight[left.priority];
  });
}

export function filterRequests(
  requests: CivicRequest[],
  query: string,
  status: "all" | CivicRequest["status"],
) {
  const normalizedQuery = query.toLowerCase().trim();

  return requests.filter((request) => {
    const matchesStatus = status === "all" || request.status === status;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      request.title.toLowerCase().includes(normalizedQuery) ||
      request.address.toLowerCase().includes(normalizedQuery) ||
      (request.citizenName ?? "").toLowerCase().includes(normalizedQuery);

    return matchesStatus && matchesQuery;
  });
}
