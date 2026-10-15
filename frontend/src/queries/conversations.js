import { apiClient } from "../api/client";

export const conversationsQueryKey = ["conversations"];

export const conversationsQuery = {
  queryKey: conversationsQueryKey,
  queryFn: () => apiClient.get("/api/users"),
};
