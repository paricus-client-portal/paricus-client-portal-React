import PropTypes from "prop-types";
import { Box, Typography, Stack, Button } from "@mui/material";
import {
  FolderOpen as FolderIcon,
  Refresh as RefreshIcon,
  Lock as LockIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useBreakpoint } from "../../../../common/hooks/useBreakpoint";
import { ClientFoldersDesktop } from "./ClientFoldersDesktop";
import { ClientFoldersMobile } from "./ClientFoldersMobile";
import { useClientFoldersTableConfig } from "../../hooks/useClientFoldersTableConfig";
import { UploadReportModal } from "../UploadReportModal";
import {
  titlesTypography,
  outlinedIconButton,
} from "../../../../common/styles/styles";
import { ActionButton } from "../../../../common/components/ui/ActionButton";
import { LoadingProgress } from "../../../../common/components/ui/LoadingProgress";

/**
 * ClientFolders - Main component that coordinates Desktop/Mobile views
 * Uses useBreakpoint to determine which view to render
 */
export const ClientFolders = ({
  clientFolders = [],
  loading = false,
  refetchFolders,
  openFolderAccessModal,
  reports = {},
  loadingReports = false,
  fetchReportsForFolder,
  handleViewReport,
  handleDownloadReport,
  handleDeleteReport,
  formatFileSize,
  formatDate,
  showUploadModal,
  setShowUploadModal,
  uploadForm,
  setUploadForm,
  handleFileSelect,
  handleUploadReport,
  uploading,
  fileInputRef,
  selectedFolderForUpload,
}) => {
  const { t } = useTranslation();
  const { isMobile } = useBreakpoint();

  // Use shared table configuration - called ONCE here and passed to children
  const {
    rows,
    desktopColumns,
    mobileColumns,
    renderPrimaryIcon,
    emptyMessage,
    headerTitle,
  } = useClientFoldersTableConfig({
    clientFolders,
    reports,
  });

  // Shared props for both Desktop and Mobile
  const sharedProps = {
    // Data from hook
    rows,
    reports,
    emptyMessage,
    headerTitle,
    // State
    loading,
    loadingReports,
    // Actions
    onUploadClick: setShowUploadModal,
    handleViewReport,
    handleDownloadReport,
    handleDeleteReport,
    // Formatters
    formatFileSize,
    formatDate,
  };

  // Early return if no data and not loading
  if (clientFolders.length === 0 && !loading) {
    return (
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Typography sx={{ ...titlesTypography.primaryTitle }}>
            {t("reportsManagement.clientFolders.title")}
          </Typography>

          <Stack direction="row" spacing={2} flexWrap="wrap">
            <ActionButton
              handleClick={openFolderAccessModal}
              icon={<LockIcon />}
              text={t("reportsManagement.clientFolders.manageAccess")}
            />
            <Button
              variant="outlined"
              startIcon={
                loading ? <LoadingProgress size={20} /> : <RefreshIcon />
              }
              onClick={() => refetchFolders()}
              disabled={loading}
              sx={outlinedIconButton}
            >
              {loading
                ? t("reportsManagement.clientFolders.loading")
                : t("reportsManagement.clientFolders.refreshFolders")}
            </Button>
          </Stack>
        </Box>

        <Box sx={{ textAlign: "center", py: 8 }}>
          <FolderIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" fontWeight="medium" gutterBottom>
            {t("reportsManagement.clientFolders.noFoldersFound")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("reportsManagement.clientFolders.noFoldersMessage")}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 4 }}>
      {/* Header */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Typography sx={{ ...titlesTypography.primaryTitle }}>
          {t("reportsManagement.clientFolders.title")}
        </Typography>
      </Box>

      {/* Render Desktop or Mobile view based on breakpoint */}
      {isMobile ? (
        <ClientFoldersMobile
          {...sharedProps}
          columns={mobileColumns}
          renderPrimaryIcon={renderPrimaryIcon}
        />
      ) : (
        <ClientFoldersDesktop {...sharedProps} columns={desktopColumns} />
      )}

      {/* Upload Modal - shared between views */}
      <UploadReportModal
        showUploadModal={showUploadModal}
        setShowUploadModal={setShowUploadModal}
        uploadForm={uploadForm}
        setUploadForm={setUploadForm}
        handleFileSelect={handleFileSelect}
        handleUploadReport={handleUploadReport}
        uploading={uploading}
        fileInputRef={fileInputRef}
        selectedFolderForUpload={selectedFolderForUpload}
      />
    </Box>
  );
};

ClientFolders.propTypes = {
  clientFolders: PropTypes.arrayOf(PropTypes.string),
  loading: PropTypes.bool,
  refetchFolders: PropTypes.func.isRequired,
  openFolderAccessModal: PropTypes.func.isRequired,
  reports: PropTypes.objectOf(
    PropTypes.arrayOf(
      PropTypes.shape({
        key: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        size: PropTypes.number.isRequired,
        lastModified: PropTypes.string.isRequired,
      }),
    ),
  ),
  loadingReports: PropTypes.bool,
  fetchReportsForFolder: PropTypes.func.isRequired,
  handleDownloadReport: PropTypes.func.isRequired,
  handleDeleteReport: PropTypes.func.isRequired,
  formatFileSize: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
  showUploadModal: PropTypes.string,
  setShowUploadModal: PropTypes.func.isRequired,
  uploadForm: PropTypes.shape({
    reportName: PropTypes.string,
    description: PropTypes.string,
    file: PropTypes.object,
  }).isRequired,
  setUploadForm: PropTypes.func.isRequired,
  handleFileSelect: PropTypes.func.isRequired,
  handleUploadReport: PropTypes.func.isRequired,
  uploading: PropTypes.bool.isRequired,
  fileInputRef: PropTypes.object.isRequired,
  selectedFolderForUpload: PropTypes.string,
};

ClientFolders.defaultProps = {
  clientFolders: [],
  loading: false,
  reports: {},
  loadingReports: false,
  showUploadModal: null,
  selectedFolderForUpload: null,
};

export default ClientFolders;
