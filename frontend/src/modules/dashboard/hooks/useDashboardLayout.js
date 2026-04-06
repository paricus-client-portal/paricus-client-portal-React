import { useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import {
  useGetDashboardLayoutQuery,
  useSaveDashboardLayoutMutation,
  useResetDashboardLayoutMutation,
} from "../../../store/api/dashboardApi";
import { DEFAULT_LAYOUT } from "../constants/dashboardSections";

/**
 * useDashboardLayout - Manages dashboard layout state with autosave
 *
 * Determines ownerType/ownerId based on current user and "View As" selection.
 * Provides layout state with optimistic updates and debounced persistence.
 */
export const useDashboardLayout = ({ selectedClientId, selectedUserId }) => {
  const user = useSelector((state) => state.auth?.user);
  const permissions = useSelector((state) => state.auth?.permissions);
  const isBPOAdmin = permissions?.includes("admin_clients") ?? false;

  // Determine owner based on context
  let ownerType, ownerId;

  if (isBPOAdmin && selectedClientId) {
    // BPO Admin viewing a client's dashboard
    ownerType = "client";
    ownerId = selectedClientId;
  } else if (isBPOAdmin) {
    // BPO Admin viewing their own dashboard
    ownerType = "super_admin";
    ownerId = user?.id;
  } else {
    // Client user viewing their own client's dashboard
    ownerType = "client";
    ownerId = user?.clientId;
  }

  const skipQuery = !ownerType || !ownerId;

  const { data, isLoading: isLoadingLayout } = useGetDashboardLayoutQuery(
    { ownerType, ownerId },
    { skip: skipQuery }
  );

  const [saveDashboardLayout, { isLoading: isSaving }] =
    useSaveDashboardLayoutMutation();
  const [resetDashboardLayoutApi] = useResetDashboardLayoutMutation();

  // Local layout state for optimistic updates
  const [localLayout, setLocalLayout] = useState(DEFAULT_LAYOUT);
  const debounceRef = useRef(null);

  // Sync local state when server data arrives or owner changes
  useEffect(() => {
    if (data?.layout?.length) {
      setLocalLayout(data.layout);
    } else {
      setLocalLayout(DEFAULT_LAYOUT);
    }
  }, [data, ownerType, ownerId]);

  // Debounced save
  const saveLayout = useCallback(
    (newLayout) => {
      if (skipQuery || !isBPOAdmin) return;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        saveDashboardLayout({
          ownerType,
          ownerId,
          layout: newLayout,
        });
      }, 500);
    },
    [ownerType, ownerId, skipQuery, isBPOAdmin, saveDashboardLayout]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Update layout (optimistic + autosave)
  const setLayout = useCallback(
    (newLayout) => {
      setLocalLayout(newLayout);
      saveLayout(newLayout);
    },
    [saveLayout]
  );

  // Reset to default
  const resetLayout = useCallback(() => {
    if (skipQuery || !isBPOAdmin) return;

    setLocalLayout(DEFAULT_LAYOUT);
    resetDashboardLayoutApi({ ownerType, ownerId });
  }, [ownerType, ownerId, skipQuery, isBPOAdmin, resetDashboardLayoutApi]);

  return {
    layout: localLayout,
    setLayout,
    resetLayout,
    isLoading: isLoadingLayout,
    isSaving,
    isDefault: data?.isDefault ?? true,
    ownerType,
    ownerId,
  };
};
