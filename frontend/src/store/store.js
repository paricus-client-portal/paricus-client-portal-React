import { configureStore } from "@reduxjs/toolkit";
import { authApi } from "./api/authApi";
import { authReducer, clearCredentials } from "./auth/authSlice";
import { logger } from "../common/utils/logger";
import { kpiReducer } from "./kpi/kpiSlice";
import { invoicesApi } from "./api/invoicesApi";
import { reportsApi } from "./api/reportsApi";
import { adminApi } from "./api/adminApi";
import { audioRecordingsApi } from "./api/audioRecordingsApi";
import { profileApi } from "./api/profileApi";
import { articlesApi } from "./api/articlesApi";
import { logsApi } from "./api/logsApi";
import { articlesSearchApi } from "./api/articlesSearchApi";
import { ticketsApi } from "./api/ticketsApi";
import { dashboardApi } from "./api/dashboardApi";
import { carouselApi } from "./api/carouselApi";
import { powerbiApi } from "./api/powerbiApi";

// Middleware to clear RTK Query cache on logout
const resetCacheMiddleware = (storeAPI) => (next) => (action) => {
  // Check if the action is a logout action
  if (
    action.type === clearCredentials.type ||
    authApi.endpoints.logout.matchFulfilled(action)
  ) {
    // Clear all API caches
    try {
      storeAPI.dispatch(invoicesApi.util.resetApiState());
      storeAPI.dispatch(reportsApi.util.resetApiState());
      storeAPI.dispatch(adminApi.util.resetApiState());
      storeAPI.dispatch(audioRecordingsApi.util.resetApiState());
      storeAPI.dispatch(profileApi.util.resetApiState());
      storeAPI.dispatch(articlesApi.util.resetApiState());
      storeAPI.dispatch(logsApi.util.resetApiState());
      storeAPI.dispatch(authApi.util.resetApiState());
      storeAPI.dispatch(articlesSearchApi.util.resetApiState());
      storeAPI.dispatch(ticketsApi.util.resetApiState());
      storeAPI.dispatch(dashboardApi.util.resetApiState());
      storeAPI.dispatch(carouselApi.util.resetApiState());
      storeAPI.dispatch(powerbiApi.util.resetApiState());
    } catch (err) {
      logger.error("Error resetting API cache on logout:", err);
    }
  }

  return next(action);
};

export const store = configureStore({
  reducer: {
    auth: authReducer,
    kpi: kpiReducer,
    [authApi.reducerPath]: authApi.reducer,
    [invoicesApi.reducerPath]: invoicesApi.reducer,
    [reportsApi.reducerPath]: reportsApi.reducer,
    [adminApi.reducerPath]: adminApi.reducer,
    [audioRecordingsApi.reducerPath]: audioRecordingsApi.reducer,
    [profileApi.reducerPath]: profileApi.reducer,
    [articlesApi.reducerPath]: articlesApi.reducer,
    [articlesSearchApi.reducerPath]: articlesSearchApi.reducer,
    [logsApi.reducerPath]: logsApi.reducer,
    [ticketsApi.reducerPath]: ticketsApi.reducer,
    [dashboardApi.reducerPath]: dashboardApi.reducer,
    [carouselApi.reducerPath]: carouselApi.reducer,
    [powerbiApi.reducerPath]: powerbiApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      resetCacheMiddleware, // Add cache reset middleware
      authApi.middleware,
      invoicesApi.middleware,
      reportsApi.middleware,
      adminApi.middleware,
      audioRecordingsApi.middleware,
      profileApi.middleware,
      articlesApi.middleware,
      articlesSearchApi.middleware,
      logsApi.middleware,
      ticketsApi.middleware,
      dashboardApi.middleware,
      carouselApi.middleware,
      powerbiApi.middleware
    ),
});
