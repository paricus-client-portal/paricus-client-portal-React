import { createApi } from "@reduxjs/toolkit/query/react";
import { createBaseQuery } from "./baseQuery";

export const dashboardApi = createApi({
  reducerPath: "dashboardApi",
  baseQuery: createBaseQuery("/dashboard"),
  tagTypes: ["DashboardStats", "Announcements"],
  endpoints: (builder) => ({
    // Get dashboard stats
    // Optional clientId param for BPO Admin to view specific client's data
    getDashboardStats: builder.query({
      query: (clientId) => ({
        url: "/stats",
        params: clientId ? { clientId } : undefined,
      }),
      transformResponse: (response) => response.data,
      providesTags: (result, error, clientId) => [
        { type: "DashboardStats", id: clientId || "ALL" },
      ],
      // Cache for 5 minutes
      keepUnusedDataFor: 300,
    }),

    // Refresh dashboard stats manually
    refreshDashboardStats: builder.mutation({
      query: () => "/stats",
      invalidatesTags: ["DashboardStats"],
    }),

    // Get client-specific KPIs from MSSQL
    getClientKpis: builder.query({
      query: (clientId) => ({
        url: "/kpis",
        params: clientId ? { clientId } : undefined,
      }),
      transformResponse: (response) => ({
        kpis: response.kpis || [],
        clientName: response.clientName || null,
      }),
      providesTags: (result, error, clientId) => [
        { type: "DashboardStats", id: `kpis-${clientId || "OWN"}` },
      ],
      keepUnusedDataFor: 300,
    }),

    // ========================================
    // ANNOUNCEMENTS ENDPOINTS
    // ========================================

    // Get all announcements (filtered by user role on backend)
    getAnnouncements: builder.query({
      query: () => "/announcements",
      transformResponse: (response) => {
        const data = response.data || [];
        // Sort by priority (high first) then by date (newest first)
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return [...data].sort((a, b) => {
          const priorityA = priorityOrder[a.priority?.toLowerCase()] ?? 3;
          const priorityB = priorityOrder[b.priority?.toLowerCase()] ?? 3;
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          // Same priority: sort by date descending (newest first)
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      },
      providesTags: ["Announcements"],
      // Cache for 2 minutes
      keepUnusedDataFor: 120,
    }),

    // Get single announcement by ID
    getAnnouncement: builder.query({
      query: (id) => `/announcements/${id}`,
      transformResponse: (response) => response.data || null,
      providesTags: (result, error, id) => [{ type: "Announcements", id }],
    }),

    // Create announcement (BPO Admin only)
    createAnnouncement: builder.mutation({
      query: (data) => ({
        url: "/announcements",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Announcements"],
    }),

    // Delete announcement (BPO Admin only)
    deleteAnnouncement: builder.mutation({
      query: (id) => ({
        url: `/announcements/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Announcements"],
    }),
  }),
});

export const {
  useGetDashboardStatsQuery,
  useRefreshDashboardStatsMutation,
  useGetClientKpisQuery,
  useGetAnnouncementsQuery,
  useGetAnnouncementQuery,
  useCreateAnnouncementMutation,
  useDeleteAnnouncementMutation,
} = dashboardApi;
