import { useMemo, useCallback, useState } from "react";
import { Box, Chip, Typography } from "@mui/material";
import { Business as BusinessIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { colors } from "../../../common/styles/styles";
import { EditButton } from "../../../common/components/ui/EditButton";
import { DeactivateButton } from "../../../common/components/ui/DeactivateButton";
import { DeleteButton } from "../../../common/components/ui/DeleteButton";
import { ColumnHeaderFilter } from "../../../common/components/ui/ColumnHeaderFilter";

/**
 * Shared hook for Clients table configuration
 * Provides columns, rows transformation, and actions for both Desktop (DataGrid) and Mobile (MobilDataTable)
 */
export const useClientsTableConfig = ({
  clients = [],
  formatDate,
  handleEdit,
  deleteClient,
  permanentDeleteClient,
  activateClient,
  showNotification,
  isBPOAdmin = false,
  // Desktop-specific filter state (managed internally if not provided)
  externalFilters,
  setExternalFilters,
  isOpen: externalIsOpen,
  setIsOpen: setExternalIsOpen,
}) => {
  const { t } = useTranslation();

  // Internal filter state (used if external not provided)
  const [internalFilters, setInternalFilters] = useState({
    name: "",
    status: "",
  });
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Use external or internal filter state
  const filters = externalFilters || internalFilters;
  const setFilters = setExternalFilters || setInternalFilters;
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = setExternalIsOpen || setInternalIsOpen;

  // Handler for filter changes
  const handleFilterChange = useCallback(
    (filterKey, value) => {
      setFilters((prev) => ({
        ...prev,
        [filterKey]: value,
      }));
    },
    [setFilters]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      name: "",
      status: "",
    });
  }, [setFilters]);

  // Status options for select filter
  const statusOptions = useMemo(() => {
    return [
      { name: t("common.active"), value: "active" },
      { name: t("common.inactive"), value: "inactive" },
      { name: t("clients.clientsOnly"), value: "client" },
      { name: t("clients.prospectsOnly"), value: "prospect" },
    ];
  }, [t]);

  // Filter clients
  const filteredClients = useMemo(() => {
    let filtered = [...clients];

    // Filter by status
    if (filters.status === "active") {
      filtered = filtered.filter((client) => client.isActive);
    } else if (filters.status === "inactive") {
      filtered = filtered.filter((client) => !client.isActive);
    } else if (filters.status === "prospect") {
      filtered = filtered.filter((client) => client.isProspect);
    } else if (filters.status === "client") {
      filtered = filtered.filter((client) => !client.isProspect);
    }

    // Filter by name
    if (filters.name) {
      const query = filters.name.toLowerCase();
      filtered = filtered.filter((client) =>
        client.name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [clients, filters]);

  // Shared rows transformation
  const rows = useMemo(() => {
    return filteredClients.map((client) => ({
      id: client.id,
      name: client.name || t("common.na"),
      isProspect: client.isProspect ?? false,
      isActive: client.isActive ?? false,
      userCount: client.userCount || client._count?.users || 0,
      roleCount: client.roleCount || client._count?.roles || 0,
      createdAt: client.createdAt || client.created_at,
      original: client,
    }));
  }, [filteredClients, t]);

  // Shared render functions
  const renderStatusChip = useCallback(
    (isActive) => {
      return (
        <Chip
          label={isActive ? t("common.active") : t("common.inactive")}
          color={isActive ? "success" : "error"}
          variant="outlined"
          size="small"
        />
      );
    },
    [t]
  );

  const renderTypeChip = useCallback(
    (isProspect) => {
      return (
        <Chip
          label={
            isProspect ? t("clients.table.prospect") : t("clients.table.client")
          }
          color={isProspect ? "warning" : "primary"}
          variant="outlined"
          size="small"
        />
      );
    },
    [t]
  );

  // Shared render actions
  const renderActions = useCallback(
    (row) => {
      return (
        <>
          <EditButton
            handleClick={handleEdit}
            item={row.original}
            title={t("clients.actions.edit")}
          />
          <DeactivateButton
            handleDeactivate={(client) =>
              row.isActive
                ? deleteClient(client.id).unwrap()
                : activateClient({ id: client.id, name: client.name, isActive: true, isProspect: client.isProspect ?? false }).unwrap()
            }
            item={row.original}
            itemName={row.name}
            itemType="client"
            isActive={row.isActive}
            title={row.isActive ? t("common.deactivate") : t("common.activate")}
            confirmTitle={
              row.isActive
                ? undefined
                : t("common.confirmActivateTitle", { item: t("common.client") })
            }
            confirmMessage={
              row.isActive
                ? `${t("clients.deactivationWarning")} "${row.name}"? ${t("clients.deactivationWarningContinue")}`
                : t("common.confirmActivateMessage", { item: row.name })
            }
            onSuccess={() =>
              showNotification(
                row.isActive
                  ? t("clients.messages.clientDeactivated")
                  : t("common.activateSuccess", { item: row.name }),
                "success"
              )
            }
            onError={(error) =>
              showNotification(
                error?.data?.message ||
                  (row.isActive
                    ? t("clients.messages.clientDeactivateFailed")
                    : t("common.activateError", { item: row.name })),
                "error"
              )
            }
          />
          <DeleteButton
            handleDelete={(client) => permanentDeleteClient(client.id).unwrap()}
            item={row.original}
            itemName={row.name}
            itemType="client"
            disabled={!isBPOAdmin}
          />
        </>
      );
    },
    [handleEdit, deleteClient, permanentDeleteClient, activateClient, showNotification, t]
  );

  // Desktop columns (DataGrid format)
  const desktopColumns = useMemo(() => {
    return [
      {
        field: "name",
        headerName: t("clients.table.clientName"),
        flex: 1,
        align: "left",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("clients.table.clientName")}
            filterType="text"
            filterKey="name"
            filterValue={filters.name}
            onFilterChange={handleFilterChange}
            placeholder={t("clients.searchPlaceholder")}
            isOpen={isOpen}
          />
        ),
        renderCell: (params) => (
          <Typography variant="body2" fontWeight={500} sx={{ margin: "1rem" }}>
            {params.value || t("common.na")}
          </Typography>
        ),
      },
      {
        field: "type",
        headerName: t("clients.table.type"),
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("clients.table.type")}
            filterType="none"
            isOpen={isOpen}
          />
        ),
        renderCell: (params) => renderTypeChip(params.row.isProspect),
      },
      {
        field: "isActive",
        headerName: t("clients.table.status"),
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("clients.table.status")}
            filterType="select"
            filterKey="status"
            filterValue={filters.status}
            onFilterChange={handleFilterChange}
            options={statusOptions}
            labelKey="name"
            valueKey="value"
            isOpen={isOpen}
          />
        ),
        renderCell: (params) => renderStatusChip(params.value),
      },
      {
        field: "userCount",
        headerName: t("clients.table.users"),
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("clients.table.users")}
            filterType="none"
            isOpen={isOpen}
          />
        ),
      },
      {
        field: "roleCount",
        headerName: t("clients.table.roles"),
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("clients.table.roles")}
            filterType="none"
            isOpen={isOpen}
          />
        ),
      },
      {
        field: "createdAt",
        headerName: t("clients.table.created"),
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("clients.table.created")}
            filterType="none"
            isOpen={isOpen}
          />
        ),
        valueFormatter: (value) => {
          try {
            return formatDate ? formatDate(value) : value;
          } catch {
            return value || t("common.na");
          }
        },
      },
      {
        field: "actions",
        headerName: t("clients.table.actions"),
        flex: 1,
        align: "center",
        headerAlign: "center",
        sortable: false,
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("clients.table.actions")}
            filterType="actions"
            isOpen={isOpen}
            onClearFilters={clearFilters}
          />
        ),
        renderCell: (params) => (
          <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
            {renderActions(params.row)}
          </Box>
        ),
      },
    ];
  }, [
    t,
    filters,
    handleFilterChange,
    isOpen,
    statusOptions,
    clearFilters,
    formatDate,
    renderTypeChip,
    renderStatusChip,
    renderActions,
  ]);

  // Mobile columns (MobilDataTable format)
  const mobileColumns = useMemo(() => {
    return [
      {
        field: "isActive",
        headerName: t("clients.table.status"),
        labelWidth: 100,
        renderCell: ({ value }) => renderStatusChip(value),
      },
      {
        field: "isProspect",
        headerName: t("clients.table.type"),
        labelWidth: 100,
        renderCell: ({ value }) => renderTypeChip(value),
      },
      {
        field: "userCount",
        headerName: t("clients.table.users"),
        labelWidth: 100,
      },
      {
        field: "roleCount",
        headerName: t("clients.table.roles"),
        labelWidth: 100,
      },
      {
        field: "createdAt",
        headerName: t("clients.table.created"),
        labelWidth: 100,
        valueGetter: (row) => {
          try {
            return formatDate ? formatDate(row.createdAt) : row.createdAt;
          } catch {
            return row.createdAt || t("common.na");
          }
        },
      },
    ];
  }, [t, formatDate, renderStatusChip, renderTypeChip]);

  // Mobile primary icon
  const renderPrimaryIcon = useCallback(
    () => <BusinessIcon fontSize="small" sx={{ color: colors.primary }} />,
    []
  );

  return {
    rows,
    filteredClients,
    desktopColumns,
    mobileColumns,
    renderActions,
    renderPrimaryIcon,
    filters,
    setFilters,
    isOpen,
    setIsOpen,
    handleFilterChange,
    clearFilters,
    statusOptions,
    actionsLabel: t("clients.table.actions"),
    emptyMessage: t("clients.noClientsFound"),
    headerTitle: t("userManagement.clients.title"),
  };
};
