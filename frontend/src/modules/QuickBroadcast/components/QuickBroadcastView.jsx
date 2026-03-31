import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
  OutlinedInput,
  TextField,
  IconButton,
} from "@mui/material";
import {
  AttachFile,
  Send,
  CheckBox,
  CheckBoxOutlineBlank,
  Close,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { TiptapEditor } from "../../../common/components/ui/TiptapEditor/TiptapEditor";
import { useGetClientsQuery } from "../../../store/api/adminApi";
import { useCreateAnnouncementMutation } from "../../../store/api/dashboardApi";
import { useSelector } from "react-redux";
import {
  colors,
  primaryIconButton,
  quickBroadcastCard,
  selectMenuProps,
} from "../../../common/styles/styles";
import { SelectMenuItem } from "../../../common/components/ui/SelectMenuItem/SelectMenuItem";
import { priorityOptions } from "./options";
import { AlertInline } from "../../../common/components/ui/AlertInline";
import { extractApiError } from "../../../common/utils/apiHelpers";
import { useNotification } from "../../../common/hooks";
import { LoadingProgress } from "../../../common/components/ui/LoadingProgress";
import { logger } from "../../../common/utils/logger";

export const QuickBroadcastView = () => {
  const { t } = useTranslation();
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [selectedClients, setSelectedClients] = useState([]);
  const [priority, setPriority] = useState("medium");
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);

  // Notification hook
  const { notificationRef, showSuccess, showError } = useNotification();

  // Get clients from API
  const { data: clients = [], isLoading: loadingClients } =
    useGetClientsQuery();

  // Create announcement mutation
  const [createAnnouncement, { isLoading: creatingAnnouncement }] =
    useCreateAnnouncementMutation();

  // Get current user permissions
  const { permissions, token: authToken } = useSelector((state) => state.auth);
  const isBPOAdmin = permissions.includes("admin_clients");

  // Handle select change
  const handleSelectChange = (event) => {
    const value = event.target.value;

    // Check if "Select All" was clicked
    if (value.includes("all")) {
      if (selectedClients.length === clients.length) {
        // If all are selected, deselect all
        setSelectedClients([]);
      } else {
        // Otherwise, select all
        setSelectedClients(clients.map((c) => c.id));
      }
    } else {
      setSelectedClients(value);
    }
  };

  // Handle file attachment
  const handleAttachFile = (event) => {
    const files = Array.from(event.target.files);
    setAttachments((prev) => [...prev, ...files]);
  };

  // Handle remove attachment
  const handleRemoveAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle submit
  const handleSubmit = async () => {
    // Validation
    if (!subject.trim()) {
      showError(t("quickBroadcast.emptySubject"));
      return;
    }

    const textContent = content.replace(/<[^>]*>/g, "").trim();
    if (!textContent) {
      showError(t("quickBroadcast.emptyMessage"));
      return;
    }

    if (selectedClients.length === 0) {
      showError(t("quickBroadcast.noClientsSelected"));
      return;
    }

    setSending(true);

    try {
      // Call API to create announcement (without attachments field)
      const result = await createAnnouncement({
        title: subject.trim(),
        content,
        priority,
        clientIds: selectedClients,
      }).unwrap();

      // Upload attachments if any
      if (attachments.length > 0 && result.data?.id) {
        const token = authToken;

        for (const file of attachments) {
          const formData = new FormData();
          formData.append("file", file);

          try {
            await fetch(
              `${import.meta.env.VITE_API_URL}/dashboard/announcements/${
                result.data.id
              }/attachments`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                body: formData,
              },
            );
          } catch (uploadErr) {
            logger.error("Error uploading attachment:", uploadErr);
            // Continue with other files even if one fails
          }
        }
      }

      showSuccess(t("quickBroadcast.success"));
      setSubject("");
      setContent("");
      setSelectedClients([]);
      setPriority("medium");
      setAttachments([]);
    } catch (err) {
      logger.error("Error creating announcement:", err);
      showError(extractApiError(err, t("quickBroadcast.error")));
    } finally {
      setSending(false);
    }
  };

  // Attach file button component
  const attachFileButton = (
    <IconButton
      size="small"
      component="label"
      sx={{
        padding: "4px",
        minWidth: "28px",
        minHeight: "28px",
      }}
    >
      <AttachFile fontSize="small" />
      <input
        type="file"
        hidden
        multiple
        onChange={handleAttachFile}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
      />
    </IconButton>
  );

  return (
    <Card
      sx={{
        ...quickBroadcastCard,
        //minWidth: { xs: "100%", md: "400px" },
      }}
    >
      <CardContent sx={{ padding: "1.5rem" }}>
        {/* Subject Field */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label={t("quickBroadcast.subject")}
            placeholder={t("quickBroadcast.subjectPlaceholder")}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            sx={{
              "& .MuiInputLabel-root.Mui-focused": {
                color: colors.primary,
              },
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                borderRadius: "0.75rem",
                fontSize: "0.875rem",
                "& fieldset": {
                  borderColor: colors.border,
                },
                "&:hover fieldset": {
                  borderColor: colors.primary,
                },
                "&.Mui-focused fieldset": {
                  borderColor: colors.primary,
                },
              },
            }}
          />
        </Box>

        {/* Editor with modern styling */}
        <Box
          sx={{
            mb: 2,
            "& .tiptap": {
              backgroundColor: colors.background,
              borderRadius: "0.75rem",
              border: "none",
              height: { xs: "44vh", md: "25vh" },
              padding: "1rem",
              fontSize: "0.875rem",
              "&:focus": {
                outline: "none",
                boxShadow: `0 0 0 2px ${colors.primaryLight}`,
              },
            },
          }}
        >
          <TiptapEditor
            value={content}
            onChange={(html) => setContent(html)}
            placeholder={t("quickBroadcast.placeholder")}
            customLeftButtons={[attachFileButton]}
          />
        </Box>

        {/* Attachments list with chips */}
        {attachments.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mb: 1, display: "block" }}
            >
              {attachments.length} {t("quickBroadcast.filesAttached")}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {attachments.map((file, index) => (
                <Chip
                  key={index}
                  label={file.name}
                  onDelete={() => handleRemoveAttachment(index)}
                  deleteIcon={<Close />}
                  size="small"
                  sx={{
                    maxWidth: "200px",
                    "& .MuiChip-label": {
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    },
                  }}
                  icon={<AttachFile sx={{ fontSize: "1rem" }} />}
                />
              ))}
            </Box>
          </Box>
        )}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "center" },
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
            }}
          >
            {/* Client Selection - Only for BPO Admin */}
            {isBPOAdmin && (
              <Box sx={{ minWidth: "140px" }}>
                {loadingClients ? (
                  <LoadingProgress size={16} />
                ) : (
                  <FormControl size="small" fullWidth>
                    <InputLabel
                      id="clients-select-label"
                      sx={quickBroadcastCard.compactSelector.inputLabelSection}
                    >
                      {t("quickBroadcast.selectClients")}
                    </InputLabel>
                    <Select
                      labelId="clients-select-label"
                      id="clients-select"
                      multiple
                      value={selectedClients}
                      onChange={handleSelectChange}
                      MenuProps={selectMenuProps}
                      input={
                        <OutlinedInput
                          label={t("quickBroadcast.selectClients")}
                        />
                      }
                      renderValue={(selected) => (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                          {selected.length === clients.length ? (
                            <Chip
                              label={t("quickBroadcast.selectAll")}
                              size="small"
                              color="primary"
                              sx={quickBroadcastCard.compactSelector.chip}
                            />
                          ) : selected.length > 0 ? (
                            <Chip
                              label={`${selected.length} ${
                                t("quickBroadcast.clientsSelected") ||
                                "selected"
                              }`}
                              size="small"
                              sx={quickBroadcastCard.qcompactSelector.chip}
                            />
                          ) : null}
                        </Box>
                      )}
                      sx={quickBroadcastCard.compactSelector.selectSection}
                    >
                      {/* Select All Option */}
                      <MenuItem value="all" sx={quickBroadcastCard.compactSelector.menuItem}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          {selectedClients.length === clients.length ? (
                            <CheckBox
                              color="primary"
                              sx={{ fontSize: "1rem", color: colors.primary }}
                            />
                          ) : (
                            <CheckBoxOutlineBlank sx={{ fontSize: "1rem" }} />
                          )}
                          <Typography fontSize="0.75rem" fontWeight="bold">
                            {t("quickBroadcast.selectAll")}
                          </Typography>
                        </Box>
                      </MenuItem>

                      {/* Individual Client Options */}
                      {clients.map((client) => (
                        <MenuItem
                          key={client.id}
                          value={client.id}
                          sx={quickBroadcastCard.compactSelector.menuItem}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            {selectedClients.includes(client.id) ? (
                              <CheckBox
                                color="primary"
                                sx={{ fontSize: "1rem", color: colors.primary }}
                              />
                            ) : (
                              <CheckBoxOutlineBlank sx={{ fontSize: "1rem" }} />
                            )}
                            <Typography fontSize="0.75rem">
                              {client.name}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            )}
            {/* Priority Selection */}
            <Box sx={{ minWidth: "120px" }}>
              <SelectMenuItem
                name="priority"
                label="quickBroadcast.priority"
                options={priorityOptions}
                value={priority}
                onChange={setPriority}
                size="small"
                showDot={true}
                sx={quickBroadcastCard.compactSelector.selectSection}
                inputLabelSx={quickBroadcastCard.compactSelector.inputLabelSection}
                menuItemSx={quickBroadcastCard.compactSelector.menuItem}
              />
            </Box>
          </Box>

          {/* Submit Button */}
          <Button
            variant="contained"
            startIcon={
              sending ? (
                <LoadingProgress size={16} />
              ) : (
                <Send sx={{ fontSize: "1rem" }} />
              )
            }
            onClick={handleSubmit}
            disabled={sending || loadingClients || creatingAnnouncement}
            sx={{
              ...primaryIconButton,
              height: "36px",
              width: { xs: "auto", md: "auto" },
              boxShadow: `0 4px 12px ${colors.primaryLight}`,
              fontSize: "0.75rem",
              fontWeight: "bold",
              px: 2,
              mx: { xs: 3, lg: 0 },
              "&:hover": {
                boxShadow: `0 6px 16px ${colors.primaryLight}`,
              },
            }}
          >
            {t("quickBroadcast.sendAnnouncement")}
          </Button>
        </Box>
      </CardContent>

      {/* Success/Error Snackbar */}
      <AlertInline ref={notificationRef} asSnackbar />
    </Card>
  );
};
