import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FilterList as FilterListIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useBreakpoint } from "../../../../common/hooks/useBreakpoint";
import { useNotification } from "../../../../common/hooks";
import { MobileFilterPanel } from "../../../../common/components/ui/MobileFilterPanel";
import { MobileSpeedDial } from "../../../../common/components/ui/MobileSpeedDial";
import { extractApiError } from "../../../../common/utils/apiHelpers";
import { AlertInline } from "../../../../common/components/ui/AlertInline";
import { formatDate as formatDateUtil } from "../../../../common/utils/formatters";
import { UsersTabDesktop } from "./UsersTabDesktop";
import { UsersTabMobile } from "./UsersTabMobile";
import { AddNewUserModal } from "./AddNewUserModal";
import { useUsersTableConfig } from "../../hooks/useUsersTableConfig";
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetClientsQuery,
  useGetRolesQuery,
} from "../../../../store/api/adminApi";

/**
 * Componente unificado UsersTab que maneja la lógica de datos
 * y renderiza la versión móvil o desktop según el breakpoint actual.
 */
export const UsersTab = () => {
  const { t } = useTranslation();
  const { isMobile } = useBreakpoint();
  const authUser = useSelector((state) => state.auth.user);
  const { notificationRef, showNotification } = useNotification();

  // Check if user is BPO Admin or Client Admin
  const isBPOAdmin = authUser?.permissions?.includes("admin_users");
  const isClientAdmin =
    authUser?.permissions?.includes("view_invoices") && !isBPOAdmin;

  // RTK Query hooks
  const { data: users = [], isLoading: loading, error } = useGetUsersQuery();
  const { data: clients = [] } = useGetClientsQuery();
  const { data: roles = [] } = useGetRolesQuery();

  // Show error notification when query fails
  useEffect(() => {
    if (error) {
      showNotification(t("common.errorLoadingData"), "error");
    }
  }, [error, t]);
  const [createUserMutation, { isLoading: creating }] = useCreateUserMutation();
  const [updateUserMutation, { isLoading: updating }] = useUpdateUserMutation();
  const [deleteUserMutation] = useDeleteUserMutation();

  // State
  const [dialog, setDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedClient, setSelectedClient] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const saving = creating || updating;

  // Computed values
  const clientOptions = useMemo(
    () => clients.map((client) => ({
      title: client.name,
      value: client.id,
    })),
    [clients],
  );

  const filteredUsers = useMemo(() => {
    let filtered = users;

    // For Client Admins, only show users from their company
    if (isClientAdmin && authUser?.clientId) {
      filtered = filtered.filter(
        (user) => user.clientId === authUser.clientId
      );
    }

    // For BPO Admins, use the selected client filter
    if (isBPOAdmin && selectedClient) {
      filtered = filtered.filter((user) => user.clientId === selectedClient);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.firstName?.toLowerCase().includes(query) ||
          user.lastName?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [
    users,
    selectedClient,
    searchQuery,
    isClientAdmin,
    isBPOAdmin,
    authUser?.clientId,
  ]);

  // Methods
  const openAddDialog = () => {
    setEditingUser(null);
    setDialog(true);
  };

  const openEditDialog = (user) => {
    setEditingUser(user);
    setDialog(true);
  };

  const closeDialog = () => {
    setDialog(false);
    setEditingUser(null);
  };

  const saveUser = async (data) => {
    try {
      const userData = { ...data };

      if (editingUser && !userData.password) {
        delete userData.password;
      }

      if (editingUser) {
        await updateUserMutation({ id: editingUser.id, ...userData }).unwrap();
        showNotification(t("users.messages.userUpdated"), "success");
      } else {
        await createUserMutation(userData).unwrap();
        showNotification(t("users.messages.userCreated"), "success");
      }

      closeDialog();
    } catch (error) {
      showNotification(
        extractApiError(error, t("users.messages.saveFailed")),
        "error"
      );
    }
  };

  const locale = t("common.locale") || "en-US";
  const formatDate = useCallback((ds) => formatDateUtil(ds, locale), [locale]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedClient("");
  }, []);

  // Mobile filter handler
  const handleMobileFilterChange = useCallback((key, value) => {
    if (key === "name") setSearchQuery(value);
    else if (key === "client") setSelectedClient(value);
  }, []);

  // Mobile filter config
  const mobileFilterConfig = useMemo(() => {
    const cfg = [
      {
        key: "name",
        label: t("users.table.name"),
        type: "text",
        value: searchQuery,
      },
    ];
    if (isBPOAdmin) {
      cfg.push({
        key: "client",
        label: t("users.table.client"),
        type: "select",
        value: selectedClient,
        options: clientOptions.map((c) => ({ label: c.title, value: c.value })),
      });
    }
    return cfg;
  }, [t, searchQuery, selectedClient, isBPOAdmin, clientOptions]);

  // Use shared table configuration - called ONCE here and passed to children
  const {
    rows,
    desktopColumns,
    mobileColumns,
    renderActions,
    renderPrimaryIcon,
    actionsLabel,
    emptyMessage,
    headerTitle,
  } = useUsersTableConfig({
    users: filteredUsers,
    formatDate,
    openEditDialog,
    updateUserMutation,
    deleteUserMutation,
    showNotification,
    isBPOAdmin,
    selectedClient,
    setSelectedClient,
    searchQuery,
    setSearchQuery,
    isOpen,
    clientOptions,
    clearFilters,
  });

  // Props compartidos para Desktop y Mobile
  const sharedProps = {
    // Data
    rows,
    renderActions,
    actionsLabel,
    emptyMessage,
    headerTitle,
    // State
    loading,
    isOpen,
    setIsOpen,
    // Actions
    openAddDialog,
  };

  return (
    <>
      {isMobile ? (
        <UsersTabMobile
          {...sharedProps}
          columns={mobileColumns}
          renderPrimaryIcon={renderPrimaryIcon}
          headerActions={
            <MobileSpeedDial
              actions={[
                {
                  icon: <FilterListIcon />,
                  name: t("users.filters"),
                  onClick: () => setIsOpen(!isOpen),
                },
                {
                  icon: <AddIcon />,
                  name: t("users.addNewUser"),
                  onClick: openAddDialog,
                },
              ]}
            />
          }
          subHeader={
            <MobileFilterPanel
              isOpen={isOpen}
              filters={mobileFilterConfig}
              onFilterChange={handleMobileFilterChange}
              onClear={clearFilters}
              loading={loading}
            />
          }
        />
      ) : (
        <UsersTabDesktop
          {...sharedProps}
          columns={desktopColumns}
        />
      )}
      <AddNewUserModal
        dialog={dialog}
        editingUser={editingUser}
        closeDialog={closeDialog}
        onSave={saveUser}
        saving={saving}
        clientOptions={clientOptions}
        allRoles={roles}
        isBPOAdmin={isBPOAdmin}
        defaultClientId={isClientAdmin ? authUser?.clientId : null}
      />

      {/* Snackbar para notificaciones */}
      <AlertInline ref={notificationRef} asSnackbar />
    </>
  );
};
