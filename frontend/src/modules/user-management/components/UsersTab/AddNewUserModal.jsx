import { useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  modalCard,
  titlesTypography,
  selectMenuProps,
} from "../../../../common/styles/styles";
import { ActionButton } from "../../../../common/components/ui/ActionButton";
import { CancelButton } from "../../../../common/components/ui/CancelButton";
import { PasswordField } from "../../../../common/components/ui/PasswordField";

const buildSchema = (t, isEditing) =>
  z.object({
    first_name: z.string().min(1, t("users.form.firstNameRequired")),
    last_name: z.string().min(1, t("users.form.lastNameRequired")),
    email: z.string().min(1, t("users.form.emailRequired")).email(t("users.form.emailInvalid")),
    password: isEditing
      ? z.string().optional().default("")
      : z.string()
          .min(8, t("users.form.passwordMinLength"))
          .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
            t("users.form.passwordRequirements", "Must contain uppercase, lowercase, number, and special character (@$!%*?&)")
          ),
    client_id: z.coerce.number().min(1, t("users.form.clientRequired")),
    role_id: z.coerce.number().min(1, t("users.form.roleRequired")),
  });

export const AddNewUserModal = ({
  dialog,
  editingUser,
  closeDialog,
  onSave,
  saving,
  clientOptions,
  allRoles,
  isBPOAdmin,
  defaultClientId,
}) => {
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm({
    resolver: zodResolver(buildSchema(t, !!editingUser)),
    mode: "onChange",
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      client_id: defaultClientId || "",
      role_id: "",
    },
  });

  const clientIdValue = watch("client_id");

  // Filter roles based on selected client
  const filteredRoles = useMemo(() => {
    if (!clientIdValue) return [];
    return allRoles
      .filter((role) => role.client_id === clientIdValue)
      .map((role) => ({ title: role.role_name, value: role.id }));
  }, [allRoles, clientIdValue]);

  // Reset form when dialog opens
  useEffect(() => {
    if (dialog) {
      reset({
        first_name: editingUser?.firstName || "",
        last_name: editingUser?.lastName || "",
        email: editingUser?.email || "",
        password: "",
        client_id: editingUser?.clientId || defaultClientId || "",
        role_id: editingUser?.roleId || "",
      });
    }
  }, [dialog, editingUser, defaultClientId, reset]);

  const handleClientChange = (newClientId) => {
    setValue("client_id", newClientId, { shouldValidate: true });
    setValue("role_id", "", { shouldValidate: true });
  };

  const onSubmit = (data) => {
    onSave(data);
  };

  return (
    <Dialog
      open={dialog}
      onClose={closeDialog}
      slotProps={{
        paper: {
          sx: modalCard?.dialogSection,
        },
      }}
    >
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Typography
            sx={{
              ...titlesTypography?.primaryTitle,
              textAlign: "center",
            }}
          >
            {editingUser ? t("users.editUser") : t("users.addNewUser")}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box
          component="form"
          id="user-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <Box sx={modalCard?.boxModalStyle?.boxManagementModal}>
            <Controller
              name="first_name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  required
                  label={t("users.form.firstName")}
                  sx={modalCard?.inputSection}
                  error={!!errors.first_name}
                  helperText={errors.first_name?.message}
                />
              )}
            />
            <Controller
              name="last_name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  required
                  label={t("users.form.lastName")}
                  sx={modalCard?.inputSection}
                  error={!!errors.last_name}
                  helperText={errors.last_name?.message}
                />
              )}
            />
          </Box>
          <Box sx={modalCard?.boxModalStyle?.boxManagementModal}>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  required
                  type="email"
                  autoComplete="new-email"
                  label={t("users.form.email")}
                  sx={modalCard?.inputSection}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                />
              )}
            />
            {!editingUser && (
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <PasswordField
                    {...field}
                    fullWidth
                    required
                    autoComplete="new-password"
                    label={t("users.form.password")}
                    sx={modalCard?.inputSection}
                    error={!!errors.password}
                    helperText={errors.password?.message}
                  />
                )}
              />
            )}
          </Box>
          <Box sx={modalCard?.boxModalStyle?.boxManagementModal}>
            {isBPOAdmin && (
              <Controller
                name="client_id"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth required error={!!errors.client_id}>
                    <InputLabel
                      sx={modalCard?.multiOptionFilter?.inputLabelSection}
                    >
                      {t("users.form.client")}
                    </InputLabel>
                    <Select
                      value={field.value || ""}
                      onChange={(e) => handleClientChange(e.target.value || null)}
                      label={t("users.form.client")}
                      MenuProps={selectMenuProps}
                      sx={modalCard?.multiOptionFilter?.selectSection}
                    >
                      <MenuItem value="">{t("users.form.selectClient")}</MenuItem>
                      {clientOptions.map((client) => (
                        <MenuItem key={client.value} value={client.value}>
                          {client.title}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.client_id && (
                      <FormHelperText>{errors.client_id.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            )}

            <Controller
              name="role_id"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth disabled={!clientIdValue} required error={!!errors.role_id}>
                  <InputLabel
                    sx={modalCard?.multiOptionFilter?.inputLabelSection}
                  >
                    {t("users.form.role")}
                  </InputLabel>
                  <Select
                    value={field.value || ""}
                    onChange={(e) =>
                      setValue("role_id", e.target.value || null, { shouldValidate: true })
                    }
                    label={t("users.form.role")}
                    MenuProps={selectMenuProps}
                    sx={modalCard?.multiOptionFilter?.selectSection}
                    displayEmpty={false}
                  >
                    {!clientIdValue ? (
                      <MenuItem value="" disabled>
                        {t("users.form.selectClientFirst")}
                      </MenuItem>
                    ) : filteredRoles.length === 0 ? (
                      <MenuItem value="" disabled>
                        {t("users.form.noRolesAvailable")}
                      </MenuItem>
                    ) : (
                      filteredRoles.map((role) => (
                        <MenuItem key={role.value} value={role.value}>
                          {role.title}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                  {errors.role_id && (
                    <FormHelperText>{errors.role_id.message}</FormHelperText>
                  )}
                </FormControl>
              )}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          margin: "0 0 1rem 0",
          justifyContent: "center",
        }}
      >
        <ActionButton
          handleClick={handleSubmit(onSubmit)}
          disabled={saving || !isValid}
          text={saving ? t("common.saving") : t("common.save")}
          sx={{ width: "20%" }}
        />
        <CancelButton
          handleClick={closeDialog}
          text={t("common.cancel")}
        />
      </DialogActions>
    </Dialog>
  );
};

AddNewUserModal.propTypes = {
  dialog: PropTypes.bool.isRequired,
  editingUser: PropTypes.object,
  closeDialog: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  saving: PropTypes.bool,
  clientOptions: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ).isRequired,
  allRoles: PropTypes.array.isRequired,
  isBPOAdmin: PropTypes.bool,
  defaultClientId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
