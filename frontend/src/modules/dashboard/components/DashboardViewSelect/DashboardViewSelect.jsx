import { useEffect } from "react";
import { Box, Chip, Fade, useMediaQuery, useTheme } from "@mui/material";
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
import { DraggableDashboard } from "../DraggableDashboard";
import { useDashboardLayout } from "../../hooks/useDashboardLayout";

/**
 * DashboardViewSelect - Displays dashboard content based on selected client/user
 * Desktop: all sections visible with drag-and-drop reordering (edit mode)
 * Mobile: shows only the active section based on current route
 */
export const DashboardViewSelect = () => {
  const {
    selectedClientId = null,
    selectedUserId = null,
    editMode = false,
    resetLayoutRef,
  } = useOutletContext() || {};
  const { t } = useTranslation();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

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

  // Granular dashboard permissions
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
  const { data: carouselImages = [] } = useGetCarouselImagesQuery(carouselClientId);
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

  // Dashboard layout hook
  const {
    layout,
    setLayout,
    resetLayout,
    isLoading: isLayoutLoading,
    ownerType,
    ownerId,
  } = useDashboardLayout({ selectedClientId, selectedUserId });

  // Register reset function to parent via ref
  useEffect(() => {
    if (resetLayoutRef) {
      resetLayoutRef.current = resetLayout;
    }
  }, [resetLayout, resetLayoutRef]);

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

  // Build sections map — null values are filtered out by DraggableDashboard
  const sections = {
    kpi_statistics: <DashboardStatisticsView />,
    announcements: canViewAnnouncements ? (
      <Box sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
        <AnnouncementsInbox />
      </Box>
    ) : null,
    swiper:
      canViewSwiper && hasCarouselImages ? (
        <Box sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
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
      ) : null,
    active_tasks: canViewActiveTasks ? (
      <ActiveTasks
        selectedClientId={selectedClientId}
        selectedUserId={selectedUserId}
      />
    ) : null,
    master_repository: canViewMasterRepo ? <MasterRepository /> : null,
  };

  // Disable edit mode on mobile
  const effectiveEditMode = editMode && !isMobile;

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

      {/* Dashboard with drag-and-drop support */}
      <Fade in key={`${ownerType}-${ownerId}`} timeout={300}>
        <Box>
          <DraggableDashboard
            editMode={effectiveEditMode}
            layout={layout}
            onLayoutChange={setLayout}
            sections={sections}
            mobileSection={section}
            isLoading={isLayoutLoading}
          />
        </Box>
      </Fade>
    </Box>
  );
};
