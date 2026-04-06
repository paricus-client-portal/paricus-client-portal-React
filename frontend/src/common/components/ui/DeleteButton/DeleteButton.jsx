import { useState } from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
  Box,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { colors, modalCard } from "../../../styles/styles";
import { AlertInline } from "../AlertInline";
import { useNotification } from "../../../hooks";
import { ActionButton } from "../ActionButton";
import { CancelButton } from "../CancelButton";
import { LoadingProgress } from "../LoadingProgress";
import { logger } from "../../../utils/logger";

/**
 * DeleteButton - Botón de eliminación con diálogo de confirmación y snackbar integrado
 *
 * Props:
 * - handleDelete: función async que ejecuta la eliminación (recibe item)
 * - item: objeto a eliminar (invoice, user, role, etc.)
 * - itemName: nombre del item para mostrar en el diálogo (ej: "Invoice #123")
 * - itemType: tipo de item para traducción (ej: "invoice", "user", "role", "report")
 * - title: tooltip del botón
 * - successMessage: mensaje personalizado de éxito
 * - errorMessage: mensaje personalizado de error
 * - onSuccess: callback después de eliminar exitosamente
 * - onError: callback después de un error
 */
export const DeleteButton = ({
  handleDelete,
  item,
  itemName,
  itemType = "item",
  title,
  icon,
  sx,
  color = "",
  size = "small",
  disabled = false,
  successMessage,
  errorMessage,
  onSuccess,
  onError,
  confirmTitle,
  confirmMessage,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { notificationRef, showSuccess, showError } = useNotification();

  const handleClickOpen = () => {
    if (disabled) return;
    setOpen(true);
  };

  const handleClose = () => {
    if (isDeleting) return;
    setOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!handleDelete) {
      logger.error("DeleteButton: handleDelete prop is required");
      return;
    }

    setIsDeleting(true);

    try {
      await handleDelete(item);

      setOpen(false);

      // Mostrar snackbar de éxito
      const successMsg =
        successMessage ||
        t("common.deleteSuccess", {
          item: itemName || t(`common.${itemType}`) || t("common.item"),
        });
      showSuccess(successMsg);

      // Callback de éxito
      if (onSuccess) {
        onSuccess(item);
      }
    } catch (error) {
      logger.error("DeleteButton delete error:", error);

      // Mostrar snackbar de error
      const errorMsg =
        errorMessage ||
        error?.data?.error ||
        error?.data?.message ||
        error?.message ||
        t("common.deleteError", {
          item: itemName || t(`common.${itemType}`) || t("common.item"),
        });
      showError(errorMsg);

      // Callback de error
      if (onError) {
        onError(error, item);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Generar título y mensaje del diálogo
  const dialogTitle =
    confirmTitle ||
    t("common.confirmDeleteTitle", {
      item: t(`common.${itemType}`) || t("common.item"),
    });

  const dialogMessage =
    confirmMessage ||
    t("common.confirmDeleteMessage", {
      item: itemName || t(`common.${itemType}`) || t("common.item"),
    });

  return (
    <>
      <Tooltip title={title || t("common.delete")}>
        <span>
          <IconButton
            color={color}
            size={size}
            onClick={handleClickOpen}
            disabled={disabled}
            sx={{ ...sx }}
          >
            {icon || (
              <DeleteIcon
                fontSize={size}
                sx={{ color: disabled ? "inherit" : colors.error }}
              />
            )}
          </IconButton>
        </span>
      </Tooltip>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        aria-labelledby="delete-dialog-title"
        slotProps={{
          paper: {
            sx: modalCard?.dialogSection,
          },
        }}
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent:'center' }}>
            <WarningIcon sx={{ color: colors.error }} />
            {dialogTitle}
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            {dialogMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ padding: 2, gap: 1, justifyContent: "center" }}>
          <ActionButton
            handleClick={handleConfirmDelete}
            disabled={isDeleting}
            text={isDeleting ? t("common.deleting") : t("common.delete")}
            icon={
              isDeleting ? (
               <LoadingProgress size={16} />
              ) : (
                <DeleteIcon />
              )
            }
          />
          <CancelButton handleClick={handleClose} disabled={isDeleting}  text={t("common.cancel")}/>
        </DialogActions>
      </Dialog>

      <AlertInline ref={notificationRef} asSnackbar />
    </>
  );
};

DeleteButton.propTypes = {
  handleDelete: PropTypes.func.isRequired,
  item: PropTypes.any,
  itemName: PropTypes.string,
  itemType: PropTypes.string,
  title: PropTypes.string,
  icon: PropTypes.node,
  sx: PropTypes.object,
  color: PropTypes.string,
  size: PropTypes.oneOf(["small", "medium", "large"]),
  disabled: PropTypes.bool,
  successMessage: PropTypes.string,
  errorMessage: PropTypes.string,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
  confirmTitle: PropTypes.string,
  confirmMessage: PropTypes.string,
};

export default DeleteButton;
