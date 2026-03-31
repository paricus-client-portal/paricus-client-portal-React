import { useState } from "react";
import PropTypes from "prop-types";
import { Box, Typography, Stack, Collapse, IconButton } from "@mui/material";
import {
  FolderOpen as FolderIcon,
  Upload as UploadIcon,
  PictureAsPdf as PdfIcon,
  Description as DescriptionIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { UniversalMobilDataTable } from "../../../../common/components/ui/UniversalMobilDataTable";
import { ActionButton } from "../../../../common/components/ui/ActionButton";
import { ViewButton } from "../../../../common/components/ui/ViewButton";
import { DownloadButton } from "../../../../common/components/ui/DownloadButton";
import { DeleteButton } from "../../../../common/components/ui/DeleteButton";
import { colors, typography, card } from "../../../../common/styles/styles";
import { LoadingProgress } from "../../../../common/components/ui/LoadingProgress";

/**
 * ReportsSection - Sub-accordion for reports inside a folder
 */
const ReportsSection = ({
  folder,
  reports,
  loadingReports,
  onUploadClick,
  handleViewReport,
  handleDownloadReport,
  handleDeleteReport,
  formatFileSize,
  formatDate,
}) => {
  const { t } = useTranslation();
  const folderReports = reports[folder] || [];

  return (
    <Box sx={{ mt: 2 }}>
      {/* Upload button */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          mb: 2,
        }}
      >
        <ActionButton
          handleClick={() => onUploadClick(folder)}
          icon={<UploadIcon />}
          text={t("reportsManagement.reports.uploadReport")}
        />
      </Box>

      {/* Reports list */}
      {loadingReports ? (
        <Box sx={{ textAlign: "center", py: 3 }}>
          <LoadingProgress size={28} sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {t("reportsManagement.reports.loadingReports")}
          </Typography>
        </Box>
      ) : folderReports.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 3 }}>
          <DescriptionIcon
            sx={{ fontSize: 40, color: "text.disabled", mb: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            {t("reportsManagement.reports.noReportsForFolder")}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {folderReports.map((report) => (
            <ReportCard
              key={report.key}
              report={report}
              folder={folder}
              handleViewReport={handleViewReport}
              handleDownloadReport={handleDownloadReport}
              handleDeleteReport={handleDeleteReport}
              formatFileSize={formatFileSize}
              formatDate={formatDate}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

ReportsSection.propTypes = {
  folder: PropTypes.string.isRequired,
  reports: PropTypes.object.isRequired,
  loadingReports: PropTypes.bool,
  onUploadClick: PropTypes.func.isRequired,
  handleDownloadReport: PropTypes.func.isRequired,
  handleDeleteReport: PropTypes.func.isRequired,
  formatFileSize: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
};

/**
 * ReportCard - Individual report card for mobile view
 */
const ReportCard = ({
  report,
  folder,
  handleViewReport,
  handleDownloadReport,
  handleDeleteReport,
  formatFileSize,
  formatDate,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <Box
      sx={{
        ...card,
        border: `1px solid ${colors.border}`,
        p: 1.5,
      }}
    >
      {/* Report header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
          <PdfIcon sx={{ color: colors.error, fontSize: 20 }} />
          <Typography
            variant="body2"
            fontWeight={500}
            sx={{
              fontSize: typography.fontSize.small,
              color: colors.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "180px",
            }}
          >
            {report.name}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          <ViewButton
            handleClick={() => handleViewReport(folder, report)}
            title={t("common.view")}
            size="small"
          />
          <DownloadButton
            handleClick={() => handleDownloadReport(folder, report)}
            title={t("reportsManagement.reports.download")}
          />
          <DeleteButton
            handleDelete={handleDeleteReport}
            item={report}
            itemName={report.name}
            itemType="report"
          />
        </Stack>
      </Box>

      {/* Expanded details */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 1.5, pl: 5 }}>
          <Box sx={{ display: "flex", gap: 1, mb: 0.5 }}>
            <Typography variant="caption" fontWeight={600}>
              {t("reportsManagement.reports.size")}:
            </Typography>
            <Typography variant="caption">
              {formatFileSize(report.size)}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Typography variant="caption" fontWeight={600}>
              {t("reportsManagement.reports.lastModified")}:
            </Typography>
            <Typography variant="caption">
              {formatDate(report.lastModified)}
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

ReportCard.propTypes = {
  report: PropTypes.object.isRequired,
  folder: PropTypes.string.isRequired,
  handleDownloadReport: PropTypes.func.isRequired,
  handleDeleteReport: PropTypes.func.isRequired,
  formatFileSize: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
};

/**
 * ClientFoldersMobile - Mobile view for client folders using UniversalMobilDataTable
 * Pure presentational component - receives all data via props
 */
export const ClientFoldersMobile = ({
  // Data from useClientFoldersTableConfig
  rows,
  columns,
  renderPrimaryIcon,
  emptyMessage,
  headerTitle,
  // Additional data
  reports,
  // State
  loading,
  loadingReports,
  // Actions
  onUploadClick,
  handleViewReport,
  handleDownloadReport,
  handleDeleteReport,
  // Formatters
  formatFileSize,
  formatDate,
}) => {
  const { t } = useTranslation();
  const [expandedFolder, setExpandedFolder] = useState(null);

  // Custom render for each folder row's expanded content
  const renderFolderContent = (row) => {
    return (
      <ReportsSection
        folder={row.folder}
        reports={reports}
        loadingReports={loadingReports}
        onUploadClick={onUploadClick}
        handleViewReport={handleViewReport}
        handleDownloadReport={handleDownloadReport}
        handleDeleteReport={handleDeleteReport}
        formatFileSize={formatFileSize}
        formatDate={formatDate}
      />
    );
  };

  // Enhanced columns with reports section
  const enhancedColumns = [
    ...columns,
    {
      field: "reports_content",
      headerName: t("reportsManagement.reports.title"),
      renderCell: ({ row }) => renderFolderContent(row),
    },
  ];

  return (
    <Box sx={{ display: { xs: "block", md: "none" } }}>
      <UniversalMobilDataTable
        rows={rows}
        columns={enhancedColumns}
        primaryField="folder"
        primaryIcon={renderPrimaryIcon()}
        showTitle={true}
        titleField="folder"
        headerTitle={headerTitle}
        loading={loading}
        emptyMessage={emptyMessage}
        labelWidth={100}
        getRowId={(row) => row.id}
        secondaryField={(row) =>
          `${row.reportsCount} ${t("reportsManagement.clientFolders.columnReports").toLowerCase()}`
        }
      />
    </Box>
  );
};

ClientFoldersMobile.propTypes = {
  rows: PropTypes.array.isRequired,
  columns: PropTypes.array.isRequired,
  renderPrimaryIcon: PropTypes.func.isRequired,
  emptyMessage: PropTypes.string,
  headerTitle: PropTypes.string,
  reports: PropTypes.object.isRequired,
  loading: PropTypes.bool,
  loadingReports: PropTypes.bool,
  onUploadClick: PropTypes.func.isRequired,
  handleDownloadReport: PropTypes.func.isRequired,
  handleDeleteReport: PropTypes.func.isRequired,
  formatFileSize: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
};

ClientFoldersMobile.defaultProps = {
  loading: false,
  loadingReports: false,
  emptyMessage: "No folders found",
  headerTitle: "Client Folders",
};
