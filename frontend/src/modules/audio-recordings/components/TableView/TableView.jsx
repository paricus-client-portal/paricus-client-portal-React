import PropTypes from "prop-types";
import Tooltip from "@mui/material/Tooltip";
import { Box, IconButton, Chip, Typography } from "@mui/material";
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import PhoneIcon from "@mui/icons-material/Phone";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { companies } from "../AdvancedFilters/company.js";
import { UniversalDataGrid } from "../../../../common/components/ui/DataGrid/UniversalDataGrid";
import { ColumnHeaderFilter } from "../../../../common/components/ui/ColumnHeaderFilter";
import { colors } from "../../../../common/styles/styles";
import { useCallback, useMemo } from "react";
import { LoadingProgress } from "../../../../common/components/ui/LoadingProgress";
import { logger } from "../../../../common/utils/logger";

const transformRecordings = (rowsTable, formatDate) => {
  try {
    return rowsTable.map((data, index) => ({
      id: index,
      interactionId: data.interaction_id,
      company: data.company_name,
      callType: data.call_type,
      startTime: formatDate(data.start_time),
      endTime: formatDate(data.end_time),
      customerPhone: data.customer_phone_number,
      agentName: data.agent_name,
      audioFileName: data.audiofilename,
      // Keep original data for audio playback
      interaction_id: data.interaction_id,
      audiofilename: data.audiofilename,
    }));
  } catch (err) {
    logger.error(`ERROR: transformRecordings - ${err.message}`, err);
    return [];
  }
};

export const TableView = ({
  dataViewInfo = [],
  loading = false,
  formatDateTime,
  toggleAudio,
  downloadAudio,
  currentlyPlaying,
  loadingAudioUrl,
  handlePrefetchAudio,
  page = 1,
  itemsPerPage = 10,
  totalCount = 0,
  onPageChange,
  onPageSizeChange,
  filters,
  setFilters,
  setLoadCallTypes,
  callTypes,
  setCompanyFilter,
  isOpen,
  refetch,
  clearFilters,
  isDebouncing = false,
}) => {
  const { t } = useTranslation();
  const authUser = useSelector((state) => state.auth.user);
  const isBPOAdmin = authUser?.permissions?.includes("admin_invoices");

  // Handler para cambiar filtros desde el header
  const handleFilterChange = useCallback(
    (filterKey, value) => {
      if (filterKey === "company") {
        setCompanyFilter(value || null);
      } else {
        setFilters((prev) => ({
          ...prev,
          [filterKey]: value,
        }));
      }
    },
    [setFilters, setCompanyFilter],
  );

  // Transform recordings data for DataGrid
  const rows = useMemo(
    () => transformRecordings(dataViewInfo, formatDateTime),
    [dataViewInfo, formatDateTime],
  );

  // DataGrid columns with proper dependencies for re-render
  const columns = useMemo(
    () => [
      {
        field: "interactionId",
        headerName: t("audioRecordings.table.interactionId"),
        width: 200,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("audioRecordings.table.interactionId")}
            filterType="text"
            filterKey="interactionId"
            filterValue={filters.interactionId}
            onFilterChange={handleFilterChange}
            placeholder={t(
              "audioRecordings.advancedFilters.interactionIdPlaceholder",
            )}
            isOpen={isOpen}
          />
        ),
      },
      {
        field: "company",
        headerName: t("audioRecordings.table.company"),
        width: 130,
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderHeader: () =>
          isBPOAdmin ? (
            <ColumnHeaderFilter
              headerName={t("audioRecordings.table.company")}
              filterType="select"
              filterKey="company"
              filterValue={filters.company}
              onFilterChange={handleFilterChange}
              options={companies}
              labelKey="name"
              valueKey="name"
              isOpen={isOpen}
            />
          ) : (
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, fontSize: "0.875rem" }}
            >
              {t("audioRecordings.table.company")}
            </Typography>
          ),
      },
      {
        field: "callType",
        headerName: t("audioRecordings.table.callType"),
        width: 200,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("audioRecordings.table.callType")}
            filterType="select"
            filterKey="callType"
            filterValue={filters.callType}
            onFilterChange={handleFilterChange}
            options={callTypes.map((type) => ({ name: type, value: type }))}
            labelKey="name"
            valueKey="value"
            onOpen={() => setLoadCallTypes(true)}
            isOpen={isOpen}
          />
        ),
        renderCell: (params) => (
          <Chip
            label={params.value || t("audioRecordings.table.unknown")}
            variant="outlined"
            size="small"
            sx={{
              borderColor: colors.primary,
              color: colors.primary,
            }}
          />
        ),
      },
      {
        field: "startTime",
        headerName: t("audioRecordings.table.startTime"),
        width: 190,
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("audioRecordings.table.startTime")}
            filterType="date"
            filterKey="startDate"
            filterValue={filters.startDate}
            onFilterChange={handleFilterChange}
            isOpen={isOpen}
          />
        ),
      },
      {
        field: "endTime",
        headerName: t("audioRecordings.table.endTime"),
        width: 190,
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("audioRecordings.table.endTime")}
            filterType="date"
            filterKey="endDate"
            filterValue={filters.endDate}
            onFilterChange={handleFilterChange}
            isOpen={isOpen}
          />
        ),
      },
      {
        field: "customerPhone",
        headerName: t("audioRecordings.table.customerPhone"),
        width: 180,
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("audioRecordings.table.customerPhone")}
            filterType="text"
            filterKey="customerPhone"
            filterValue={filters.customerPhone}
            onFilterChange={handleFilterChange}
            placeholder={t(
              "audioRecordings.advancedFilters.customerPhonePlaceholder",
            )}
            isOpen={isOpen}
          />
        ),
        renderCell: (params) => (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              justifyContent: "center",
            }}
          >
            <PhoneIcon fontSize="small" sx={{ color: "action.active" }} />
            {params.value || t("common.na")}
          </Box>
        ),
      },
      {
        field: "agentName",
        headerName: t("audioRecordings.table.agentName"),
        width: 200,
        align: "center",
        headerAlign: "center",
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("audioRecordings.table.agentName")}
            filterType="text"
            filterKey="agentName"
            filterValue={filters.agentName}
            onFilterChange={handleFilterChange}
            placeholder={t(
              "audioRecordings.advancedFilters.agentNamePlaceholder",
            )}
            isOpen={isOpen}
          />
        ),
        renderCell: (params) => (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              justifyContent: "left",
            }}
          >
            <SupportAgentIcon
              fontSize="small"
              sx={{ color: "action.active" }}
            />
            {params.value || t("common.na")}
          </Box>
        ),
      },
      {
        field: "actions",
        headerName: t("audioRecordings.table.actions"),
        width: 150,
        align: "center",
        headerAlign: "center",
        sortable: false,
        renderHeader: () => (
          <ColumnHeaderFilter
            headerName={t("audioRecordings.table.actions")}
            filterType="actions"
            isOpen={isOpen}
            onSearch={refetch}
            onClearFilters={clearFilters}
            loading={loading}
            isDebouncing={isDebouncing}
          />
        ),
        renderCell: (params) => {
          const recording = params.row;
          const isPlaying = currentlyPlaying === recording.interactionId;
          const isLoadingUrl = loadingAudioUrl === recording.interactionId;
          const hasAudio = recording.audioFileName;

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
            <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
              {/* Play/Stop button */}
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
                    onClick={() => toggleAudio(recording)}
                    disabled={isLoadingUrl}
                    onMouseEnter={() =>
                      !isPlaying &&
                      handlePrefetchAudio &&
                      handlePrefetchAudio(recording.interactionId)
                    }
                  >
                    {isLoadingUrl ? (
                      <LoadingProgress size={20} />
                    ) : isPlaying ? (
                      <StopIcon />
                    ) : (
                      <PlayCircleOutlineIcon
                        sx={{
                          color: colors.focusRing,
                          fontSize: "1.85rem",
                          mt: "-0.2rem",
                        }}
                      />
                    )}
                  </IconButton>
                </span>
              </Tooltip>

              {/* Download button */}
              <Tooltip title={t("audioRecordings.tooltips.download")}>
                <span>
                  <IconButton
                    size="small"
                    color="default"
                    onClick={() => downloadAudio(recording)}
                    disabled={isLoadingUrl}
                  >
                    <DownloadIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          );
        },
      },
    ],
    [
      t,
      filters,
      handleFilterChange,
      isOpen,
      isBPOAdmin,
      callTypes,
      setLoadCallTypes,
      loading,
      isDebouncing,
      refetch,
      clearFilters,
      currentlyPlaying,
      loadingAudioUrl,
      toggleAudio,
      handlePrefetchAudio,
      downloadAudio,
    ],
  );

  // Handle pagination model change (DataGrid uses 0-based page index)
  const handlePaginationChange = useCallback(
    (model) => {
      // If page size changed, reset to first page
      if (model.pageSize !== itemsPerPage) {
        onPageSizeChange(model.pageSize);
        onPageChange(1); // Reset to page 1
      } else if (model.page !== page - 1) {
        onPageChange(model.page + 1); // Convert to 1-based
      }
    },
    [page, itemsPerPage, onPageChange, onPageSizeChange],
  );

  return (
    <Box
      sx={{
        display: { xs: "none", md: "block" },
        height: "auto",
        width: { md: "95%", lg: "100%" },
      }}
    >
      <UniversalDataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        emptyMessage={
          t("audioRecordings.results.noRecordings") || "No recordings found"
        }
        paginationMode="server"
        rowCount={totalCount}
        paginationModel={{
          page: page - 1,
          pageSize: itemsPerPage,
        }}
        onPaginationModelChange={handlePaginationChange}
        pageSizeOptions={[10, 25, 50, 100]}
        initialState={{
          columns: {
            columnVisibilityModel: { id: false },
          },
        }}
        columnHeaderHeight={isOpen ? 90 : 56}
      />
    </Box>
  );
};

TableView.propTypes = {
  dataViewInfo: PropTypes.arrayOf(
    PropTypes.shape({
      interaction_id: PropTypes.string.isRequired,
      companyName: PropTypes.string,
      call_type: PropTypes.string,
      start_time: PropTypes.string,
      end_time: PropTypes.string,
      customer_phone_number: PropTypes.string,
      agent_name: PropTypes.string,
      audiofilename: PropTypes.string,
    }),
  ),
  loading: PropTypes.bool,
  formatDateTime: PropTypes.func.isRequired,
  toggleAudio: PropTypes.func.isRequired,
  downloadAudio: PropTypes.func.isRequired,
  currentlyPlaying: PropTypes.string,
  loadingAudioUrl: PropTypes.string,
  handlePrefetchAudio: PropTypes.func.isRequired,
  page: PropTypes.number,
  itemsPerPage: PropTypes.number,
  totalCount: PropTypes.number,
  onPageChange: PropTypes.func.isRequired,
  onPageSizeChange: PropTypes.func.isRequired,
  filters: PropTypes.shape({
    interactionId: PropTypes.string,
    customerPhone: PropTypes.string,
    agentName: PropTypes.string,
    callType: PropTypes.string,
    startDate: PropTypes.string,
    endDate: PropTypes.string,
    company: PropTypes.string,
    hasAudio: PropTypes.string,
  }).isRequired,
  setFilters: PropTypes.func.isRequired,
  setLoadCallTypes: PropTypes.func.isRequired,
  callTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  setCompanyFilter: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  refetch: PropTypes.func.isRequired,
  clearFilters: PropTypes.func.isRequired,
  isDebouncing: PropTypes.bool,
};

TableView.defaultProps = {
  dataViewInfo: [],
  loading: false,
  currentlyPlaying: null,
  loadingAudioUrl: null,
  page: 1,
  itemsPerPage: 10,
  totalCount: 0,
  isDebouncing: false,
};
