import { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, Chip } from "@mui/material";
import { Folder as FolderIcon, FolderOpen as FolderOpenIcon } from "@mui/icons-material";
import { colors, typography } from "../../../common/styles/styles";
import { logger } from "../../../common/utils/logger";

/**
 * useClientFoldersTableConfig - Shared hook for ClientFolders table configuration
 * Called ONCE in parent component and passed to Desktop/Mobile children
 */
export const useClientFoldersTableConfig = ({
  clientFolders = [],
  reports = {},
}) => {
  const { t } = useTranslation();

  // Transform folders to row format for tables
  const rows = useMemo(() => {
    try {
      return clientFolders.map((folder, index) => ({
        id: index,
        folder,
        reportsCount: (reports[folder] || []).length,
        reports: reports[folder] || [],
      }));
    } catch (err) {
      logger.error(`ERROR useClientFoldersTableConfig rows: ${err}`);
      return [];
    }
  }, [clientFolders, reports]);

  // Desktop columns for DataGrid/Table
  const desktopColumns = useMemo(() => {
    try {
      return [
        {
          field: "folder",
          headerName: t("reportsManagement.clientFolders.columnFolder"),
          flex: 1,
          minWidth: 200,
          renderCell: ({ row }) => (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <FolderOpenIcon sx={{ fontSize: 32, color: colors.primary }} />
              <Typography
                variant="body2"
                fontWeight={500}
                sx={{
                  fontSize: typography.fontSize.body,
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamily,
                }}
              >
                {row.folder}
              </Typography>
            </Box>
          ),
        },
        {
          field: "reportsCount",
          headerName: t("reportsManagement.clientFolders.columnReports"),
          width: 150,
          align: "center",
          headerAlign: "center",
          renderCell: ({ row }) => (
            <Chip
              label={row.reportsCount}
              size="small"
              color={row.reportsCount > 0 ? "primary" : "default"}
              variant="outlined"
            />
          ),
        },
      ];
    } catch (err) {
      logger.error(`ERROR useClientFoldersTableConfig desktopColumns: ${err}`);
      return [];
    }
  }, [t]);

  // Mobile columns for UniversalMobilDataTable
  const mobileColumns = useMemo(() => {
    try {
      return [
        {
          field: "reportsCount",
          headerName: t("reportsManagement.clientFolders.columnReports"),
          renderCell: ({ row }) => (
            <Chip
              label={row.reportsCount}
              size="small"
              color={row.reportsCount > 0 ? "primary" : "default"}
              variant="outlined"
            />
          ),
        },
      ];
    } catch (err) {
      logger.error(`ERROR useClientFoldersTableConfig mobileColumns: ${err}`);
      return [];
    }
  }, [t]);

  // Render primary icon for mobile accordion
  const renderPrimaryIcon = useCallback(() => {
    try {
      return <FolderOpenIcon sx={{ fontSize: 28, color: colors.primary }} />;
    } catch (err) {
      logger.error(`ERROR renderPrimaryIcon: ${err}`);
      return null;
    }
  }, []);

  // Labels and messages
  const emptyMessage = useMemo(() => {
    try {
      return t("reportsManagement.clientFolders.noFoldersFound");
    } catch (err) {
      logger.error(`ERROR emptyMessage: ${err}`);
      return "No folders found";
    }
  }, [t]);

  const headerTitle = useMemo(() => {
    try {
      return t("reportsManagement.clientFolders.title");
    } catch (err) {
      logger.error(`ERROR headerTitle: ${err}`);
      return "Client Folders";
    }
  }, [t]);

  return {
    rows,
    desktopColumns,
    mobileColumns,
    renderPrimaryIcon,
    emptyMessage,
    headerTitle,
  };
};
