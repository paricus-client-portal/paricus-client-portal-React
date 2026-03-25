import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Avatar,
  Typography,
  IconButton,
  Badge,
} from "@mui/material";
import { CameraAlt } from "@mui/icons-material";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertInline } from "../../../common/components/ui/AlertInline";
import { useNotification } from "../../../common/hooks";
import { extractApiError } from "../../../common/utils/apiHelpers";
import {
  useUpdateProfileMutation,
  useUpdatePasswordMutation,
} from "../../../store/api/profileApi";
import { setCredentials } from "../../../store/auth/authSlice";
import {
  outlinedIconButton,
  primaryIconButton,
  profilelStyles,
  colors,
} from "../../../common/styles/styles";
import { PasswordField } from "../../../common/components/ui/PasswordField";
import { UploadProfilePhoto, getAvatarSrc } from "./UploadProfilePhoto";

const noShadowSx = {
  ...profilelStyles.inputField,
  "& .MuiOutlinedInput-root": {
    ...profilelStyles.inputField["& .MuiOutlinedInput-root"],
    boxShadow: "none",
    backgroundColor: "transparent",
  },
  "& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus":
    {
      WebkitBoxShadow: "0 0 0 1000px white inset !important",
      WebkitTextFillColor: "inherit !important",
      transition: "background-color 5000s ease-in-out 0s",
    },
};

const profileGridSx = {
  display: "grid",
  gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
  gap: 3,
};

const passwordGridSx = {
  display: "grid",
  gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
  gap: 3,
};

const buildSchema = (t) =>
  z
    .object({
      firstName: z.string().min(1, t("profile.firstNameRequired")),
      lastName: z.string().min(1, t("profile.lastNameRequired")),
      currentPassword: z.string().optional().default(""),
      newPassword: z.string().optional().default(""),
      confirmPassword: z.string().optional().default(""),
    })
    .superRefine((data, ctx) => {
      const { currentPassword, newPassword, confirmPassword } = data;
      const anyFilled = currentPassword || newPassword || confirmPassword;

      if (!anyFilled) return;

      if (!currentPassword || !newPassword || !confirmPassword) {
        ctx.addIssue({
          code: "custom",
          message: t("profile.allPasswordFieldsRequired"),
          path: ["currentPassword"],
        });
        return;
      }

      if (newPassword.length < 8) {
        ctx.addIssue({
          code: "custom",
          message: t("profile.passwordMinLength"),
          path: ["newPassword"],
        });
      }

      if (newPassword !== confirmPassword) {
        ctx.addIssue({
          code: "custom",
          message: t("profile.passwordsNotMatch"),
          path: ["confirmPassword"],
        });
      }
    });

export const ProfileFormView = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { user, token, tokenExpiry } = useSelector((state) => state.auth);

  const [updateProfile, { isLoading: isUpdatingProfile }] =
    useUpdateProfileMutation();
  const [updatePassword, { isLoading: isUpdatingPassword }] =
    useUpdatePasswordMutation();
  const { notificationRef, showNotification } = useNotification();

  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  const currentAvatarSrc = getAvatarSrc(user?.avatarUrl);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({
    resolver: zodResolver(buildSchema(t)),
    mode: "onChange",
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data) => {
    try {
      const result = await updateProfile({
        first_name: data.firstName,
        last_name: data.lastName,
      }).unwrap();

      // Sync Redux state so AppBar name updates immediately
      dispatch(
        setCredentials({
          token,
          user: {
            ...user,
            firstName: result.user?.firstName ?? data.firstName,
            lastName: result.user?.lastName ?? data.lastName,
          },
          tokenExpiry,
        }),
      );

      if (data.currentPassword && data.newPassword) {
        await updatePassword({
          current_password: data.currentPassword,
          new_password: data.newPassword,
        }).unwrap();

        showNotification(
          `${t("profile.profileUpdated")} / ${t("profile.passwordUpdated")}`,
          "success",
        );
      } else {
        showNotification(t("profile.profileUpdated"), "success");
      }

      reset({
        firstName: data.firstName,
        lastName: data.lastName,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      showNotification(
        extractApiError(error, t("profile.profileUpdateFailed")),
        "error",
      );
    }
  };

  const handleCancel = () => {
    reset({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const isBusy = isSubmitting || isUpdatingProfile || isUpdatingPassword;

  return (
    <Box sx={profilelStyles}>
      {/* Profile Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 4 }}>
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          badgeContent={
            <IconButton
              size="small"
              onClick={() => setAvatarDialogOpen(true)}
              sx={{
                bgcolor: colors.primary,
                color: "white",
                width: 28,
                height: 28,
                "&:hover": { bgcolor: colors.primaryDark || colors.primary },
              }}
            >
              <CameraAlt sx={{ fontSize: 16 }} />
            </IconButton>
          }
        >
          <Avatar
            src={currentAvatarSrc}
            alt={t("profile.photoLabel")}
            sx={{
              width: 80,
              height: 80,
              bgcolor: colors.financialClientAvatar,
              fontSize: "2rem",
              fontWeight: 600,
              cursor: "pointer",
              color: colors.primary,
            }}
            onClick={() => setAvatarDialogOpen(true)}
          >
            {!currentAvatarSrc &&
              `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase()}
          </Avatar>
        </Badge>
        <Box>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            {user?.firstName} {user?.lastName}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {user?.email}
          </Typography>
        </Box>
      </Box>

      {/* Avatar Upload Dialog */}
      <UploadProfilePhoto
        open={avatarDialogOpen}
        onClose={() => setAvatarDialogOpen(false)}
        onNotification={showNotification}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Profile Form */}
        <Box sx={profileGridSx}>
          <Controller
            name="firstName"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t("profile.firstName")}
                fullWidth
                sx={profilelStyles.inputField}
                error={!!errors.firstName}
                helperText={errors.firstName?.message}
              />
            )}
          />
          <Controller
            name="lastName"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t("profile.lastName")}
                fullWidth
                sx={profilelStyles.inputField}
                error={!!errors.lastName}
                helperText={errors.lastName?.message}
              />
            )}
          />
          <TextField
            label={t("profile.email")}
            type="email"
            fullWidth
            sx={profilelStyles.inputField}
            value={user?.email || ""}
            disabled
            helperText={t("profile.emailCannotChange")}
          />
        </Box>

        {/* Change Password Section */}
        <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
            {t("profile.changePassword")}
          </Typography>

          <Box sx={passwordGridSx}>
            <Controller
              name="currentPassword"
              control={control}
              render={({ field }) => (
                <PasswordField
                  {...field}
                  label={t("profile.currentPassword")}
                  autoComplete="new-password"
                  fullWidth
                  sx={noShadowSx}
                  error={!!errors.currentPassword}
                  helperText={errors.currentPassword?.message}
                />
              )}
            />
            <Controller
              name="newPassword"
              control={control}
              render={({ field }) => (
                <PasswordField
                  {...field}
                  label={t("profile.newPassword")}
                  autoComplete="new-password"
                  fullWidth
                  sx={noShadowSx}
                  error={!!errors.newPassword}
                  helperText={errors.newPassword?.message}
                />
              )}
            />
            <Controller
              name="confirmPassword"
              control={control}
              render={({ field }) => (
                <PasswordField
                  {...field}
                  label={t("profile.confirmPassword")}
                  autoComplete="new-password"
                  fullWidth
                  sx={noShadowSx}
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword?.message}
                />
              )}
            />
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ mt: 4, display: "flex", gap: 2, justifyContent: "center" }}>
          <Button
            type="submit"
            variant="contained"
            disabled={!isDirty || isBusy}
            sx={primaryIconButton}
          >
            {t("profile.updateProfile")}
          </Button>

          <Button
            type="button"
            variant="outlined"
            disabled={!isDirty || isBusy}
            onClick={handleCancel}
            sx={outlinedIconButton}
          >
            {t("common.cancel")}
          </Button>
        </Box>
      </form>

      {/* Notifications */}
      <AlertInline ref={notificationRef} asSnackbar />
    </Box>
  );
};
