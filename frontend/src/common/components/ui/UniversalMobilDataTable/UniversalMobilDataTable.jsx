import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TablePagination,
  Typography,
  IconButton,
  Box,
  Paper,
  Collapse,
  Stack,
} from "@mui/material";
import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import { colors, titlesTypography } from "../../../styles/styles";
import { AlertInline } from "../AlertInline";
import { LoadingProgress } from "../LoadingProgress";
import { logger } from "../../../utils/logger";

// ============================================================================
// SAFE RENDER UTILITIES
// ============================================================================

/**
 * Safely executes a render function with error handling
 * @param {Function} renderFn - The render function to execute
 * @param {Object} params - Parameters to pass to the render function
 * @param {React.ReactNode} fallback - Fallback content on error
 * @returns {React.ReactNode}
 */
const safeRender = (renderFn, params, fallback = null) => {
  if (typeof renderFn !== "function") return fallback;

  try {
    const result = renderFn(params);
    return result ?? fallback;
  } catch (error) {
    logger.error("SafeRender error:", error);
    return fallback;
  }
};

/**
 * Safely gets a value from an object with optional transform
 * @param {Object} obj - The object to get value from
 * @param {string|Function} field - Field name or getter function
 * @param {*} defaultValue - Default value if not found
 * @returns {*}
 */
const safeGetValue = (obj, field, defaultValue = null) => {
  if (!obj) return defaultValue;

  try {
    if (typeof field === "function") {
      return field(obj) ?? defaultValue;
    }
    return obj[field] ?? defaultValue;
  } catch (error) {
    logger.error("SafeGetValue error:", error);
    return defaultValue;
  }
};

/**
 * Validates column definition
 * @param {Object} column - Column definition
 * @returns {boolean}
 */
const isValidColumn = (column) => {
  return (
    column &&
    typeof column === "object" &&
    typeof column.field === "string" &&
    column.field.length > 0
  );
};

// ============================================================================
// ACCORDION ROW COMPONENT
// ============================================================================

/**
 * AccordionRow - Single expandable row component with error handling
 */
const AccordionRow = ({
  row,
  columns,
  primaryField,
  primaryIcon,
  secondaryField,
  showTitle,
  titleField,
  renderActions,
  actionsLabel,
  onRowClick,
  defaultExpanded,
  labelWidth,
  renderExpandedFooter,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultExpanded);

  // Memoized handlers
  const handleToggle = useCallback((e) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);

  const handleRowClick = useCallback(() => {
    if (typeof onRowClick === "function") {
      try {
        onRowClick(row);
      } catch (error) {
        logger.error("onRowClick error:", error);
      }
    }
  }, [onRowClick, row]);

  // Memoized values with safe access
  const primaryValue = useMemo(() => {
    return safeGetValue(row, primaryField, "N/A");
  }, [row, primaryField]);

  const secondaryValue = useMemo(() => {
    if (!secondaryField) return null;
    return safeGetValue(row, secondaryField, null);
  }, [row, secondaryField]);

  const titleValue = useMemo(() => {
    if (!showTitle) return null;
    if (titleField) {
      return safeGetValue(row, titleField, null);
    }
    return typeof primaryValue === "string" ? primaryValue : null;
  }, [showTitle, titleField, row, primaryValue]);

  // Filter and validate columns
  const validColumns = useMemo(() => {
    if (!Array.isArray(columns)) return [];
    return columns.filter(isValidColumn);
  }, [columns]);

  // Safe render for actions
  const renderedActions = useMemo(() => {
    if (!renderActions) return null;
    return safeRender(renderActions, row, null);
  }, [renderActions, row]);

  // Safe render for expanded footer
  const renderedExpandedFooter = useMemo(() => {
    if (!renderExpandedFooter) return null;
    return safeRender(renderExpandedFooter, row, null);
  }, [renderExpandedFooter, row]);

  // Validate row
  if (!row || typeof row !== "object") {
    logger.warn("AccordionRow: Invalid row prop");
    return null;
  }

  return (
    <>
      <TableRow
        sx={{
          "& > *": { borderBottom: "unset" },
          cursor: onRowClick ? "pointer" : "default",
          "&:hover": {
            backgroundColor: colors.surfaceHighest || "rgba(0, 0, 0, 0.04)",
          },
        }}
        onClick={handleRowClick}
      >
        <TableCell sx={{ width: 50, padding: "8px" }}>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={handleToggle}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row" sx={{ maxWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, overflow: "hidden" }}>
            {typeof primaryIcon === "function" ? primaryIcon(row) : primaryIcon}
            <Box>
              {typeof primaryValue === "string" ? (
                <Typography variant="body2" fontWeight="medium">
                  {primaryValue}
                </Typography>
              ) : (
                primaryValue
              )}
              {secondaryValue && (
                <Typography variant="caption" color="text.secondary">
                  {secondaryValue}
                </Typography>
              )}
            </Box>
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={2}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ mx: 1, my: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                }}
              >
                {/* Title */}
                {titleValue && (
                  <Typography
                    variant="subtitle2"
                    fontWeight="bold"
                    gutterBottom
                  >
                    {titleValue}
                  </Typography>
                )}

                {/* Render columns with error handling */}
                {validColumns.map((column) => {
                  // Skip hidden columns (with safe execution)
                  const shouldHide = safeRender(column.hide, row, false);
                  if (shouldHide) return null;

                  // Get value with safe access
                  const value = column.valueGetter
                    ? safeRender(column.valueGetter, row, null)
                    : safeGetValue(row, column.field, null);

                  // Render cell content
                  const cellContent = column.renderCell ? (
                    safeRender(
                      column.renderCell,
                      { row, value },
                      <Typography variant="body2">{value ?? "—"}</Typography>,
                    )
                  ) : (
                    <Typography variant="body2">{value ?? "—"}</Typography>
                  );

                  return (
                    <Box
                      key={column.field}
                      sx={{ display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0 }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight="600"
                        sx={{ minWidth: column.labelWidth || labelWidth, flexShrink: 0 }}
                      >
                        {column.headerName || column.field}:
                      </Typography>
                      <Box sx={{ minWidth: 0, overflow: "hidden", wordBreak: "break-all" }}>
                        {cellContent}
                      </Box>
                    </Box>
                  );
                })}

                {/* Actions section */}
                {renderedActions && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: 1,
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight="600"
                      sx={{ minWidth: labelWidth }}
                    >
                      {actionsLabel || t("common.actions")}:
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                      {renderedActions}
                    </Stack>
                  </Box>
                )}

                {/* Expanded footer section */}
                {renderedExpandedFooter}
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

AccordionRow.propTypes = {
  row: PropTypes.object.isRequired,
  columns: PropTypes.array.isRequired,
  primaryField: PropTypes.oneOfType([PropTypes.string, PropTypes.func])
    .isRequired,
  primaryIcon: PropTypes.node,
  secondaryField: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  showTitle: PropTypes.bool,
  titleField: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  renderActions: PropTypes.func,
  actionsLabel: PropTypes.string,
  onRowClick: PropTypes.func,
  defaultExpanded: PropTypes.bool,
  labelWidth: PropTypes.number,
  renderExpandedFooter: PropTypes.func,
};

AccordionRow.defaultProps = {
  columns: [],
  primaryIcon: null,
  secondaryField: null,
  showTitle: true,
  titleField: null,
  renderActions: null,
  actionsLabel: null,
  onRowClick: null,
  defaultExpanded: false,
  labelWidth: 120,
  renderExpandedFooter: null,
};

// ============================================================================
// ERROR CONTENT COMPONENT
// ============================================================================

const ErrorContent = ({ error, sx = {} }) => {
  const { t } = useTranslation();

  const errorMessage = useMemo(() => {
    if (typeof error === "string") return error;
    if (error?.message) return error.message;
    return t?.("common.errorLoadingData") || "Error loading data";
  }, [error, t]);

  return <AlertInline message={errorMessage} severity="error" sx={sx} />;
};

ErrorContent.propTypes = {
  error: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  sx: PropTypes.object,
};

// ============================================================================
// EMPTY CONTENT COMPONENT
// ============================================================================

const EmptyContent = ({ message, sx = {} }) => {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: 200,
        border: `1px solid ${colors.border || "#e0e0e0"}`,
        borderRadius: 1,
        backgroundColor: colors.background || "#fafafa",
        ...sx,
      }}
    >
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
};

EmptyContent.propTypes = {
  message: PropTypes.string.isRequired,
  sx: PropTypes.object,
};

// ============================================================================
// LOADING CONTENT COMPONENT
// ============================================================================

const LoadingContent = ({ sx = {} }) => {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: 200,
        ...sx,
      }}
    >
      <LoadingProgress />
    </Box>
  );
};

LoadingContent.propTypes = {
  sx: PropTypes.object,
};

// ============================================================================
// MAIN COMPONENT - UniversalMobilDataTable
// ============================================================================

/**
 * UniversalMobilDataTable - Reusable accordion table component for mobile/responsive views
 *
 * @param {Array} rows - Array of data for the table
 * @param {Array} columns - Column definitions for expanded content
 * @param {string|Function} primaryField - Field name or function to display in collapsed header
 * @param {React.ReactNode} primaryIcon - Icon to show before primary field
 * @param {string|Function} secondaryField - Optional secondary field for header
 * @param {boolean} showTitle - Show title in expanded content (defaults to primaryField value)
 * @param {string|Function} titleField - Custom title field for expanded content
 * @param {string} headerTitle - Title for the table header column
 * @param {boolean} loading - Loading state
 * @param {Object|string} error - Error state
 * @param {string} emptyMessage - Message when no data
 * @param {Function} onRowClick - Callback when row is clicked
 * @param {Function} renderActions - Render function for row actions
 * @param {string} actionsLabel - Label for actions section
 * @param {Function} getRowId - Function to get unique ID for each row
 * @param {boolean} defaultExpanded - Whether rows start expanded
 * @param {number} labelWidth - Width for labels in expanded content
 * @param {Object} sx - Custom styles
 * @param {React.ReactNode} headerActions - Actions to show in table header
 * @param {boolean} hideHeader - Hide the table header
 * @param {Function} renderExpandedFooter - Render function for additional content at the bottom of expanded rows
 */
export const UniversalMobilDataTable = ({
  // Required props
  rows = [],
  columns = [],
  primaryField,

  // Primary field config
  primaryIcon = null,
  secondaryField = null,

  // Expanded content config
  showTitle = true,
  titleField = null,
  labelWidth = 120,

  // Header config
  headerTitle = null,
  headerActions = null,
  hideHeader = false,
  subHeader = null,

  // Loading & Error states
  loading = false,
  error = null,
  emptyMessage = null,

  // Events
  onRowClick = null,

  // Actions
  renderActions = null,
  actionsLabel = null,

  // Row config
  getRowId = (row) => row?.id ?? Math.random().toString(36).substring(2, 11),
  defaultExpanded = false,

  // Expanded footer (for nested content like tables)
  renderExpandedFooter = null,

  // Pagination (client-side, enabled by default)
  enablePagination = true,
  rowsPerPageOptions = [10, 25, 50, 100],

  // Styling
  sx = {},
}) => {
  const { t } = useTranslation();

  // Default empty message with safe access
  const defaultEmptyMessage = useMemo(() => {
    try {
      return t?.("common.noDataAvailable") || "No data available";
    } catch {
      return "No data available";
    }
  }, [t]);

  // Validate and process rows with memoization
  const processedRows = useMemo(() => {
    if (!Array.isArray(rows)) {
      logger.warn(
        "UniversalMobilDataTable: rows prop must be an array, received:",
        typeof rows,
      );
      return [];
    }
    // Filter out invalid rows
    return rows.filter((row) => row && typeof row === "object");
  }, [rows]);

  // Pagination state (client-side)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(
    rowsPerPageOptions[0] || 10
  );

  // Reset page when rows change (e.g. after filtering)
  useEffect(() => {
    setPage(0);
  }, [processedRows.length]);

  // Paginated rows for client-side pagination
  const paginatedRows = useMemo(() => {
    if (!enablePagination) return processedRows;
    const start = page * rowsPerPage;
    return processedRows.slice(start, start + rowsPerPage);
  }, [processedRows, page, rowsPerPage, enablePagination]);

  const handleChangePage = useCallback((_, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  // Validate columns
  const validColumns = useMemo(() => {
    if (!Array.isArray(columns)) {
      logger.warn("UniversalMobilDataTable: columns prop must be an array");
      return [];
    }
    return columns.filter(isValidColumn);
  }, [columns]);

  // Safe getRowId wrapper
  const safeGetRowId = useCallback(
    (row) => {
      try {
        if (typeof getRowId !== "function") {
          return row?.id ?? Math.random().toString(36).substring(2, 11);
        }
        const id = getRowId(row);
        return id ?? Math.random().toString(36).substring(2, 11);
      } catch (error) {
        logger.error("getRowId error:", error);
        return Math.random().toString(36).substring(2, 11);
      }
    },
    [getRowId],
  );

  // Loading state
  if (loading) {
    return <LoadingContent sx={sx} />;
  }

  // Error state
  if (error) {
    return <ErrorContent error={error} sx={sx} />;
  }

  // Main table content
  return (
    <Box sx={{ width: "100%", overflowX: "hidden", ...sx }}>
      {/* Header */}
      {!hideHeader && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: headerActions ? "1fr auto 1fr" : "1fr",
            alignItems: "center",
            my: 2,
          }}
        >
          {headerActions && <Box />}
          <Typography sx={{ ...titlesTypography.mobilDataTableTableHeader, textAlign: "center" }}>
            {headerTitle || t?.("common.details") || "Details"}
          </Typography>
          {headerActions && (
            <Box sx={{ display: "flex", justifyContent: "flex-end", pr: 1 }}>
              {headerActions}
            </Box>
          )}
        </Box>
      )}

      {/* Sub-header content (e.g. filter panels) */}
      {subHeader}

      {/* Empty state - rendered inside layout to preserve header */}
      {processedRows.length === 0 ? (
        <EmptyContent message={emptyMessage || defaultEmptyMessage} />
      ) : (
        <>
          {/* Accordion Table */}
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              border: `1px solid ${colors.border || "#e0e0e0"}`,
              borderRadius: "1.5rem",
              overflowX: "hidden",
            }}
          >
            <Table aria-label="accordion table" sx={{ tableLayout: "fixed", width: "100%" }}>
              <TableBody>
                {paginatedRows.map((row) => (
                  <AccordionRow
                    key={safeGetRowId(row)}
                    row={row}
                    columns={validColumns}
                    primaryField={primaryField}
                    primaryIcon={primaryIcon}
                    secondaryField={secondaryField}
                    showTitle={showTitle}
                    titleField={titleField}
                    renderActions={renderActions}
                    actionsLabel={actionsLabel}
                    onRowClick={onRowClick}
                    defaultExpanded={defaultExpanded}
                    labelWidth={labelWidth}
                    renderExpandedFooter={renderExpandedFooter}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {enablePagination && (
            <Paper sx={{ mt: 2, borderRadius: 2 }}>
              <TablePagination
                component="div"
                count={processedRows.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={rowsPerPageOptions}
                labelRowsPerPage={t("common.rowsPerPage")}
                sx={{
                  backgroundColor: colors.background || "#f5f5f5",
                  borderRadius: 2,
                }}
              />
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

UniversalMobilDataTable.propTypes = {
  rows: PropTypes.array,
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      field: PropTypes.string.isRequired,
      headerName: PropTypes.string,
      labelWidth: PropTypes.number,
      valueGetter: PropTypes.func,
      renderCell: PropTypes.func,
      hide: PropTypes.func,
    }),
  ),
  primaryField: PropTypes.oneOfType([PropTypes.string, PropTypes.func])
    .isRequired,
  primaryIcon: PropTypes.node,
  secondaryField: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  showTitle: PropTypes.bool,
  titleField: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  headerTitle: PropTypes.string,
  headerActions: PropTypes.node,
  hideHeader: PropTypes.bool,
  subHeader: PropTypes.node,
  loading: PropTypes.bool,
  error: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  emptyMessage: PropTypes.string,
  onRowClick: PropTypes.func,
  renderActions: PropTypes.func,
  actionsLabel: PropTypes.string,
  getRowId: PropTypes.func,
  defaultExpanded: PropTypes.bool,
  labelWidth: PropTypes.number,
  renderExpandedFooter: PropTypes.func,
  enablePagination: PropTypes.bool,
  rowsPerPageOptions: PropTypes.arrayOf(PropTypes.number),
  sx: PropTypes.object,
};

