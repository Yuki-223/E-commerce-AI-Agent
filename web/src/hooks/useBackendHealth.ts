import { useQuery } from '@tanstack/react-query'
import { api } from '../api/endpoints'

/**
 * Polls GET /health like BackendHealthMonitor in FrontendServices.swift:
 * every 3 s while unreachable, every 15 s once the backend answers.
 */
export function useBackendHealth() {
  const q = useQuery({
    queryKey: ['health'],
    queryFn: async ({ signal }) => {
      const timeout = AbortSignal.timeout(4000)
      await api.health(AbortSignal.any ? AbortSignal.any([signal, timeout]) : signal)
      return true
    },
    retry: false,
    staleTime: 0,
    refetchInterval: (query) => (query.state.status === 'error' ? 3_000 : 15_000),
    refetchIntervalInBackground: false,
  })
  return {
    reachable: q.isSuccess && !q.isError,
    unreachable: q.isError,
    checking: q.isFetching,
    recheck: () => q.refetch(),
  }
}
