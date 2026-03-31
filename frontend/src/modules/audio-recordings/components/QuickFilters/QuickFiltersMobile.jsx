import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  IconButton,
  Typography,
  Paper,
  Chip,
  Tooltip,
  TablePagination,
} from "@mui/material";
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Download as DownloadIcon,
  Headset as HeadsetIcon,
} from "@mui/icons-material";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import PhoneIcon from "@mui/icons-material/Phone";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import { LoadingProgress } from "../../../../common/components/ui/LoadingProgress";
import { useTranslation } from "react-i18next";
import { colors } from "../../../../common/styles/styles";
import { UniversalMobilDataTable } from "../../../../common/components/ui/UniversalMobilDataTable";

export const QuickFiltersMobile = ({
  dataViewInfo = [],
  formatDateTime,
  toggleAudio,
  downloadAudio,
  currentlyPlaying,
  loadingAudioUrl,
  handlePrefetchAudio,
  filters,
  setFilters,
  refetch,
  setLoadCallTypes,
  isDebouncing,
  loading,
  clearFilters,
  callTypes,
  page = 1,
  itemsPerPage = 10,
  totalCount = 0,
  onPageChange,
  onPageSizeChange,
  hideHeader = false,
  headerActions,
  subHeader,
}) => {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Transform data to include formatted dates
  const rows = useMemo(() => {
    return dataViewInfo.map((data) => ({
      ...data,
      start_time_formatted: formatDateTime(data.start_time),
      end_time_formatted: formatDateTime(data.end_time),
    }));
  }, [dataViewInfo, formatDateTime]);

  // Handle pagination change
  const handleChangePage = (_, newPage) => {
    onPageChange(newPage + 1);
  };

  const handleChangeRowsPerPage = (event) => {
    onPageSizeChange(parseInt(event.target.value, 10));
    onPageChange(1);
  };

  // Column definitions for expanded dropdown content
  const columns = useMemo(
    () => [
      {
        field: "interaction_id",
        headerName: t("audioRecordings.table.interactionId"),
        labelWidth: 120,
      },
      {
        field: "end_time_formatted",
        headerName: t("audioRecordings.table.endTime"),
        labelWidth: 120,
      },
      {
        field: "customer_phone_number",
        headerName: t("audioRecordings.table.customerPhone"),
        labelWidth: 120,
        renderCell: ({ value }) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <PhoneIcon fontSize="small" sx={{ color: "action.active" }} />
            <Typography variant="body2">{value || "N/A"}</Typography>
          </Box>
        ),
      },
      {
        field: "agent_name",
        headerName: t("audioRecordings.table.agentName"),
        labelWidth: 120,
        renderCell: ({ value }) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <SupportAgentIcon
              fontSize="small"
              sx={{ color: "action.active" }}
            />
            <Typography variant="body2">{value || "N/A"}</Typography>
          </Box>
        ),
      },
    ],
    [t],
  );

  // Render actions for each row
  const renderActions = (row) => {
    const isPlaying = currentlyPlaying === row.interaction_id;
    const isLoadingUrl = loadingAudioUrl === row.interaction_id;
    const hasAudio = row.audiofilename;

    if (!hasAudio) {
      return (
        <Chip
          label={t("audioRecordings.table.noAudio")}
          size="small"
          color="default"
        />
      );
    }

    return (
      <Box sx={{ display: "flex", gap: 0.5 }}>
        <Tooltip
          title={
            isPlaying
              ? t("audioRecordings.tooltips.stop")
              : t("audioRecordings.tooltips.play")
          }
        >
          <span>
            <IconButton
              size="small"
              color={isPlaying ? "error" : "primary"}
              onClick={() => toggleAudio(row)}
              disabled={isLoadingUrl}
              onMouseEnter={() =>
                !isPlaying &&
                handlePrefetchAudio &&
                handlePrefetchAudio(row.interaction_id)
              }
            >
              {isLoadingUrl ? (
                <LoadingProgress size={20} />
              ) : isPlaying ? (
                <StopIcon />
              ) : (
                <PlayCircleOutlineIcon
                  sx={{ color: colors.focusRing, fontSize: "2rem", mt:'-0.3rem' }}
                />
              )}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("audioRecordings.tooltips.download")}>
          <span>
            <IconButton
              size="small"
              color="default"
              onClick={() => downloadAudio(row)}
              disabled={isLoadingUrl}
            >
              <DownloadIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    );
  };

  // Green theme styling for TextField and Select components
  const greenFieldStyles = {
    "& .MuiOutlinedInput-root": {
      "&.Mui-focused fieldset": {
        borderColor: colors.primary,
      },
    },
    "& .MuiInputLabel-root": {
      "&.Mui-focused": {
        color: colors.primary,
      },
    },
  };

  return (
    <Box sx={{ display: { xs: "block", md: "none" }, overflowX: "hidden" }}>
      {/* Accordion Table */}
      <UniversalMobilDataTable
        rows={rows}
        columns={columns}
        enablePagination={false}
        primaryField={(row) => (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Chip
                label={row.call_type || t("audioRecordings.table.unknown")}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: colors.primary,
                  color: colors.primary,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {row.start_time_formatted}
              </Typography>
            </Box>
          </Box>
        )}
        primaryIcon={
          <HeadsetIcon fontSize="small" sx={{ color: colors.primary }} />
        }
        secondaryField={null}
        showTitle={false}
        headerTitle={t(
          "audioRecordings.table.callRecordings",
          "Call Recordings",
        )}
        hideHeader={hideHeader}
        headerActions={headerActions}
        subHeader={subHeader}
        loading={loading}
        emptyMessage={t("audioRecordings.noRecordingsFound")}
        renderActions={renderActions}
        actionsLabel={t("audioRecordings.table.actions")}
        labelWidth={120}
        getRowId={(row) => row.interaction_id}
      />

      {/* Pagination */}
      <Paper sx={{ mt: 2, borderRadius: 2 }}>
        <TablePagination
          component="div"
          count={totalCount}
          page={page - 1}
          onPageChange={handleChangePage}
          rowsPerPage={itemsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage={t("audioRecordings.results.perPageLabel")}
          sx={{
            backgroundColor: colors.background || "#f5f5f5",
            borderRadius: 2,
          }}
        />
      </Paper>
    </Box>
  );
};

QuickFiltersMobile.propTypes = {
  dataViewInfo: PropTypes.array,
  formatDateTime: PropTypes.func.isRequired,
  toggleAudio: PropTypes.func.isRequired,
  downloadAudio: PropTypes.func.isRequired,
  currentlyPlaying: PropTypes.string,
  loadingAudioUrl: PropTypes.string,
  handlePrefetchAudio: PropTypes.func,
  filters: PropTypes.shape({
    interactionId: PropTypes.string,
    customerPhone: PropTypes.string,
    agentName: PropTypes.string,
    callType: PropTypes.string,
    startDate: PropTypes.string,
    endDate: PropTypes.string,
  }).isRequired,
  setFilters: PropTypes.func.isRequired,
  refetch: PropTypes.func.isRequired,
  setLoadCallTypes: PropTypes.func.isRequired,
  isDebouncing: PropTypes.bool,
  loading: PropTypes.bool,
  clearFilters: PropTypes.func.isRequired,
  callTypes: PropTypes.array,
  page: PropTypes.number,
  itemsPerPage: PropTypes.number,
  totalCount: PropTypes.number,
  onPageChange: PropTypes.func.isRequired,
  onPageSizeChange: PropTypes.func.isRequired,
  hideHeader: PropTypes.bool,
  headerActions: PropTypes.node,
  subHeader: PropTypes.node,
};
