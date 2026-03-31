import { useMemo, useCallback } from "react";
import { Box, Chip, Avatar, Typography } from "@mui/material";
import {
  Email as EmailIcon,
  Business as BusinessIcon,
  Shield as ShieldIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { colors } from "../../../common/styles/styles";
import { EditButton } from "../../../common/components/ui/EditButton";
import { DeactivateButton } from "../../../common/components/ui/DeactivateButton";
import { DeleteButton } from "../../../common/components/ui/DeleteButton";
import { ColumnHeaderFilter } from "../../../common/components/ui/ColumnHeaderFilter";

/**
 * Shared hook for Users table configuration
 * Provides columns, rows transformation, and actions for both Desktop (DataGrid) and Mobile (MobilDataTable)
 */
export const useUsersTableConfig = ({
  users = [],
  formatDate,
  openEditDialog,
  updateUserMutation,
  deleteUserMutation,
  showNotification,
  // Auth
  currentUserId = null,
  // Desktop-specific props (optional)
  isBPOAdmin = false,
  selectedClient = "",
  setSelectedClient,
  searchQuery = "",
  setSearchQuery,
  isOpen = false,
  clientOptions = [],
  clearFilters,
}) => {
  const { t } = useTranslation();

  // Get user initials for avatar
  const getInitials = useCallback((user) => {
    const firstInitial = user.firstName ? user.firstName[0] : "";
    const lastInitial = user.lastName ? user.lastName[0] : "";
    return `${firstInitial}${lastInitial}`.toUpperCase();
  }, []);

  // Handler for filter changes (Desktop)
  const handleFilterChange = useCallback(
    (filterKey, value) => {
      if (filterKey === "name" && setSearchQuery) {
        setSearchQuery(value);
      } else if (filterKey === "client" && setSelectedClient) {
        setSelectedClient(value);
      }
    },
    [setSearchQuery, setSelectedClient]
  );

  // Shared rows transformation
  const rows = useMemo(
    () =>
      users.map((user) => ({
        id: user.id,
        name:
          `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          t("common.na"),
        email: user.email,
        client_name: user.client?.name || t("common.na"),
        role_name: user.role?.roleName,
        is_active: user.isActive,
        created_at: user.createdAt,
        original: user,
        initials: getInitials(user),
      })),
    [users, t, getInitials]
  );

  // Shared render functions
  const renderStatus = useCallback(
    (isActive) => (
      <Chip
        label={isActive ? t("users.table.active") : t("users.table.inactive")}
        color={isActive ? "success" : "error"}
        variant="outlined"
        size="small"
      />
    ),
    [t]
  );

  const renderRole = useCallback(
    (roleName) => (
      <Chip
        label={roleName || t("users.table.noRoleAssigned")}
        size="small"
        color={roleName ? "secondary" : "default"}
        variant="outlined"
      />
    ),
    [t]
  );

  const renderActions = useCallback(
    (row) => {
      const isSelf = currentUserId && row.original.id === currentUserId;
      return (
        <>
          <EditButton
            handleClick={openEditDialog}
            item={row.original}
            title={t("users.actions.editUser")}
          />
          <DeactivateButton
            handleDeactivate={(user) =>
              updateUserMutation({
                id: user.id,
                isActive: !row.is_active,
              }).unwrap()
            }
            item={row.original}
            itemName={row.name}
            itemType="user"
            isActive={row.is_active}
            disabled={isSelf}
            title={isSelf ? t("users.actions.cannotDeactivateSelf") : row.is_active ? t("users.actions.deactivateUser") : t("users.actions.activateUser")}
            onSuccess={() =>
              showNotification(
                row.is_active
                  ? t("users.messages.userDeactivated")
                  : t("users.messages.userActivated"),
                "success"
              )
            }
            onError={(error) =>
              showNotification(
                error?.data?.message || t("users.messages.statusUpdateFailed"),
                "error"
              )
            }
          />
          <DeleteButton
            handleDelete={(user) => deleteUserMutation(user.id).unwrap()}
            item={row.original}
            itemName={row.name}
            itemType="user"
            disabled={!isBPOAdmin || isSelf}
          />
        </>
      );
    },
    [openEditDialog, updateUserMutation, deleteUserMutation, showNotification, t, isBPOAdmin, currentUserId]
  );

  // Desktop columns (DataGrid format)
  const desktopColumns = useMemo(
    () => [
      {
        field: "name",
        headerName: t("users.table.name"),
        flex: 1,
        align: "left",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("users.table.name")}
            filterType="text"
            filterKey="name"
            filterValue={searchQuery}
            onFilterChange={handleFilterChange}
            placeholder={t("users.searchPlaceholder")}
            isOpen={isOpen}
          />
        ),
        renderCell: (params) => (
          <Typography variant="body2" fontWeight="medium" sx={{ margin: "1rem" }}>
            {params.value || t("common.na")}
          </Typography>
        ),
      },
      {
        field: "email",
        headerName: t("users.table.email"),
        flex: 1,
        align: "left",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("users.table.email")}
            filterType="none"
            isOpen={isOpen}
          />
        ),
      },
      {
        field: "client_name",
        headerName: t("users.table.client"),
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderHeader: () =>
          isBPOAdmin ? (
            <ColumnHeaderFilter
              headerName={t("users.table.client")}
              filterType="select"
              filterKey="client"
              filterValue={selectedClient}
              onFilterChange={handleFilterChange}
              options={clientOptions.map((c) => ({ name: c.title, value: c.value }))}
              labelKey="name"
              valueKey="value"
              isOpen={isOpen}
            />
          ) : (
            <ColumnHeaderFilter
              headerName={t("users.table.client")}
              filterType="none"
              isOpen={isOpen}
            />
          ),
      },
      {
        field: "role_name",
        headerName: t("users.table.role"),
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("users.table.role")}
            filterType="none"
            isOpen={isOpen}
          />
        ),
        renderCell: (params) => renderRole(params.value),
      },
      {
        field: "is_active",
        headerName: t("users.table.status"),
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("users.table.status")}
            filterType="none"
            isOpen={isOpen}
          />
        ),
        renderCell: (params) => renderStatus(params.value),
      },
      {
        field: "created_at",
        headerName: t("users.table.created"),
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("users.table.created")}
            filterType="none"
            isOpen={isOpen}
          />
        ),
        valueFormatter: (value) => formatDate(value),
      },
      {
        field: "actions",
        headerName: t("users.table.actions"),
        flex: 1,
        align: "center",
        headerAlign: "center",
        sortable: false,
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("users.table.actions")}
            filterType="actions"
            isOpen={isOpen}
            onClearFilters={clearFilters}
          />
        ),
        renderCell: (params) => (
          <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center", mt: "0.5rem" }}>
            {renderActions(params.row)}
          </Box>
        ),
      },
    ],
    [
      t,
      searchQuery,
      selectedClient,
      handleFilterChange,
      isOpen,
      isBPOAdmin,
      clientOptions,
      clearFilters,
      formatDate,
      renderRole,
      renderStatus,
      renderActions,
    ]
  );

  // Mobile columns (MobilDataTable format)
  const mobileColumns = useMemo(
    () => [
      {
        field: "email",
        headerName: t("users.form.email"),
        labelWidth: 80,
        renderCell: ({ value }) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <EmailIcon fontSize="small" sx={{ color: colors.primary }} />
            <span>{value}</span>
          </Box>
        ),
      },
      {
        field: "client_name",
        headerName: t("users.form.client"),
        labelWidth: 80,
        renderCell: ({ value }) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <BusinessIcon fontSize="small" sx={{ color: colors.primary }} />
            <Chip label={value} size="small" color="primary" variant="outlined" />
          </Box>
        ),
      },
      {
        field: "role_name",
        headerName: t("users.form.role"),
        labelWidth: 80,
        renderCell: ({ value }) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <ShieldIcon fontSize="small" sx={{ color: colors.primary }} />
            {renderRole(value)}
          </Box>
        ),
      },
      {
        field: "is_active",
        headerName: t("users.table.status"),
        labelWidth: 80,
        renderCell: ({ value }) => renderStatus(value),
      },
      {
        field: "created_at",
        headerName: t("users.table.created"),
        labelWidth: 80,
        valueGetter: (row) => formatDate(row.created_at),
      },
    ],
    [t, formatDate, renderRole, renderStatus]
  );

  // Mobile primary field render
  const renderPrimaryIcon = useCallback(
    (row) => (
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: colors.primary,
          fontSize: "0.875rem",
        }}
      >
        {row.initials}
      </Avatar>
    ),
    []
  );

  return {
    rows,
    desktopColumns,
    mobileColumns,
    renderActions,
    renderPrimaryIcon,
    actionsLabel: t("users.table.actions"),
    emptyMessage: t("users.noUsersFound"),
    headerTitle: t("userManagement.users.title"),
  };
};
