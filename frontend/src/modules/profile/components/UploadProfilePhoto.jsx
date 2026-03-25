import { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Avatar,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import { CameraAlt, Close as CloseIcon } from "@mui/icons-material";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { extractApiError } from "../../../common/utils/apiHelpers";
import {
  useUploadAvatarMutation,
  useDeleteAvatarMutation,
} from "../../../store/api/profileApi";
import { setCredentials } from "../../../store/auth/authSlice";
import { colors, modalCard } from "../../../common/styles/styles";
import { ActionButton } from "../../../common/components/ui/ActionButton";
import { CancelButton } from "../../../common/components/ui/CancelButton";
import { DeleteButton } from "../../../common/components/ui/DeleteButton";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:3001/api"
).replace("/api", "");

export const getAvatarSrc = (avatarUrl) =>
  avatarUrl ? `${API_BASE}${avatarUrl}` : null;

export const UploadProfilePhoto = ({ open, onClose, onNotification }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { user, token, tokenExpiry } = useSelector((state) => state.auth);

  const [uploadAvatar, { isLoading: isUploadingAvatar }] =
    useUploadAvatarMutation();
  const [deleteAvatar] = useDeleteAvatarMutation();

  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const fileInputRef = useRef(null);

  const currentAvatarSrc = getAvatarSrc(user?.avatarUrl);

  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();

  // Cleanup blob URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const updateAuthState = (avatarUrl) => {
    dispatch(
      setCredentials({
        token,
        user: { ...user, avatarUrl },
        tokenExpiry,
      }),
    );
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|gif|webp)$/.test(file.type)) {
      onNotification(t("profile.avatarUpdateFailed"), "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      onNotification(t("profile.avatarUpdateFailed"), "error");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!avatarFile) return;
    try {
      const formData = new FormData();
      formData.append("avatar", avatarFile);
      const result = await uploadAvatar(formData).unwrap();
      updateAuthState(result.avatarUrl);
      onNotification(t("profile.avatarUpdated"), "success");
      handleClose();
    } catch (err) {
      onNotification(
        extractApiError(err, t("profile.avatarUpdateFailed")),
        "error",
      );
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAvatar().unwrap();
      updateAuthState(null);
      onNotification(t("profile.avatarRemoved"), "success");
      handleClose();
    } catch (err) {
      onNotification(
        extractApiError(err, t("profile.avatarUpdateFailed")),
        "error",
      );
    }
  };

  const handleClose = () => {
    onClose();
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: modalCard?.dialogSection } }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography sx={{ fontWeight: 600 }}>
          {t("profile.uploadPhoto")}
        </Typography>
        <IconButton size="small" onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            py: 2,
          }}
        >
          <Avatar
            src={avatarPreview || currentAvatarSrc}
            sx={{
              width: 120,
              height: 120,
              color: colors.primary,
              bgcolor: colors.financialClientAvatar,
              fontSize: "3rem",
              fontWeight: 600,
            }}
          >
            {!avatarPreview && !currentAvatarSrc && initials}
          </Avatar>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<CameraAlt />}
              sx={{
                borderRadius: "1.5rem",
                textTransform: "none",
                borderColor: colors.primary,
                color: colors.primary,
                "&:hover": { borderColor: colors.primary },
              }}
            >
              {t("profile.changePhoto")}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                hidden
                onChange={handleFileSelect}
              />
            </Button>
            {currentAvatarSrc && !avatarPreview && (
              <DeleteButton
                handleDelete={handleDelete}
                itemName={t("profile.photoLabel")}
                itemType="image"
                size="small"
              />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t("profile.uploadPhotoHint")}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", gap: 1, pb: 2 }}>
        <ActionButton
          handleClick={handleUpload}
          disabled={!avatarFile || isUploadingAvatar}
          text={
            isUploadingAvatar
              ? t("common.uploading")
              : t("profile.uploadPhoto")
          }
        />
        <CancelButton handleClick={handleClose} text={t("common.cancel")} />
      </DialogActions>
    </Dialog>
  );
};
