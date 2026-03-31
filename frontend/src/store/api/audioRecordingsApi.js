import { createApi } from "@reduxjs/toolkit/query/react";
import { createBaseQuery } from "./baseQuery";

export const audioRecordingsApi = createApi({
  reducerPath: "audioRecordingsApi",
  baseQuery: createBaseQuery("/audio-recordings"),
  tagTypes: ['AudioRecordings'],
  // Keep cached data for 10 minutes after component unmounts
  keepUnusedDataFor: 600,
  endpoints: (builder) => ({
    // Get audio recordings with filters and pagination
    getAudioRecordings: builder.query({
      query: (params = {}) => ({
        url: "",
        params: {
          page: params.page || 1,
          limit: params.limit || 25,
          ...(params.interactionId && { interactionId: params.interactionId }),
          ...(params.customerPhone && { customerPhone: params.customerPhone }),
          ...(params.agentName && { agentName: params.agentName }),
          ...(params.callType && { callType: params.callType }),
          ...(params.startDate && { startDate: params.startDate }),
          ...(params.endDate && { endDate: params.endDate }),
          ...(params.company && { company: params.company }),
          ...(params.hasAudio !== null && { hasAudio: params.hasAudio }),
        },
      }),
      transformResponse: (response) => ({
        data: response.recordings || [],
        totalCount: response.pagination?.totalCount || 0,
      }),
      providesTags: ['AudioRecordings'],
    }),

    // Get call types for filters
    getCallTypes: builder.query({
      query: () => "/filters/call-types",
      transformResponse: (response) => response.callTypes || [],
    }),

    // Get audio URL for a specific recording
    getAudioUrl: builder.query({
      query: (interactionId) => `/${interactionId}/audio-url`,
      transformResponse: (response) => response.audioUrl,
      // Force fresh data on every request (no caching) to ensure logs are created
      keepUnusedDataFor: 0,
    }),
  }),
});

export const {
  useGetAudioRecordingsQuery,
  useGetCallTypesQuery,
  useLazyGetAudioUrlQuery,
} = audioRecordingsApi;
