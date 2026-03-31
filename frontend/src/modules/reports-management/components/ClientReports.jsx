import { useRef } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Stack,
} from "@mui/material";
import {
  PictureAsPdf as PdfIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Description as DescriptionIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import {
  primaryIconButton,
  outlinedIconButton,
  table,
  colors,
  typography,
  titlesTypography,
  reportsCardSelected,
} from "../../../common/styles/styles";
import { DownloadButton } from "../../../common/components/ui/DownloadButton";
import { ViewButton } from "../../../common/components/ui/ViewButton";
import { DeleteButton } from "../../../common/components/ui/DeleteButton";
import { LoadingProgress } from "../../../common/components/ui/LoadingProgress";

export const ClientReports = ({
  selectedFolder,
  reports = [],
  loadingReports = false,
  refetchReports,
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
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  if (!selectedFolder) {
    return null;
  }

  return (
    <Box
      sx={{
        ...reportsCardSelected,
      }}
    >
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography
            sx={{
              ...titlesTypography.primaryTitle,
            }}
          >
            {t("reportsManagement.reports.title", { folder: selectedFolder })}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<UploadIcon />}
              onClick={() => setShowUploadModal(true)}
              sx={primaryIconButton}
            >
              {t("reportsManagement.reports.uploadReport")}
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => refetchReports()}
              disabled={loadingReports}
              sx={outlinedIconButton}
            >
              {t("reportsManagement.reports.refresh")}
            </Button>
          </Stack>
        </Box>

        {loadingReports ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <LoadingProgress size={48} sx={{ mb: 2 }} />
            <Typography>
              {t("reportsManagement.reports.loadingReports")}
            </Typography>
          </Box>
        ) : reports.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <DescriptionIcon
              sx={{ fontSize: 64, color: "text.disabled", mb: 2 }}
            />
            <Typography variant="h6" fontWeight="500" gutterBottom>
              {t("reportsManagement.reports.noReportsFound")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("reportsManagement.reports.noReportsMessage")}
            </Typography>
          </Box>
        ) : (
          <TableContainer
            sx={{
              backgroundColor: "transparent",
              borderRadius: "1rem",
              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
              overflow: "hidden",
              width: "100%",
            }}
          >
            <Table>
              <TableHead sx={table.header}>
                <TableRow>
                  <TableCell sx={table.headerCell}>
                    {t("reportsManagement.reports.fileName")}
                  </TableCell>
                  <TableCell sx={table.headerCell}>
                    {t("reportsManagement.reports.size")}
                  </TableCell>
                  <TableCell sx={table.headerCell}>
                    {t("reportsManagement.reports.lastModified")}
                  </TableCell>
                  <TableCell sx={{ ...table.headerCell, textAlign: "right" }}>
                    {t("reportsManagement.reports.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={table.body}>
                {reports.map((report) => (
                  <TableRow key={report.key} sx={table.row}>
                    <TableCell sx={table.cell}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <PdfIcon sx={{ color: colors.error, fontSize: 20 }} />
                        <Box>
                          <Typography
                            sx={{
                              fontSize: typography.fontSize.body,
                              fontWeight: typography.fontWeight.bold,
                              fontFamily: typography.fontFamily,
                              color: colors.textPrimary,
                            }}
                          >
                            {report.name}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: typography.fontSize.small,
                              color: colors.textMuted,
                              fontFamily: typography.fontFamily,
                            }}
                          >
                            {t("reportsManagement.reports.pdfDocument")}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={table.cell}>
                      <Typography
                        sx={{
                          fontSize: typography.fontSize.body,
                          fontFamily: typography.fontFamily,
                          color: colors.textPrimary,
                        }}
                      >
                        {formatFileSize(report.size)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={table.cell}>
                      <Typography
                        sx={{
                          fontSize: typography.fontSize.body,
                          fontFamily: typography.fontFamily,
                          color: colors.textPrimary,
                        }}
                      >
                        {formatDate(report.lastModified)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ ...table.cell, textAlign: "right" }}>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        justifyContent="flex-end"
                      >
                        <ViewButton
                          handleClick={(r) => handleViewReport(selectedFolder, r)}
                          item={report}
                          title={t("common.view")}
                          size="small"
                        />
                        <DownloadButton
                          handleClick={(r) => handleDownloadReport(selectedFolder, r)}
                          item={report}
                          title={t("reportsManagement.reports.download")}
                        />
                        <DeleteButton
                          handleDelete={handleDeleteReport}
                          item={report}
                          itemName={report.name}
                          itemType="report"
                        />
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Upload Modal */}
      <Dialog
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6">
              {t("reportsManagement.upload.title")}
            </Typography>
            <IconButton onClick={() => setShowUploadModal(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <TextField
              label={t("reportsManagement.upload.clientFolder")}
              value={selectedFolder}
              slotProps={{ input: { readOnly: true } }}
              fullWidth
              disabled
            />

            <TextField
              label={t("reportsManagement.upload.reportName")}
              placeholder={t("reportsManagement.upload.reportNamePlaceholder")}
              value={uploadForm.reportName}
              onChange={(e) =>
                setUploadForm({ ...uploadForm, reportName: e.target.value })
              }
              fullWidth
            />

            <TextField
              label={t("reportsManagement.upload.description")}
              placeholder={t("reportsManagement.upload.descriptionPlaceholder")}
              value={uploadForm.description}
              onChange={(e) =>
                setUploadForm({ ...uploadForm, description: e.target.value })
              }
              multiline
              rows={3}
              fullWidth
            />

            <Box>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                style={{ display: "none" }}
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                  fullWidth
                  sx={outlinedIconButton}
                >
                  {uploadForm.file
                    ? uploadForm.file.name
                    : t("reportsManagement.upload.chooseFile")}
                </Button>
              </label>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: "block" }}
              >
                {t("reportsManagement.upload.fileRestriction")}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowUploadModal(false)}
            sx={outlinedIconButton}
          >
            {t("reportsManagement.upload.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleUploadReport}
            disabled={uploading || !uploadForm.file}
            startIcon={
              uploading ? <LoadingProgress size={20} /> : <UploadIcon />
            }
            sx={primaryIconButton}
          >
            {uploading
              ? t("reportsManagement.upload.uploading")
              : t("reportsManagement.upload.upload")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

ClientReports.propTypes = {
  selectedFolder: PropTypes.string,
  reports: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      size: PropTypes.number.isRequired,
      lastModified: PropTypes.string.isRequired,
    }),
  ),
  loadingReports: PropTypes.bool,
  refetchReports: PropTypes.func.isRequired,
  handleDownloadReport: PropTypes.func.isRequired,
  handleDeleteReport: PropTypes.func.isRequired,
  formatFileSize: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
  showUploadModal: PropTypes.bool.isRequired,
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
};

ClientReports.defaultProps = {
  selectedFolder: null,
  reports: [],
  loadingReports: false,
};

export default ClientReports;
