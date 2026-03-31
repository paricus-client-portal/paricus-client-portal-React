import { useState, useMemo, Fragment } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Typography,
  Stack,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Collapse,
} from "@mui/material";
import {
  FolderOpen as FolderIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  PictureAsPdf as PdfIcon,
  Upload as UploadIcon,
  Description as DescriptionIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import {
  card,
  colors,
  typography,
  table,
} from "../../../../common/styles/styles";
import { ActionButton } from "../../../../common/components/ui/ActionButton";
import { ViewButton } from "../../../../common/components/ui/ViewButton";
import { DownloadButton } from "../../../../common/components/ui/DownloadButton";
import { DeleteButton } from "../../../../common/components/ui/DeleteButton";
import { LoadingProgress } from "../../../../common/components/ui/LoadingProgress";
import { logger } from "../../../../common/utils/logger";

/**
 * ClientFoldersDesktop - Desktop view for client folders table
 * Pure presentational component - receives all data via props
 */
export const ClientFoldersDesktop = ({
  // Data
  rows,
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
  // Empty state
  emptyMessage,
}) => {
  const { t } = useTranslation();
  const [expandedRows, setExpandedRows] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState("folder");
  const [order, setOrder] = useState("asc");

  const toggleRow = (rowId) => {
    try {
      setExpandedRows((prev) => ({
        ...prev,
        [rowId]: !prev[rowId],
      }));
    } catch (err) {
      logger.error(`ERROR toggleRow: ${err}`);
    }
  };

  const handleChangePage = (event, newPage) => {
    try {
      setPage(newPage);
    } catch (err) {
      logger.error(`ERROR handleChangePage: ${err}`);
    }
  };

  const handleChangeRowsPerPage = (event) => {
    try {
      setRowsPerPage(parseInt(event.target.value, 10));
      setPage(0);
    } catch (err) {
      logger.error(`ERROR handleChangeRowsPerPage: ${err}`);
    }
  };

  const handleRequestSort = (property) => {
    try {
      const isAsc = orderBy === property && order === "asc";
      setOrder(isAsc ? "desc" : "asc");
      setOrderBy(property);
    } catch (err) {
      logger.error(`ERROR handleRequestSort: ${err}`);
    }
  };

  // Sort and paginate data
  const sortedData = useMemo(() => {
    try {
      const sorted = [...rows].sort((a, b) => {
        if (orderBy === "reportsCount") {
          if (order === "asc") {
            return a.reportsCount - b.reportsCount;
          } else {
            return b.reportsCount - a.reportsCount;
          }
        } else {
          // Sort by folder name
          if (order === "asc") {
            return a.folder.localeCompare(b.folder);
          } else {
            return b.folder.localeCompare(a.folder);
          }
        }
      });
      return sorted;
    } catch (err) {
      logger.error(`ERROR sortedData: ${err}`);
      return rows;
    }
  }, [rows, order, orderBy]);

  const paginatedData = useMemo(() => {
    try {
      return sortedData.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage,
      );
    } catch (err) {
      logger.error(`ERROR paginatedData: ${err}`);
      return sortedData;
    }
  }, [sortedData, page, rowsPerPage]);

  // Early return if no data
  if (rows.length === 0 && !loading) {
    return (
      <Box
        sx={{
          display: { xs: "none", md: "block" },
          textAlign: "center",
          py: 8,
        }}
      >
        <FolderIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
        <Typography variant="h6" fontWeight="medium" gutterBottom>
          {emptyMessage}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("reportsManagement.clientFolders.noFoldersMessage")}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: { xs: "none", md: "block" } }}>
      <TableContainer
        sx={{
          ...card,
          border: `1px solid ${colors.border}`,
        }}
      >
        <Table>
          <TableHead
            sx={{
              backgroundColor: colors.background,
              borderBottom: `2px solid ${colors.border}`,
            }}
          >
            <TableRow>
              <TableCell sx={{ width: 60 }} />
              <TableCell>
                <TableSortLabel
                  active={orderBy === "folder"}
                  direction={orderBy === "folder" ? order : "asc"}
                  onClick={() => handleRequestSort("folder")}
                  sx={{
                    fontWeight: typography.fontWeight.bold,
                    textTransform: "uppercase",
                    fontSize: typography.fontSize.tableHeader,
                    fontFamily: typography.fontFamily,
                    color: colors.textMuted,
                    letterSpacing: "0.05em",
                    "& .MuiTableSortLabel-icon": {
                      color: `${colors.primary} !important`,
                    },
                  }}
                >
                  {t("reportsManagement.clientFolders.columnFolder")}
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={orderBy === "reportsCount"}
                  direction={orderBy === "reportsCount" ? order : "asc"}
                  onClick={() => handleRequestSort("reportsCount")}
                  sx={{
                    fontWeight: typography.fontWeight.bold,
                    textTransform: "uppercase",
                    fontSize: typography.fontSize.tableHeader,
                    fontFamily: typography.fontFamily,
                    color: colors.textMuted,
                    letterSpacing: "0.05em",
                    "& .MuiTableSortLabel-icon": {
                      color: `${colors.primary} !important`,
                    },
                  }}
                >
                  {t("reportsManagement.clientFolders.columnReports")}
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row) => {
              const folderReports = reports[row.folder] || [];
              return (
                <Fragment key={row.id}>
                  <TableRow
                    sx={{
                      cursor: "pointer",
                      "&:hover": {
                        backgroundColor: colors.primaryLight,
                      },
                    }}
                  >
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => toggleRow(row.id)}
                        sx={{ color: colors.primary }}
                      >
                        {expandedRows[row.id] ? (
                          <KeyboardArrowUpIcon />
                        ) : (
                          <KeyboardArrowDownIcon />
                        )}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                        }}
                      >
                        <FolderIcon
                          sx={{
                            fontSize: 32,
                            color: colors.primary,
                          }}
                        />
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
                    </TableCell>
                    <TableCell align="center">
                      <Typography
                        sx={{
                          fontSize: typography.fontSize.body,
                          fontWeight: typography.fontWeight.medium,
                          color: colors.textPrimary,
                          fontFamily: typography.fontFamily,
                        }}
                      >
                        {folderReports.length}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow
                    key={`collapse-${row.id}`}
                    sx={{ backgroundColor: colors.backgroundOpenSubSection }}
                  >
                    <TableCell
                      style={{ paddingBottom: 0, paddingTop: 0 }}
                      colSpan={3}
                    >
                      <Collapse
                        in={expandedRows[row.id]}
                        timeout="auto"
                        unmountOnExit
                      >
                        <Box sx={{ py: 3 }}>
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "flex-end",
                              alignItems: "center",
                              mb: 2,
                            }}
                          >
                            <Stack direction="row" spacing={1}>
                              <ActionButton
                                handleClick={() => onUploadClick(row.folder)}
                                icon={<UploadIcon />}
                                text={t(
                                  "reportsManagement.reports.uploadReport",
                                )}
                              />
                            </Stack>
                          </Box>

                          {loadingReports ? (
                            <Box sx={{ textAlign: "center", py: 4 }}>
                              <LoadingProgress size={36} sx={{ mb: 1 }} />
                              <Typography variant="body2">
                                {t("reportsManagement.reports.loadingReports")}
                              </Typography>
                            </Box>
                          ) : folderReports.length === 0 ? (
                            <Box sx={{ textAlign: "center", py: 4 }}>
                              <DescriptionIcon
                                sx={{
                                  fontSize: 48,
                                  color: "text.disabled",
                                  mb: 1,
                                }}
                              />
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {t(
                                  "reportsManagement.reports.noReportsForFolder",
                                )}
                              </Typography>
                            </Box>
                          ) : (
                            <TableContainer
                              sx={{
                                backgroundColor: "transparent",
                                borderRadius: "1rem",
                                overflow: "hidden",
                              }}
                            >
                              <Table size="small">
                                <TableHead sx={table.header}>
                                  <TableRow>
                                    <TableCell sx={table.headerCell}>
                                      {t("reportsManagement.reports.fileName")}
                                    </TableCell>
                                    <TableCell sx={table.headerCell}>
                                      {t("reportsManagement.reports.size")}
                                    </TableCell>
                                    <TableCell sx={table.headerCell}>
                                      {t(
                                        "reportsManagement.reports.lastModified",
                                      )}
                                    </TableCell>
                                    <TableCell
                                      sx={{
                                        ...table.headerCell,
                                        textAlign: "right",
                                      }}
                                    >
                                      {t("reportsManagement.reports.actions")}
                                    </TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody sx={table.body}>
                                  {folderReports.map((report) => (
                                    <TableRow key={report.key} sx={table.row}>
                                      <TableCell sx={table.cell}>
                                        <Box
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                          }}
                                        >
                                          <PdfIcon
                                            sx={{
                                              color: colors.error,
                                              fontSize: 20,
                                            }}
                                          />
                                          <Typography
                                            sx={{
                                              fontSize:
                                                typography.fontSize.small,
                                              fontWeight:
                                                typography.fontWeight.medium,
                                              fontFamily: typography.fontFamily,
                                              color: colors.textPrimary,
                                            }}
                                          >
                                            {report.name}
                                          </Typography>
                                        </Box>
                                      </TableCell>
                                      <TableCell sx={table.cell}>
                                        <Typography
                                          sx={{
                                            fontSize: typography.fontSize.small,
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
                                            fontSize: typography.fontSize.small,
                                            fontFamily: typography.fontFamily,
                                            color: colors.textPrimary,
                                          }}
                                        >
                                          {formatDate(report.lastModified)}
                                        </Typography>
                                      </TableCell>
                                      <TableCell
                                        sx={{
                                          ...table.cell,
                                          textAlign: "right",
                                        }}
                                      >
                                        <Stack
                                          direction="row"
                                          spacing={0.5}
                                          justifyContent="flex-end"
                                        >
                                          <ViewButton
                                            handleClick={() =>
                                              handleViewReport(
                                                row.folder,
                                                report,
                                              )
                                            }
                                            title={t("common.view")}
                                            size="small"
                                          />
                                          <DownloadButton
                                            handleClick={() =>
                                              handleDownloadReport(
                                                row.folder,
                                                report,
                                              )
                                            }
                                            title={t(
                                              "reportsManagement.reports.download",
                                            )}
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
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={rows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{
          ...card,
          borderTop: `1px solid ${colors.border}`,
          mt: 0,
        }}
      />
    </Box>
  );
};

ClientFoldersDesktop.propTypes = {
  rows: PropTypes.array.isRequired,
  reports: PropTypes.object.isRequired,
  loading: PropTypes.bool,
  loadingReports: PropTypes.bool,
  onUploadClick: PropTypes.func.isRequired,
  handleDownloadReport: PropTypes.func.isRequired,
  handleDeleteReport: PropTypes.func.isRequired,
  formatFileSize: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
  emptyMessage: PropTypes.string,
};

ClientFoldersDesktop.defaultProps = {
  loading: false,
  loadingReports: false,
  emptyMessage: "No folders found",
};
