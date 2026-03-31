import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  Button,
  Box,
} from "@mui/material";
import {
  Payment as PaymentIcon,
  PictureAsPdf as PdfIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import { PendingLinkModal } from "./PendingLinkModal";
import {
  table,
  colors,
  typography,
  statusBadges,
} from "../../../../common/styles/styles";
import { DeleteButton } from "../../../../common/components/ui/DeleteButton";
import { DownloadButton } from "../../../../common/components/ui/DownloadButton";
import { EditButton } from "../../../../common/components/ui/EditButton";
import { ViewButton } from "../../../../common/components/ui/ViewButton";

export const InvoicesTableDesktop = ({
  invoices,
  isAdmin,
  formatDate,
  formatCurrency,
  viewInvoice,
  downloadInvoice,
  openEditInvoiceModal,
  handleDeleteInvoice,
  openPaymentLink,
  onPaymentLinkSuccess,
  onPaymentLinkError,
  // Props adicionales para compatibilidad con Mobile (no usadas en Desktop)
  selectedFolderDisplay,
  onUploadClick,
  onRefreshClick,
  loadingInvoices,
  getStatusColor,
}) => {
  const { t } = useTranslation();

  // Función para obtener el estilo del badge según el status
  const getStatusBadgeStyle = (status) => {
    const statusMap = {
      paid: statusBadges.paid,
      sent: statusBadges.sent,
      pending: statusBadges.pending,
      overdue: statusBadges.error,
    };
    return statusMap[status?.toLowerCase()] || statusBadges.info;
  };

  return (
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
              {t("invoices.table.invoiceNumber")}
            </TableCell>
            <TableCell sx={table.headerCellInvoice}>
              {t("invoices.table.fileName")}
            </TableCell>
            <TableCell sx={table.headerCellInvoice}>
              {t("invoices.table.amount")}
            </TableCell>
            <TableCell
              sx={{ ...table.headerCellInvoice, paddingLeft: "2.5rem" }}
            >
              {t("invoices.table.status")}
            </TableCell>
            <TableCell sx={table.headerCellInvoice}>
              {t("invoices.table.dueDate")}
            </TableCell>
            <TableCell sx={table.headerCell}>
              {t("invoices.table.paymentDate")}
            </TableCell>
            {isAdmin && (
              <TableCell sx={table.headerCellInvoice}>
                {t("invoices.table.paymentLink")}
              </TableCell>
            )}

            <TableCell
              sx={{
                ...table.headerCell,
                textAlign: "right",
                paddingRight: "4rem",
              }}
            >
              {t("invoices.table.actions")}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody sx={table.body}>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id} sx={table.row}>
              <TableCell sx={table.cell}>
                <Typography
                  sx={{
                    fontSize: typography.fontSize.body, // text-sm (14px)
                    fontWeight: typography.fontWeight.bold,
                    fontFamily: typography.fontFamily,
                    color: colors.textPrimary,
                  }}
                >
                  {invoice.invoiceNumber}
                </Typography>
                <Typography
                  sx={{
                    fontSize: typography.fontSize.small, // text-xs (12px)
                    color: colors.textMuted,
                    fontFamily: typography.fontFamily,
                  }}
                >
                  {formatDate(invoice.issuedDate)}
                </Typography>
              </TableCell>
              <TableCell sx={table.cell}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <PdfIcon sx={{ color: colors.error, fontSize: 20 }} />
                  <Typography
                    sx={{
                      fontSize: typography.fontSize.body,
                      fontFamily: typography.fontFamily,
                      color: colors.textPrimary,
                    }}
                  >
                    {invoice.title}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell sx={table.cell}>
                <Typography
                  sx={{
                    fontSize: typography.fontSize.body,
                    fontWeight: typography.fontWeight.bold,
                    fontFamily: typography.fontFamily,
                    color: colors.textPrimary,
                  }}
                >
                  {formatCurrency(invoice.amount, invoice.currency)}
                </Typography>
              </TableCell>
              <TableCell sx={table.cell}>
                <Box
                  component="span"
                  sx={{
                    ...getStatusBadgeStyle(invoice.status || "pending"),
                    ...colors.intranetRed,
                  }}
                >
                  {(invoice.status || "pending").toUpperCase()}
                </Box>
              </TableCell>
              <TableCell sx={table.cell}>
                <Typography
                  sx={{
                    fontSize: typography.fontSize.body,
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamily,
                  }}
                >
                  {formatDate(invoice.dueDate)}
                </Typography>
              </TableCell>
              <TableCell sx={table.cell}>
                {invoice.paidDate && invoice.status === "paid" ? (
                  <Typography
                    sx={{
                      fontSize: typography.fontSize.body,
                      color: colors.success,
                      fontFamily: typography.fontFamily,
                    }}
                  >
                    {formatDate(invoice.paidDate)}
                  </Typography>
                ) : (
                  <Typography
                    sx={{
                      fontSize: typography.fontSize.body,
                      color: colors.textMuted,
                      fontFamily: typography.fontFamily,
                    }}
                  >
                    —
                  </Typography>
                )}
              </TableCell>
              {isAdmin && (
                <TableCell sx={table.cell}>
                  <PendingLinkModal
                    invoice={invoice}
                    onSuccess={onPaymentLinkSuccess}
                    onError={onPaymentLinkError}
                  />
                </TableCell>
              )}

              <TableCell sx={{ ...table.cell, textAlign: "right" }}>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  {!isAdmin && invoice.paymentLink && (
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={<PaymentIcon />}
                      onClick={() => openPaymentLink(invoice.paymentLink)}
                    >
                      {t("invoices.actions.payNow")}
                    </Button>
                  )}
                  {isAdmin && (
                    <EditButton
                      handleClick={openEditInvoiceModal}
                      item={invoice}
                    />
                  )}
                  <ViewButton handleClick={viewInvoice} item={invoice} />
                  <DownloadButton
                    handleClick={downloadInvoice}
                    item={invoice}
                  />
                  {isAdmin && (
                    <DeleteButton
                      handleDelete={handleDeleteInvoice}
                      item={invoice}
                      itemName={`${t("common.invoice")} #${invoice.invoiceNumber}`}
                      itemType="invoice"
                    />
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

InvoicesTableDesktop.propTypes = {
  invoices: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      invoiceNumber: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      fileName: PropTypes.string,
      amount: PropTypes.number.isRequired,
      currency: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      dueDate: PropTypes.string.isRequired,
      issuedDate: PropTypes.string.isRequired,
      paidDate: PropTypes.string,
      paymentLink: PropTypes.string,
    }),
  ).isRequired,
  isAdmin: PropTypes.bool.isRequired,
  formatDate: PropTypes.func.isRequired,
  formatCurrency: PropTypes.func.isRequired,
  viewInvoice: PropTypes.func.isRequired,
  downloadInvoice: PropTypes.func.isRequired,
  openEditInvoiceModal: PropTypes.func.isRequired,
  handleDeleteInvoice: PropTypes.func.isRequired,
  openPaymentLink: PropTypes.func.isRequired,
  onPaymentLinkSuccess: PropTypes.func.isRequired,
  onPaymentLinkError: PropTypes.func.isRequired,
  selectedFolderDisplay: PropTypes.string,
  onUploadClick: PropTypes.func,
  onRefreshClick: PropTypes.func,
  loadingInvoices: PropTypes.bool,
  getStatusColor: PropTypes.func,
};
