import { useState } from "react";
import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { useDispatch } from "react-redux";
import { AlertInline } from "../../common/components/ui/AlertInline";
import { useNotification } from "../../common/hooks";
import { useTranslation } from "react-i18next";
import {
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
  Download as DownloadIcon,
  Description as DescriptionIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Dashboard as DashboardIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";
import {
  useGetAccessibleFoldersQuery,
  useGetClientReportsQuery,
  useLazyDownloadReportQuery,
  reportsApi,
} from "../../store/api/reportsApi";
import { useGetDashboardsQuery } from "../../store/api/powerbiApi";
import {
  boxTypography,
  colors,
} from "../../common/styles/styles";
import {
  slugToTitle,
  formatFileSize,
  formatDate,
} from "../../common/utils/formatters";
import { LoadingProgress } from "../../common/components/ui/LoadingProgress";
import { logger } from "../../common/utils/logger";
import HeaderBoxTypography from "../../common/components/ui/HeaderBoxTypography/HeaderBoxTypography";
import { PowerBIEmbed } from "../../common/components/ui/PowerBIEmbed";

// Compact folder reports list for sidebar
const SidebarFolderReports = ({ folder, downloadReport }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: reports = [], isLoading } = useGetClientReportsQuery(folder, { skip: !open });
  const DATE_SHORT_OPTIONS = { year: "numeric", month: "short", day: "numeric" };

  return (
    <Box sx={{ mb: 0.5 }}>
      <ListItem
        onClick={() => setOpen(!open)}
        sx={{ cursor: "pointer", borderRadius: 1, "&:hover": { bgcolor: colors.primaryLight }, py: 0.5 }}
      >
        <ListItemIcon sx={{ minWidth: 28 }}>
          {open
            ? <FolderOpenIcon sx={{ color: "#16A34A", fontSize: 18 }} />
            : <FolderIcon sx={{ color: "#16A34A", fontSize: 18 }} />}
        </ListItemIcon>
        <ListItemText
          primary={slugToTitle(folder)}
          primaryTypographyProps={{ variant: "body2", fontWeight: 600, fontSize: "0.8rem" }}
        />
        <ChevronRightIcon sx={{ fontSize: 16, color: "text.disabled", transform: open ? "rotate(90deg)" : "none", transition: "0.2s" }} />
      </ListItem>
      {open && (
        <Box sx={{ pl: 1.5 }}>
          {isLoading ? (
            <Box sx={{ py: 1, textAlign: "center" }}><LoadingProgress size={14} /></Box>
          ) : reports.length === 0 ? (
            <Typography variant="caption" color="text.disabled" sx={{ pl: 2 }}>
              {t("reporting.noReportsInFolder")}
            </Typography>
          ) : (
            <List dense disablePadding>
              {reports.map((report) => (
                <ListItem
                  key={report.key}
                  onClick={() => downloadReport(report, folder)}
                  sx={{ cursor: "pointer", borderRadius: 1, py: 0.25, "&:hover": { bgcolor: "action.hover" } }}
                >
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    <PdfIcon sx={{ fontSize: 16, color: "error.main" }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={report.name}
                    secondary={`${formatFileSize(report.size)} - ${formatDate(report.lastModified, "en-US", DATE_SHORT_OPTIONS)}`}
                    primaryTypographyProps={{ variant: "caption", fontWeight: 500, noWrap: true }}
                    secondaryTypographyProps={{ variant: "caption", fontSize: "0.6rem" }}
                  />
                  <DownloadIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}
    </Box>
  );
};

export const ReportingView = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const {
    data: accessibleFolders = [],
    isLoading: loading,
    error: apiError,
    refetch,
  } = useGetAccessibleFoldersQuery();

  const {
    data: dashboards = [],
    isLoading: loadingDashboards,
  } = useGetDashboardsQuery();

  const [activeTab, setActiveTab] = useState(0);
  const [getDownloadUrl] = useLazyDownloadReportQuery();
  const { notificationRef, showNotification } = useNotification();
  const error = apiError?.data?.message || apiError?.error || "";

  const downloadReport = async (report, folder) => {
    try {
      showNotification(t("reporting.generatingLink"), "info");
      const result = await getDownloadUrl({ folder, fileName: report.name }).unwrap();
      if (result.downloadUrl) {
        window.open(result.downloadUrl, "_blank");
        showNotification(t("reporting.downloadStarted"), "success");
      }
    } catch (err) {
      logger.error("Error downloading report:", err);
      showNotification(err.data?.message || t("reporting.downloadFailed"), "error");
    }
  };

  const hasReports = accessibleFolders.length > 0;
  const hasDashboards = dashboards.length > 0;

  // PDF Reports sidebar panel
  const reportsPanel = hasReports ? (
    <Box sx={{
      bgcolor: "white",
      borderRadius: 2,
      border: `1px solid ${colors.border}`,
      p: 2,
      height: "fit-content",
      maxHeight: { md: "calc(100vh - 200px)" },
      overflowY: "auto",
      "&::-webkit-scrollbar": { width: 4 },
      "&::-webkit-scrollbar-thumb": { bgcolor: colors.border, borderRadius: 2 },
    }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <DescriptionIcon sx={{ color: "#16A34A", fontSize: 18 }} />
          <Typography variant="subtitle2" fontWeight={600}>
            {t("reporting.clientTitle")}
          </Typography>
        </Box>
        <Tooltip title={t("reporting.refreshReports")}>
          <IconButton
            size="small"
            onClick={() => { refetch(); dispatch(reportsApi.util.invalidateTags(["Reports"])); }}
            disabled={loading}
          >
            {loading ? <LoadingProgress size={14} /> : <RefreshIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      </Box>
      <List disablePadding>
        {accessibleFolders.map((folder) => (
          <SidebarFolderReports key={folder} folder={folder} downloadReport={downloadReport} />
        ))}
      </List>
    </Box>
  ) : null;

  return (
    <Box sx={boxTypography.box}>
      <HeaderBoxTypography text={t("reporting.title")} />

      {loadingDashboards ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <LoadingProgress size={32} />
        </Box>
      ) : hasDashboards ? (
        <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", md: "row" } }}>
          {/* Power BI main area */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Tab bar */}
            <Box sx={{
              display: "flex",
              alignItems: "center",
              borderBottom: 1,
              borderColor: "divider",
              bgcolor: "white",
              borderRadius: "8px 8px 0 0",
            }}>
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                sx={{
                  minHeight: 42,
                  "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 42, py: 0 },
                  "& .Mui-selected": { color: "#16A34A" },
                  "& .MuiTabs-indicator": { backgroundColor: "#16A34A" },
                }}
              >
                {dashboards.map((d) => (
                  <Tab
                    key={d.id}
                    icon={<DashboardIcon sx={{ color: "#16A34A", fontSize: 18 }} />}
                    iconPosition="start"
                    label={d.name}
                  />
                ))}
              </Tabs>
            </Box>

            {/* Embed */}
            <Box sx={{ bgcolor: "white", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
              <PowerBIEmbed
                key={dashboards[activeTab]?.id}
                groupId={dashboards[activeTab]?.groupId}
                reportId={dashboards[activeTab]?.reportId}
              />
            </Box>
          </Box>

          {/* Right sidebar - PDF reports (desktop: side, mobile: below) */}
          {hasReports && (
            <Box sx={{ width: { xs: "100%", md: 280 }, flexShrink: 0 }}>
              {reportsPanel}
            </Box>
          )}
        </Box>
      ) : (
        /* No dashboards - show reports as main content */
        <Box>
          {hasReports ? (
            <Box sx={{
              bgcolor: "white",
              borderRadius: 2,
              border: `1px solid ${colors.border}`,
              p: 3,
            }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  {t("reporting.clientTitle")}
                </Typography>
                <Tooltip title={t("reporting.refreshReports")}>
                  <IconButton
                    onClick={() => { refetch(); dispatch(reportsApi.util.invalidateTags(["Reports"])); }}
                    disabled={loading}
                  >
                    {loading ? <LoadingProgress size={18} /> : <RefreshIcon />}
                  </IconButton>
                </Tooltip>
              </Box>
              <List disablePadding>
                {accessibleFolders.map((folder) => (
                  <SidebarFolderReports key={folder} folder={folder} downloadReport={downloadReport} />
                ))}
              </List>
            </Box>
          ) : (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <DescriptionIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
              <Typography variant="body1" color="text.secondary">{t("reporting.noReports")}</Typography>
              <Typography variant="body2" color="text.disabled">{t("reporting.noReportsMessage")}</Typography>
            </Box>
          )}
        </Box>
      )}

      <AlertInline ref={notificationRef} asSnackbar />
    </Box>
  );
};

export default ReportingView;
