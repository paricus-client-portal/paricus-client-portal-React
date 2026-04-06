import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListSubheader,
  Button,
  Tooltip,
} from "@mui/material";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import {
  boxTypography,
  colors,
  modalCard,
  selectMenuProps,
} from "../../../../common/styles/styles";
import {
  useGetClientsQuery,
  useGetUsersQuery,
} from "../../../../store/api/adminApi";
import { AlertInline } from "../../../../common/components/ui/AlertInline";
import { useNotification } from "../../../../common/hooks";
import { LoadingProgress } from "../../../../common/components/ui/LoadingProgress";
import { logger } from "../../../../common/utils/logger";

/**
 * DashboardHeader - Header component with user/client selector for BPO Admin
 * @param {function} onSelectionChange - Callback when selection changes, receives { clientId, userId }
 */
export const DashboardHeader = ({
  onSelectionChange,
  editMode,
  setEditMode,
  onResetLayout,
}) => {
  const { t } = useTranslation();
  const [selectedValue, setSelectedValue] = useState("");

  // Check if user is BPO Admin
  const permissions = useSelector((state) => state.auth?.permissions);
  const isBPOAdmin = permissions?.includes("admin_clients") ?? false;

  // Fetch clients for the selector (only for BPO Admin)
  const {
    data: clients = [],
    isLoading: isLoadingClients,
    error: clientsError,
  } = useGetClientsQuery(undefined, {
    skip: !isBPOAdmin,
  });

  // Fetch ALL users (we need them all to group by client)
  const {
    data: allUsers = [],
    isLoading: isLoadingUsers,
    error: usersError,
  } = useGetUsersQuery(undefined, {
    skip: !isBPOAdmin,
  });

  /**
   * Parse selected value to extract clientId and userId
   */
  const { dashboardClientId, dashboardUserId } = useMemo(() => {
    try {
      if (!selectedValue || typeof selectedValue !== "string") {
        return { dashboardClientId: null, dashboardUserId: null };
      }

      const parts = selectedValue.split("-");
      if (parts.length !== 2) {
        return { dashboardClientId: null, dashboardUserId: null };
      }

      const [type, idStr] = parts;
      const id = parseInt(idStr, 10);

      if (type === "user" && !isNaN(id)) {
        const user = allUsers.find((u) => u.id === id);
        return {
          dashboardClientId: user?.client?.id ?? null,
          dashboardUserId: id,
        };
      }

      return { dashboardClientId: null, dashboardUserId: null };
    } catch (error) {
      logger.error("Error parsing selected value:", error);
      return { dashboardClientId: null, dashboardUserId: null };
    }
  }, [selectedValue, allUsers]);

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange({
        clientId: dashboardClientId,
        userId: dashboardUserId,
      });
    }
  }, [dashboardClientId, dashboardUserId, onSelectionChange]);

  /**
   * Handle selector change
   */
  const handleChange = (event) => {
    setSelectedValue(event.target.value ?? "");
  };

  /**
   * Group users by client (excluding BPO Administration - clientId 1)
   */
  const clientsWithUsers = useMemo(() => {
    try {
      if (!Array.isArray(clients) || !Array.isArray(allUsers)) {
        return [];
      }

      return clients
        .filter((client) => client?.id !== 1) // Exclude BPO Administration
        .map((client) => ({
          ...client,
          users: allUsers.filter((user) => user?.client?.id === client?.id),
        }))
        .filter((client) => client.users.length > 0); // Only show clients with users
    } catch (error) {
      logger.error("Error grouping users by client:", error);
      return [];
    }
  }, [clients, allUsers]);

  /**
   * Build menu items with groups
   */
  const menuItems = useMemo(() => {
    const items = [];

    // Add "All" option
    items.push(
      <MenuItem key="all" value="" sx={{ color: "text.primary" }}>
        <Typography fontWeight="medium">
          {t("dashboard.viewAllDashboard")}
        </Typography>
      </MenuItem>,
    );

    // Add grouped options for each client
    clientsWithUsers.forEach((client) => {
      // Client header (not selectable)
      items.push(
        <ListSubheader
          key={`header-${client.id}`}
          sx={{
            backgroundColor: "grey.100",
            fontWeight: "bold",
            color: "text.primary",
            lineHeight: "32px",
          }}
        >
          {client.name}
        </ListSubheader>,
      );

      // Users under this client
      client.users.forEach((user) => {
        items.push(
          <MenuItem
            key={`user-${user.id}`}
            value={`user-${user.id}`}
            sx={{ pl: 4, color: "text.primary" }}
          >
            {user.firstName} {user.lastName}
            <Typography
              component="span"
              variant="caption"
              sx={{ ml: 1, color: "text.secondary" }}
            >
              ({user.role?.roleName || t("common.user")})
            </Typography>
          </MenuItem>,
        );
      });
    });

    return items;
  }, [clientsWithUsers, t]);

  /**
   * Get display value for selected option
   */
  const getDisplayValue = useCallback(() => {
    try {
      if (!selectedValue) return t("dashboard.viewAllDashboard");

      const parts = selectedValue.split("-");
      if (parts.length !== 2) return "";

      const [type, idStr] = parts;
      const id = parseInt(idStr, 10);

      if (type === "user" && !isNaN(id)) {
        const user = allUsers.find((u) => u.id === id);
        if (user) {
          return `${user.firstName} ${user.lastName} (${user.client?.name || ""})`;
        }
      }

      return "";
    } catch (error) {
      logger.error("Error getting display value:", error);
      return "";
    }
  }, [selectedValue, allUsers, t]);

  // Loading state for BPO Admin
  const isLoading = isBPOAdmin && (isLoadingClients || isLoadingUsers);

  // Error state
  const hasError = clientsError || usersError;

  // Notification hook
  const { notificationRef, showError } = useNotification();

  // Show error snackbar when errors occur
  useEffect(() => {
    if (hasError) {
      showError(t("common.errorLoadingData"));
    }
  }, [hasError, t]);

  return (
    <>
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
          mb: 1,
        }}
      >
        <Typography variant="h5" sx={boxTypography.typography}>
          {t("dashboard.title")}
        </Typography>

        {/* Loading indicator for selector data */}
        {isLoading && <LoadingProgress size={24} />}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {/* Grouped Client/User Selector - Only visible for BPO Admin */}
          {isBPOAdmin &&
            !isLoading &&
            !hasError &&
            clientsWithUsers.length > 0 && (
              <FormControl sx={{ minWidth: 280 }}>
                <InputLabel
                  id="dashboard-view-selector-label"
                  sx={modalCard?.multiOptionFilter?.inputLabelSection}
                >
                  {t("dashboard.viewAs")}
                </InputLabel>
                <Select
                  labelId="dashboard-view-selector-label"
                  id="dashboard-view-selector"
                  value={selectedValue}
                  onChange={handleChange}
                  label={t("dashboard.viewAs")}
                  MenuProps={selectMenuProps}
                  renderValue={getDisplayValue}
                  sx={{
                    ...modalCard?.multiOptionFilter?.selectSection,
                    height: "3rem",
                  }}
                >
                  {menuItems}
                </Select>
              </FormControl>
            )}

          {/* Customize Layout button - BPO Admin only */}
          {isBPOAdmin && permissions?.includes("admin_dashboard_config") && (
            <>
              {editMode && onResetLayout && (
                <Tooltip title={t("dashboard.resetLayout")}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={onResetLayout}
                    startIcon={<RestartAltIcon />}
                    sx={{
                      borderColor: colors.border,
                      color: colors.textSecondary,
                      borderRadius: "0.75rem",
                      textTransform: "none",
                      height: "2.5rem",
                      "&:hover": {
                        borderColor: colors.error,
                        color: colors.error,
                      },
                    }}
                  >
                    {t("dashboard.reset")}
                  </Button>
                </Tooltip>
              )}
              <Tooltip
                title={
                  editMode
                    ? t("dashboard.doneCustomizing")
                    : t("dashboard.customizeLayout")
                }
              >
                <Button
                  variant={editMode ? "contained" : "outlined"}
                  size="small"
                  onClick={() => setEditMode?.(!editMode)}
                  startIcon={<DashboardCustomizeIcon />}
                  sx={{
                    borderRadius: "0.75rem",
                    textTransform: "none",
                    height: "2.5rem",
                    ...(editMode
                      ? {
                          backgroundColor: colors.primary,
                          "&:hover": {
                            backgroundColor: colors.primaryDark,
                          },
                        }
                      : {
                          borderColor: colors.border,
                          color: colors.textSecondary,
                          "&:hover": {
                            borderColor: colors.primary,
                            color: colors.primary,
                          },
                        }),
                  }}
                >
                  {editMode
                    ? t("dashboard.done")
                    : t("dashboard.customize")}
                </Button>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>

      {/* Error Snackbar */}
      <AlertInline ref={notificationRef} asSnackbar />
    </>
  );
};

DashboardHeader.propTypes = {
  onSelectionChange: PropTypes.func,
  editMode: PropTypes.bool,
  setEditMode: PropTypes.func,
  onResetLayout: PropTypes.func,
};

DashboardHeader.defaultProps = {
  onSelectionChange: null,
  editMode: false,
  setEditMode: null,
  onResetLayout: null,
};
