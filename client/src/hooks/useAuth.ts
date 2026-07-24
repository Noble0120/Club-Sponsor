import { trpc } from "@/lib/trpc";

export function useAuth() {
  const meQuery = trpc.auth.me.useQuery();
  return {
    user: meQuery.data ?? null,
    isLoading: meQuery.isLoading,
    refetch: meQuery.refetch,
  };
}
