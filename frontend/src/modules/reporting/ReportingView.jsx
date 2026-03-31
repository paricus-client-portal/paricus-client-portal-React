import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Paper,
  Typography,
} from "@mui/material";
import { AlertInline } from "../../common/components/ui/AlertInline";
import { useNotification } from "../../common/hooks";
import { useTranslation } from "react-i18next";
import {
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
  Download as DownloadIcon,
  Error as ErrorIcon,
  Description as DescriptionIcon,
  Folder as FolderIcon,
} from "@mui/icons-material";
import {
  useGetAccessibleFoldersQuery,
  useGetClientReportsQuery,
  useLazyDownloadReportQuery,
} from "../../store/api/reportsApi";
import {
  primaryButton,
  primaryIconButton,
  outlinedIconButton,
  typography,
  boxTypography,
} from "../../common/styles/styles";
import {
  slugToTitle,
  formatFileSize,
  formatDate,
} from "../../common/utils/formatters";
import { LoadingProgress } from "../../common/components/ui/LoadingProgress";
import { logger } from "../../common/utils/logger";
import HeaderBoxTypography from "../../common/components/ui/HeaderBoxTypography/HeaderBoxTypography";

// Component to display a single folder's reports using RTK Query
const FolderReportsSection = ({ folder, downloadReport }) => {
  const { t } = useTranslation();
  const {
    data: reports = [],
    isLoading,
    refetch,
  } = useGetClientReportsQuery(folder);

  const DATE_SHORT_OPTIONS = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FolderIcon color="primary" />
          <Typography variant="h6" component="h3">
            {slugToTitle(folder)}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={
            isLoading ? <LoadingProgress size={16} /> : <RefreshIcon />
          }
          onClick={() => refetch()}
          disabled={isLoading}
          sx={outlinedIconButton}
        >
          {isLoading ? t("common.loading") : t("reporting.refreshReports")}
        </Button>
      </Box>

      {/* Reports Grid */}
      {reports.length > 0 ? (
        <Grid container spacing={2}>
          {reports.map((report) => (
            <Grid item xs={12} sm={6} md={4} key={report.key}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: "pointer",
                  "&:hover": {
                    boxShadow: 2,
                    bgcolor: "action.hover",
                  },
                  transition: "all 0.2s",
                }}
                onClick={() => downloadReport(report, folder)}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                  <PdfIcon
                    sx={{ fontSize: 32, color: "error.main", flexShrink: 0 }}
                  />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {report.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      {formatFileSize(report.size)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      display="block"
                    >
                      {formatDate(
                        report.lastModified,
                        "en-US",
                        DATE_SHORT_OPTIONS,
                      )}
                    </Typography>
                  </Box>
                  <IconButton size="small" color="primary">
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      ) : !isLoading ? (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            {t("reporting.noReportsInFolder")}
          </Typography>
        </Box>
      ) : null}
    </Paper>
  );
};

export const ReportingView = () => {
  const { t } = useTranslation();

  // RTK Query hooks
  const {
    data: accessibleFolders = [],
    isLoading: loading,
    error: apiError,
    refetch,
  } = useGetAccessibleFoldersQuery();

  const [getDownloadUrl] = useLazyDownloadReportQuery();

  const { notificationRef, showNotification } = useNotification();

  // Derived error message
  const error = apiError?.data?.message || apiError?.error || "";

  const downloadReport = async (report, folder) => {
    try {
      const fileName = report.name;
      showNotification(t("reporting.generatingLink"), "info");

      const result = await getDownloadUrl({ folder, fileName }).unwrap();

      if (result.downloadUrl) {
        window.open(result.downloadUrl, "_blank");
        showNotification(t("reporting.downloadStarted"), "success");
      } else {
        throw new Error("No download URL received");
      }
    } catch (err) {
      logger.error("Error downloading report:", err);
      showNotification(
        err.data?.message || t("reporting.downloadFailed"),
        "error",
      );
    }
  };

  return (
    <Box sx={boxTypography.box}>
      {/* Page Header */}
      <HeaderBoxTypography text={t("reporting.title")} />

      {/* Power BI Dashboard */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" fontWeight={600} gutterBottom>
            {t("reporting.title")}
          </Typography>
          <Box
            sx={{
              width: "100%",
              overflow: "hidden",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <iframe
              title="LinkLive - Operations Dashboard"
              width="100%"
              height="600"
              src="https://app.powerbi.com/reportEmbed?reportId=ba4c808d-3d64-428e-94a0-ccc0be060f40&autoAuth=true&ctid=b850aa77-85c3-4720-80ca-97ae75dca583"
              frameBorder="0"
              allowFullScreen={true}
              style={{ width: "100%" }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* PDF Reports Section */}
      <Card sx={{ mt: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 3,
            }}
          >
            <Typography variant="h6" component="h2" fontWeight={600}>
              {t("reporting.clientTitle")}
            </Typography>
            <Button
              variant="contained"
              startIcon={
                loading ? <LoadingProgress size={16} /> : <RefreshIcon />
              }
              onClick={() => refetch()}
              disabled={loading}
              sx={primaryIconButton}
            >
              {loading ? t("common.loading") : t("reporting.refreshReports")}
            </Button>
          </Box>

          {/* Loading State */}
          {loading && (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <LoadingProgress size={40} sx={{ mb: 2 }} />
              <Typography color="text.secondary">
                {t("reporting.loadingReports")}
              </Typography>
            </Box>
          )}

          {/* Error State */}
          {!loading && error && (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <ErrorIcon sx={{ fontSize: 48, color: "error.main", mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {t("reporting.errorLoading")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {error}
              </Typography>
              <Button
                variant="contained"
                onClick={() => refetch()}
                sx={primaryButton}
              >
                {t("common.tryAgain")}
              </Button>
            </Box>
          )}

          {/* Folders Section */}
          {!loading && !error && accessibleFolders.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {accessibleFolders.map((folder) => (
                <FolderReportsSection
                  key={folder}
                  folder={folder}
                  downloadReport={downloadReport}
                />
              ))}
            </Box>
          )}

          {/* No Reports State */}
          {!loading && !error && accessibleFolders.length === 0 && (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <DescriptionIcon
                sx={{ fontSize: 48, color: "text.disabled", mb: 2 }}
              />
              <Typography variant="h6" gutterBottom>
                {t("reporting.noReports")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("reporting.noReportsMessage")}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Snackbar for notifications */}
      <AlertInline ref={notificationRef} asSnackbar />
    </Box>
  );
};

export default ReportingView;
