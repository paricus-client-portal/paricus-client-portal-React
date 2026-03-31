import { useMemo } from "react";
import {
  Typography,
  Chip,
  Button,
  Box,
  IconButton,
  Tooltip,
  Stack,
} from "@mui/material";
import {
  Payment as PaymentIcon,
  PictureAsPdf as PdfIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { PendingLinkModal } from "./PendingLinkModal";
import { EditButton } from "../../../../common/components/ui/EditButton";
import { DeleteButton } from "../../../../common/components/ui/DeleteButton";
import { DownloadButton } from "../../../../common/components/ui/DownloadButton";
import { UniversalMobilDataTable } from "../../../../common/components/ui/UniversalMobilDataTable";
import { colors } from "../../../../common/styles/styles";

export const InvoicesTableMobile = ({
  invoices,
  isAdmin,
  formatDate,
  formatCurrency,
  getStatusColor,
  downloadInvoice,
  openEditInvoiceModal,
  handleDeleteInvoice,
  openPaymentLink,
  onPaymentLinkSuccess,
  onPaymentLinkError,
  selectedFolderDisplay,
  onUploadClick,
  onRefreshClick,
  loadingInvoices,
  hideHeader = false,
}) => {
  const { t } = useTranslation();

  const title = isAdmin
    ? `${selectedFolderDisplay || "Client"} Invoices`
    : "Your Invoices";

  // Column definitions for expanded content
  const columns = useMemo(
    () => [
      {
        field: "title",
        headerName: t("invoices.table.fileName"),
        labelWidth: 120,
        renderCell: ({ value }) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <PdfIcon color="error" fontSize="small" />
            <span>{value}</span>
          </Box>
        ),
      },
      {
        field: "amount",
        headerName: t("invoices.table.amount"),
        labelWidth: 120,
        renderCell: ({ row }) => (
          <Typography variant="body2" fontWeight="bold">
            {formatCurrency(row.amount, row.currency)}
          </Typography>
        ),
      },
      {
        field: "status",
        headerName: t("invoices.table.status"),
        labelWidth: 120,
        renderCell: ({ row }) => (
          <Chip
            label={(row.status || "pending").toUpperCase()}
            color={getStatusColor(row.status || "pending")}
            size="small"
          />
        ),
      },
      {
        field: "issuedDate",
        headerName: t("invoices.table.issuedDate") || "Issued Date",
        labelWidth: 120,
        valueGetter: (row) => formatDate(row.issuedDate),
      },
      {
        field: "dueDate",
        headerName: t("invoices.table.dueDate"),
        labelWidth: 120,
        valueGetter: (row) => formatDate(row.dueDate),
      },
      {
        field: "paidDate",
        headerName: t("invoices.table.paymentDate"),
        labelWidth: 120,
        renderCell: ({ row }) =>
          row.paidDate && row.status === "paid" ? (
            <Typography variant="body2" color="success.main">
              {formatDate(row.paidDate)}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          ),
      },
      ...(isAdmin ? [{
        field: "paymentLink",
        headerName: t("invoices.table.paymentLink"),
        labelWidth: 120,
        renderCell: ({ row }) => (
          <PendingLinkModal
            invoice={row}
            onSuccess={onPaymentLinkSuccess}
            onError={onPaymentLinkError}
          />
        ),
      }] : []),
    ],
    [t, formatDate, formatCurrency, getStatusColor, isAdmin, onPaymentLinkSuccess, onPaymentLinkError]
  );

  // Render actions for each row
  const renderActions = (invoice) => (
    <>
      {!isAdmin && invoice.paymentLink && (
        <Button
          variant="contained"
          color="success"
          size="small"
          startIcon={<PaymentIcon sx={{ fontSize: "1rem" }} />}
          onClick={() => openPaymentLink(invoice.paymentLink)}
          sx={{ fontSize: "0.75rem", py: 0.5, px: 1.5 }}
        >
          {t("invoices.actions.payNow")}
        </Button>
      )}
      {isAdmin && (
        <EditButton
          handleClick={openEditInvoiceModal}
          item={invoice}
          title={t("invoices.actions.editInvoice")}
        />
      )}
      <DownloadButton
        handleClick={downloadInvoice}
        item={invoice}
        title={t("invoices.actions.download")}
      />
      {isAdmin && (
        <DeleteButton
          handleDelete={handleDeleteInvoice}
          item={invoice}
          itemName={`${t("common.invoice")} #${invoice.invoiceNumber}`}
          itemType="invoice"
        />
      )}
    </>
  );

  // Header actions
  const headerActions = (
    <Stack direction="row" spacing={1}>
      {isAdmin && (
        <Tooltip title="Upload Invoice">
          <IconButton color="primary" size="small" onClick={onUploadClick}>
            <UploadIcon />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Refresh">
        <IconButton
          color="default"
          size="small"
          onClick={onRefreshClick}
          disabled={loadingInvoices}
        >
          <RefreshIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  return (
    <Box sx={{ display: { xs: "block", md: "none" }, mt: hideHeader ? 0 : 3 }}>
      {/* Title */}
      {!hideHeader && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
            px: 1,
          }}
        >
          <Typography variant="h6" fontWeight="semibold">
            {title}
          </Typography>
          {headerActions}
        </Box>
      )}

      {/* Universal Accordion Table */}
      <UniversalMobilDataTable
        rows={invoices}
        columns={columns}
        primaryField="invoiceNumber"
        primaryIcon={<PdfIcon fontSize="small" sx={{ color: colors.primary }} />}
        showTitle={true}
        titleField="invoiceNumber"
        headerTitle={t("invoices.table.invoiceNumber")}
        loading={loadingInvoices}
        emptyMessage={t("invoices.noInvoices")}
        renderActions={renderActions}
        actionsLabel={t("invoices.table.actions")}
        labelWidth={120}
        getRowId={(row) => row.id}
        hideHeader={true}
      />
    </Box>
  );
};
