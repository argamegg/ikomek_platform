import type { QueryClient } from "@tanstack/react-query";
import type { User } from "../../types/platform";
import { queryKeys } from "../services/platformApi";

async function resetSessionCache(queryClient: QueryClient, user: User | null) {
  await queryClient.cancelQueries();
  queryClient.setQueryData(queryKeys.currentUser, user);
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== queryKeys.currentUser[0],
  });
}

export async function applyLoggedOutQueryState(queryClient: QueryClient) {
  await resetSessionCache(queryClient, null);
}

export async function applyLoggedInQueryState(queryClient: QueryClient, user?: User | null) {
  await resetSessionCache(queryClient, user ?? null);
}
