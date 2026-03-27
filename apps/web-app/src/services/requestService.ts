import { apiConfig } from "../config/api";
import type {
  CivicRequest,
  PlatformMetrics,
  RequestCreateInput,
  RequestMessage,
  RequestMessageInput,
  RequestStatus,
  RequestStatusUpdateInput,
} from "../types/platform";
import { apiClient } from "./apiClient";

function appendIfPresent(formData: FormData, key: string, value: string | number | undefined) {
  if (value !== undefined && value !== "") {
    formData.append(key, String(value));
  }
}

export const requestService = {
  getCitizenRequests() {
    return apiClient<CivicRequest[]>({
      path: apiConfig.endpoints.myRequests,
      auth: true,
    });
  },
  getAllRequests(status?: RequestStatus) {
    return apiClient<CivicRequest[]>({
      path: apiConfig.endpoints.requests,
      auth: true,
      query: { status },
    });
  },
  getPublicRequests() {
    return apiClient<CivicRequest[]>({
      path: apiConfig.endpoints.requests,
      query: { public: true },
    });
  },
  getRequestById(requestId: string) {
    return apiClient<CivicRequest>({
      path: `${apiConfig.endpoints.requests}/${requestId}`,
      auth: true,
    });
  },
  async createRequest(input: RequestCreateInput) {
    const formData = new FormData();

    appendIfPresent(formData, "address", input.address);
    appendIfPresent(formData, "savedLocationId", input.savedLocationId);
    appendIfPresent(formData, "lat", input.lat);
    appendIfPresent(formData, "lng", input.lng);
    appendIfPresent(formData, "place", input.place);
    appendIfPresent(formData, "categoryId", input.categoryId);
    appendIfPresent(formData, "reasonId", input.reasonId);
    appendIfPresent(formData, "description", input.description);
    formData.append("isPublic", String(input.isPublic));

    input.attachments.forEach((file) => {
      formData.append("attachments", file);
    });

    return apiClient<CivicRequest>({
      path: apiConfig.endpoints.requests,
      method: "POST",
      body: formData,
      auth: true,
    });
  },
  updateStatus(requestId: string, payload: RequestStatusUpdateInput) {
    return apiClient<CivicRequest>({
      path: `${apiConfig.endpoints.requests}/${requestId}/status`,
      method: "PATCH",
      body: payload,
      auth: true,
    });
  },
  async postMessage(requestId: string, payload: RequestMessageInput) {
    const formData = new FormData();
    formData.append("message", payload.message);

    if (payload.attachment) {
      formData.append("attachment", payload.attachment);
    }

    return apiClient<RequestMessage>({
      path: `${apiConfig.endpoints.requests}/${requestId}/messages`,
      method: "POST",
      body: formData,
      auth: true,
    });
  },
  getMetrics() {
    return apiClient<PlatformMetrics>({
      path: `${apiConfig.endpoints.requests}/metrics/summary`,
      auth: true,
    });
  },
};
