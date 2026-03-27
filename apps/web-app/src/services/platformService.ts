import { requestService } from "./requestService";
import { userService } from "./userService";
import { newsService } from "./newsService";
import type { PrivatePlatformData, PublicPlatformData } from "../types/platform";

export const platformService = {
  async loadPublicData(): Promise<PublicPlatformData> {
    const [categories, reasons, districts, news, alerts, publicRequests] = await Promise.all([
      userService.getCategories(),
      userService.getReasons(),
      userService.getDistricts(),
      newsService.getNews(),
      newsService.getAlerts(),
      requestService.getPublicRequests(),
    ]);

    return {
      categories,
      reasons,
      districts,
      news,
      alerts,
      publicRequests,
    };
  },
  async loadPrivateData(): Promise<PrivatePlatformData> {
    const [currentUser, savedLocations, notifications, citizenRequests, metrics] =
      await Promise.all([
        userService.getCurrentUser(),
        userService.getSavedLocations(),
        userService.getNotifications(),
        requestService.getCitizenRequests(),
        requestService.getMetrics(),
      ]);

    const operatorQueue =
      currentUser.roles.includes("operator") || currentUser.roles.includes("admin")
        ? await requestService.getAllRequests()
        : [];

    return {
      currentUser,
      savedLocations,
      notifications,
      citizenRequests,
      operatorQueue,
      metrics,
    };
  },
};
