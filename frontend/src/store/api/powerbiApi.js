import { createApi } from "@reduxjs/toolkit/query/react";
import { createBaseQuery } from "./baseQuery";

export const powerbiApi = createApi({
  reducerPath: "powerbiApi",
  baseQuery: createBaseQuery("/powerbi"),
  tagTypes: ["PowerBIDashboards"],
  endpoints: (builder) => ({
    getEmbedToken: builder.query({
      query: ({ groupId, reportId }) => ({
        url: "/embed-token",
        params: { groupId, reportId },
      }),
    }),
    getReports: builder.query({
      query: ({ groupId }) => ({
        url: "/reports",
        params: { groupId },
      }),
      transformResponse: (response) => response.reports || [],
    }),

    // Dashboard assignments
    getDashboards: builder.query({
      query: (clientId) => ({
        url: "/dashboards",
        params: clientId ? { clientId } : undefined,
      }),
      transformResponse: (response) => response.dashboards || [],
      providesTags: ["PowerBIDashboards"],
    }),
    createDashboard: builder.mutation({
      query: (data) => ({
        url: "/dashboards",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["PowerBIDashboards"],
    }),
    updateDashboard: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/dashboards/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["PowerBIDashboards"],
    }),
    deleteDashboard: builder.mutation({
      query: (id) => ({
        url: `/dashboards/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["PowerBIDashboards"],
    }),
  }),
});

export const {
  useGetEmbedTokenQuery,
  useGetReportsQuery,
  useLazyGetEmbedTokenQuery,
  useGetDashboardsQuery,
  useCreateDashboardMutation,
  useUpdateDashboardMutation,
  useDeleteDashboardMutation,
} = powerbiApi;
