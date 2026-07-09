import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Never retry auth/permission failures — they won't fix themselves.
        if (error instanceof ApiError) {
          if (["UNAUTHORIZED", "FORBIDDEN", "IP_BLOCKED", "PATIENT_MANAGE_REQUIRED"].includes(error.code)) {
            return false;
          }
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: 0 },
  },
});
