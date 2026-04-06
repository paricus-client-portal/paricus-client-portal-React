import { Box, Chip } from "@mui/material";
import { useOutletContext, useLocation } from "react-router-dom";
import { AlertInline } from "../../../../common/components/ui/AlertInline";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useGetDashboardStatsQuery } from "../../../../store/api/dashboardApi";
import { useGetUsersQuery, useGetRolePermissionNamesQuery } from "../../../../store/api/adminApi";
import { AnnouncementsInbox } from "../AnnouncementsInbox";
import { DashboardStatisticsView } from "../DashboardStatisticsView/DashboardStatisticsView";
import { ActiveTasks } from "../ActiveTasks";
import { MasterRepository } from "../MasterRepository";
import { SwiperView } from "../../../../common/components/ui/Swiper";
import { useGetCarouselImagesQuery } from "../../../../store/api/carouselApi";
import { getAttachmentUrl } from "../../../../common/utils/getAttachmentUrl";
import { LoadingProgress } from "../../../../common/components/ui/LoadingProgress";
import { logger } from "../../../../common/utils/logger";

/**
 * DashboardViewSelect - Displays dashboard content based on selected client/user
 * Desktop: all sections visible (no changes)
 * Mobile: shows only the active section based on current route
 *   - /kpi → DashboardStatisticsView
 *   - /swiper → SwiperView
 *   - /general-info → AnnouncementsInbox + ActiveTasks + MasterRepository
 */
export const DashboardViewSelect = () => {
  const { selectedClientId = null, selectedUserId = null } =
    useOutletContext() || {};
  const { t } = useTranslation();
  const location = useLocation();

  // Determine active mobile section from route
  const section = location.pathname.split("/").pop();

  // Get user permissions and token
  const permissions = useSelector((state) => state.auth?.permissions);
  const token = useSelector((state) => state.auth?.token);
  const user = useSelector((state) => state.auth?.user);
  const isBPOAdmin = permissions?.includes("admin_clients") ?? false;

  // When BPO Admin uses "View As", fetch the selected user's role permissions
  const { data: allUsers = [] } = useGetUsersQuery(undefined, { skip: !isBPOAdmin || !selectedUserId });
  const selectedUser = selectedUserId ? allUsers.find((u) => u.id === selectedUserId) : null;
  const selectedRoleId = selectedUser?.roleId || selectedUser?.role?.id;
  const { data: viewAsPermissions } = useGetRolePermissionNamesQuery(selectedRoleId, { skip: !selectedRoleId });

  // Use viewed user's permissions when "View As" is active, otherwise own permissions
  const effectivePermissions = (isBPOAdmin && viewAsPermissions) ? viewAsPermissions : permissions;

  // Granular dashboard permissions (must also have the parent module permission)
  const canViewDashboard = effectivePermissions?.includes("view_dashboard") ?? true;
  const canViewAnnouncements = effectivePermissions?.includes("dashboard_announcements_inbox") ?? true;
  const canViewSwiper = effectivePermissions?.includes("dashboard_swiper") ?? true;
  const canViewActiveTasks = (effectivePermissions?.includes("dashboard_active_tasks") ?? true)
    && (effectivePermissions?.includes("view_tickets") ?? true);
  const canViewMasterRepo = (effectivePermissions?.includes("dashboard_master_repository") ?? true)
    && (effectivePermissions?.includes("view_knowledge_base") ?? true);

  // Fetch carousel images
  const carouselClientId = isBPOAdmin
    ? selectedClientId || undefined
    : user?.clientId;
  const { data: carouselImages = [] } =
    useGetCarouselImagesQuery(carouselClientId);
  const hasCarouselImages = carouselImages.length > 0;

  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useGetDashboardStatsQuery(selectedClientId, {
    pollingInterval: 300000,
    refetchOnFocus: true,
  });

  const handleRetry = () => {
    try {
      refetch();
    } catch (err) {
      logger.error("Error refetching dashboard data:", err);
    }
  };

  // If user has no view_dashboard permission, show empty dashboard
  if (!canViewDashboard) {
    return <Box sx={{ p: { xs: 3, md: 0 }, paddingTop: { xs: 3, md: 3 } }} />;
  }

  // Loading state
  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 400,
        }}
      >
        <LoadingProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    const errorMessage =
      error?.data?.message || error?.message || t("dashboard.errorLoadingData");

    return (
      <Box sx={{ p: 3 }}>
        <AlertInline
          message={errorMessage}
          severity="error"
          onClose={handleRetry}
          sx={{ cursor: "pointer" }}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: { xs: 3, md: 0 },
        paddingTop: { xs: 3, md: 3 },
      }}
    >
      {/* Selected Client Indicator */}
      {isBPOAdmin && stats?.selectedClient && (
        <Box sx={{ mb: 2 }}>
          <Chip
            label={`${t("dashboard.viewing")}: ${stats.selectedClient.name}`}
            color="primary"
            variant="outlined"
            size="small"
          />
        </Box>
      )}

      {/* Section KPI: Statistics — mobile: only on /kpi, desktop: always */}
      <Box
        sx={{
          display: {
            xs: section === "kpi" ? "block" : "none",
            md: "block",
          },
        }}
      >
        <DashboardStatisticsView />
      </Box>

      {/* Announcements + Swiper grid — mobile: both on /swiper, desktop: always */}
      {(canViewAnnouncements || (canViewSwiper && hasCarouselImages)) && (
        <Box
          sx={{
            display: {
              xs: section === "swiper" ? "grid" : "none",
              md: "grid",
            },
            gridTemplateColumns: {
              xs: "1fr",
              lg: canViewAnnouncements && canViewSwiper && hasCarouselImages ? "1fr 1fr" : "1fr",
            },
            mb: 3,
            gap: 3,
            height: { xs: "auto", md: "32vh" },
          }}
        >
          {canViewAnnouncements && (
            <Box
              sx={{
                display: { xs: "none", md: "flex" },
                minHeight: 0,
                overflow: "hidden",
                width: "100%",
              }}
            >
              <AnnouncementsInbox />
            </Box>
          )}

          {canViewSwiper && hasCarouselImages && (
            <Box sx={{ minHeight: 0, overflow: "hidden" }}>
              <SwiperView
                images={Array.from({ length: 4 }, (_, i) => {
                  const img = carouselImages.find((c) => c.slotIndex === i);
                  if (!img) return null;
                  return {
                    previewUrl: getAttachmentUrl(img, token),
                    name: img.fileName,
                  };
                }).filter(Boolean)}
              />
            </Box>
          )}

          {canViewAnnouncements && (
            <Box
              sx={{
                display: { xs: "flex", md: "none" },
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <AnnouncementsInbox />
            </Box>
          )}
        </Box>
      )}

      {/* Section General Info: Active Tasks + Master Repository */}
      {(canViewActiveTasks || canViewMasterRepo) && (
        <Box
          sx={{
            display: {
              xs: section === "general-info" ? "grid" : "none",
              md: "grid",
            },
            gridTemplateColumns: {
              xs: "1fr",
              lg: canViewActiveTasks && canViewMasterRepo ? "1fr 1fr" : "1fr",
            },
            gap: 3,
          }}
        >
          {canViewActiveTasks && (
            <ActiveTasks
              selectedClientId={selectedClientId}
              selectedUserId={selectedUserId}
            />
          )}
          {canViewMasterRepo && <MasterRepository />}
        </Box>
      )}
    </Box>
  );
};
