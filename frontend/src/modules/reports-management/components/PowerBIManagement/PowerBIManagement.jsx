import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Dashboard as DashboardIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import {
  useGetDashboardsQuery,
  useCreateDashboardMutation,
  useUpdateDashboardMutation,
  useDeleteDashboardMutation,
} from "../../../../store/api/powerbiApi";
import { useGetClientsQuery } from "../../../../store/api/adminApi";
import { LoadingProgress } from "../../../../common/components/ui/LoadingProgress";
import {
  card,
  colors,
  typography,
  primaryButton,
  outlinedButton,
} from "../../../../common/styles/styles";

const emptyForm = { clientId: "", name: "", url: "", groupId: "", reportId: "" };

const parsePowerBIUrl = (url) => {
  const match = url.match(/groups\/([a-f0-9-]+)\/reports\/([a-f0-9-]+)/i);
  if (match) return { groupId: match[1], reportId: match[2] };
  return null;
};

const buildPowerBIUrl = (groupId, reportId) => {
  if (!groupId || !reportId) return "";
  return `https://app.powerbi.com/groups/${groupId}/reports/${reportId}`;
};

const headerCellSx = {
  fontWeight: typography.fontWeight.bold,
  textTransform: "uppercase",
  fontSize: typography.fontSize.tableHeader,
  fontFamily: typography.fontFamily,
  color: colors.textMuted,
  letterSpacing: "0.05em",
};

export const PowerBIManagement = ({ showNotification }) => {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [urlError, setUrlError] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data: dashboards = [], isLoading } = useGetDashboardsQuery();
  const { data: clients = [] } = useGetClientsQuery();
  const [createDashboard, { isLoading: creating }] = useCreateDashboardMutation();
  const [updateDashboard, { isLoading: updating }] = useUpdateDashboardMutation();
  const [deleteDashboard] = useDeleteDashboardMutation();

  const handleOpen = (dashboard = null) => {
    if (dashboard) {
      setEditingId(dashboard.id);
      setForm({
        clientId: dashboard.clientId,
        name: dashboard.name,
        url: buildPowerBIUrl(dashboard.groupId, dashboard.reportId),
        groupId: dashboard.groupId,
        reportId: dashboard.reportId,
      });
    } else {
      setEditingId(null);
      setForm(emptyForm);
    }
    setUrlError("");
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setUrlError("");
  };

  const handleUrlChange = (url) => {
    const parsed = parsePowerBIUrl(url);
    if (parsed) {
      setForm((prev) => ({ ...prev, url, groupId: parsed.groupId, reportId: parsed.reportId }));
      setUrlError("");
    } else {
      setForm((prev) => ({ ...prev, url, groupId: "", reportId: "" }));
      setUrlError(url.length > 0 ? t("powerbiManagement.invalidUrl") : "");
    }
  };

  const handleSubmit = async () => {
    if (!form.clientId || !form.name || !form.groupId || !form.reportId) return;

    try {
      if (editingId) {
        await updateDashboard({ id: editingId, ...form }).unwrap();
        showNotification(t("powerbiManagement.updateSuccess"), "success");
      } else {
        await createDashboard(form).unwrap();
        showNotification(t("powerbiManagement.createSuccess"), "success");
      }
      handleClose();
    } catch (error) {
      const msg = error?.status === 409
        ? t("powerbiManagement.duplicateError")
        : editingId
          ? t("powerbiManagement.updateError")
          : t("powerbiManagement.createError");
      showNotification(msg, "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("powerbiManagement.confirmDelete"))) return;
    try {
      await deleteDashboard(id).unwrap();
      showNotification(t("powerbiManagement.deleteSuccess"), "success");
    } catch {
      showNotification(t("powerbiManagement.deleteError"), "error");
    }
  };

  const isFormValid = form.clientId && form.name && form.groupId && form.reportId;
  const paginatedDashboards = dashboards.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <DashboardIcon sx={{ color: "#16A34A" }} />
          <Typography variant="h6" component="h2" fontWeight={600}>
            {t("powerbiManagement.title")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
          sx={primaryButton}
        >
          {t("powerbiManagement.addDashboard")}
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <LoadingProgress size={32} />
        </Box>
      ) : dashboards.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <DashboardIcon sx={{ fontSize: 48, color: "#16A34A", opacity: 0.4, mb: 1 }} />
          <Typography variant="body1" color="text.secondary">
            {t("powerbiManagement.noDashboards")}
          </Typography>
          <Typography variant="body2" color="text.disabled">
            {t("powerbiManagement.noDashboardsMessage")}
          </Typography>
        </Box>
      ) : (
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
                <TableCell sx={headerCellSx}>
                  {t("powerbiManagement.client")}
                </TableCell>
                <TableCell sx={headerCellSx}>
                  {t("powerbiManagement.name")}
                </TableCell>
                <TableCell sx={headerCellSx}>
                  Link
                </TableCell>
                <TableCell align="right" sx={{ ...headerCellSx, width: 100 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedDashboards.map((d) => (
                <TableRow
                  key={d.id}
                  sx={{
                    "&:hover": {
                      backgroundColor: colors.primaryLight,
                    },
                    borderBottom: `1px solid ${colors.border}`,
                    transition: "background-color 0.15s",
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <DashboardIcon sx={{ color: "#16A34A", fontSize: 20 }} />
                      <Typography variant="body2" fontWeight={500}>
                        {d.client?.name || d.clientId}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {d.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                      {buildPowerBIUrl(d.groupId, d.reportId)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(d)} sx={{ color: colors.primary }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(d.id)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={dashboards.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            sx={{
              backgroundColor: colors.background,
              borderTop: `1px solid ${colors.border}`,
            }}
          />
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingId ? t("powerbiManagement.editDashboard") : t("powerbiManagement.addDashboard")}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField
            select
            label={t("powerbiManagement.client")}
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            fullWidth
            disabled={!!editingId}
          >
            <MenuItem value="">{t("powerbiManagement.selectClient")}</MenuItem>
            {clients.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("powerbiManagement.name")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            fullWidth
            placeholder="e.g. Operations Dashboard"
          />
          <TextField
            label={t("powerbiManagement.url")}
            value={form.url}
            onChange={(e) => handleUrlChange(e.target.value)}
            fullWidth
            placeholder="https://app.powerbi.com/groups/.../reports/..."
            error={!!urlError}
            helperText={urlError || (form.groupId ? `Group: ${form.groupId} | Report: ${form.reportId}` : t("powerbiManagement.urlHelper"))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} sx={outlinedButton}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!isFormValid || creating || updating}
            sx={primaryButton}
          >
            {creating || updating ? <LoadingProgress size={20} /> : editingId ? t("common.save") : t("powerbiManagement.addDashboard")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PowerBIManagement;
