import { Box, Button, Typography } from "@mui/material";
import {
  AddPhotoAlternate,
  Image,
  Save,
  InfoOutlined,
} from "@mui/icons-material";
import { SwiperView } from "../../../common/components/ui/Swiper";
import { useTranslation } from "react-i18next";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  colors,
  primaryIconButton,
  quickBroadcastCard,
  swiperControlStyles,
} from "../../../common/styles/styles";
import { SelectMenuItem } from "../../../common/components/ui/SelectMenuItem";
import {
  useGetCarouselImagesQuery,
  useSaveCarouselImagesMutation,
  useDeleteCarouselImageMutation,
} from "../../../store/api/carouselApi";
import { getAttachmentUrl } from "../../../common/utils/getAttachmentUrl";
import { useNotification } from "../../../common/hooks";
import { AlertInline } from "../../../common/components/ui/AlertInline";
import { extractApiError } from "../../../common/utils/apiHelpers";
import { DeleteButton } from "../../../common/components/ui/DeleteButton";
import { useGetClientsQuery } from "../../../store/api/adminApi";
import { LoadingProgress } from "../../../common/components/ui/LoadingProgress";

const MAX_IMAGES = 4;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const SwiperControl = () => {
  const { t } = useTranslation();
  const token = useSelector((state) => state.auth?.token);
  const permissions = useSelector((state) => state.auth?.permissions);
  const isBPOAdmin = permissions?.includes("admin_dashboard_config");

  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [newUploads, setNewUploads] = useState(Array(MAX_IMAGES).fill(null));
  const [clearedSlots, setClearedSlots] = useState([]);
  const fileInputRefs = useRef([]);

  // Fetch clients for selector (BPO Admin only)
  const { data: clients = [] } = useGetClientsQuery(undefined, {
    skip: !isBPOAdmin,
  });

  // Fetch saved carousel images
  const queryClientId =
    selectedClientIds.length === 1 ? selectedClientIds[0] : undefined;
  const { data: savedImages = [], refetch: refetchImages } =
    useGetCarouselImagesQuery(queryClientId, {
      skip: !isBPOAdmin && selectedClientIds.length > 1,
    });
  const [saveCarouselImages, { isLoading: saving }] =
    useSaveCarouselImagesMutation();
  const [deleteCarouselImage] = useDeleteCarouselImageMutation();
  const { notificationRef, showSuccess, showError } = useNotification();

  // Track blob URLs for cleanup
  const blobUrlsRef = useRef([]);
  useEffect(() => {
    newUploads.forEach((img) => {
      if (img?.previewUrl && !blobUrlsRef.current.includes(img.previewUrl)) {
        blobUrlsRef.current.push(img.previewUrl);
      }
    });
  }, [newUploads]);

  // Cleanup all blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Derive display images from RTK Query data + local state
  const displayImages = useMemo(() => {
    const result = Array(MAX_IMAGES).fill(null);

    // Place saved images (skip cleared slots)
    for (const img of savedImages) {
      const idx = img.slotIndex;
      if (
        idx >= 0 &&
        idx < MAX_IMAGES &&
        !result[idx] &&
        !clearedSlots.includes(idx)
      ) {
        result[idx] = {
          previewUrl: getAttachmentUrl(img, token),
          name: img.fileName,
          savedId: img.id,
        };
      }
    }

    // Overlay with new uploads (take priority)
    for (let i = 0; i < MAX_IMAGES; i++) {
      if (newUploads[i]) {
        result[i] = newUploads[i];
      }
    }

    return result;
  }, [savedImages, token, clearedSlots, newUploads]);

  const handleClientChange = useCallback((newIds) => {
    // Keep newUploads and clearedSlots — all preview changes persist
    setSelectedClientIds(newIds);
  }, []);

  const handleFileSelect = useCallback(
    (slotIndex) => (event) => {
      try {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!ACCEPTED_TYPES.includes(file.type)) {
          showError(t("swiperControl.invalidType"));
          return;
        }
        if (file.size > MAX_FILE_SIZE) {
          showError(t("swiperControl.fileTooLarge"));
          return;
        }

        const previewUrl = URL.createObjectURL(file);

        setNewUploads((prev) => {
          const updated = [...prev];
          if (updated[slotIndex]?.previewUrl) {
            URL.revokeObjectURL(updated[slotIndex].previewUrl);
          }
          updated[slotIndex] = { file, previewUrl, name: file.name };
          return updated;
        });

        // If this slot was cleared, remove it from clearedSlots (new upload replaces it)
        setClearedSlots((prev) => prev.filter((s) => s !== slotIndex));
      } catch {
        showError(t("swiperControl.saveError"));
      } finally {
        if (fileInputRefs.current[slotIndex]) {
          fileInputRefs.current[slotIndex].value = "";
        }
      }
    },
    [t, showError],
  );

  const handleRemoveImage = useCallback(
    (index) => {
      // If there's a new upload at this slot, remove just the upload
      if (newUploads[index]) {
        setNewUploads((prev) => {
          const updated = [...prev];
          if (updated[index]?.previewUrl) {
            URL.revokeObjectURL(updated[index].previewUrl);
          }
          updated[index] = null;
          return updated;
        });
        return;
      }

      // Mark slot as cleared (persists across client changes)
      setClearedSlots((prev) =>
        prev.includes(index) ? prev : [...prev, index],
      );
    },
    [newUploads],
  );

  const handleSubmit = async () => {
    const uploads = newUploads
      .map((img, index) => (img?.file ? { img, index } : null))
      .filter(Boolean);

    // Derive IDs to delete from current savedImages at cleared slots
    const idsToDelete = savedImages
      .filter((img) => clearedSlots.includes(img.slotIndex))
      .map((img) => img.id);

    if (uploads.length === 0 && idsToDelete.length === 0) {
      showError(t("swiperControl.noChanges"));
      return;
    }

    try {
      const errors = [];

      // Process deletions in parallel (allSettled so partial failures don't block uploads)
      if (idsToDelete.length > 0) {
        const deleteResults = await Promise.allSettled(
          idsToDelete.map((id) => deleteCarouselImage(id).unwrap()),
        );
        deleteResults
          .filter((r) => r.status === "rejected")
          .forEach((r) => errors.push(r.reason));
      }

      // Upload new images to each selected client in parallel
      if (uploads.length > 0) {
        const uploadResults = await Promise.allSettled(
          selectedClientIds.map((clientId) => {
            const formData = new FormData();
            for (const { img, index } of uploads) {
              formData.append("images", img.file);
              formData.append("slotIndices", index);
            }
            formData.append("clientId", clientId);
            return saveCarouselImages(formData).unwrap();
          }),
        );
        uploadResults
          .filter((r) => r.status === "rejected")
          .forEach((r) => errors.push(r.reason));
      }

      // Wait for RTK Query to refetch fresh data before clearing local state
      await refetchImages();

      // Reset local state after fresh data is loaded
      setClearedSlots([]);
      newUploads.forEach((img) => {
        if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
      setNewUploads(Array(MAX_IMAGES).fill(null));

      if (errors.length > 0) {
        showError(extractApiError(errors[0], t("swiperControl.saveError")));
      } else {
        showSuccess(t("swiperControl.saveSuccess"));
      }
    } catch (err) {
      showError(extractApiError(err, t("swiperControl.saveError")));
    }
  };

  const hasChanges = newUploads.some(Boolean) || clearedSlots.length > 0;

  return (
    <Box sx={{ ...swiperControlStyles }}>
      {/* Column 1: Slide buttons */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          mx: 2,
          gridRow: { xs: 2, md: "1 / 3" },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", md: "1fr" },
            gap: 1,
            justifyItems: "center",
            mt: { xs: "2rem", md: "0rem" },
          }}
        >
          {displayImages.map((img, index) => (
            <Box
              key={index}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                mb: 1,
              }}
            >
              <Button
                variant="outlined"
                component="label"
                size="small"
                disabled={saving}
                startIcon={img ? <Image /> : <AddPhotoAlternate />}
                sx={{
                  borderColor: img ? colors.primary : colors.border,
                  color: img ? colors.primary : colors.textSecondary,
                  borderRadius: "0.75rem",
                  textTransform: "none",
                  fontSize: "0.9rem",
                  minWidth: { xs: "7rem", md: "8rem" },
                  "&:hover": {
                    borderColor: colors.primary,
                    color: colors.primary,
                  },
                }}
              >
                {t("swiperControl.slide", { number: index + 1 })}
                <input
                  ref={(el) => (fileInputRefs.current[index] = el)}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  hidden
                  onChange={handleFileSelect(index)}
                />
              </Button>
              <DeleteButton
                handleDelete={() => handleRemoveImage(index)}
                itemName={t("swiperControl.slide", { number: index + 1 })}
                itemType="image"
                disabled={saving || !img}
                size="small"
              />
            </Box>
          ))}
        </Box>
      </Box>

      {/* Column 2: Hint + Swiper */}
      <Box
        sx={{
          gridRow: { xs: 1, md: 1 },
          gridColumn: { md: 2 },
          minWidth: 0,
        }}
      >
        {/* Recommended dimensions hint */}
        <Box
          sx={{ display: "flex", justifyContent: "center", gap: 0.5, mb: 0.5, px: 1 }}
        >
          <InfoOutlined
            sx={{ fontSize: "0.85rem", color: colors.warning }}
          />
          <Typography
            variant="caption"
            color="warning"
            sx={{ lineHeight: 1.3 }}
          >
            {t("swiperControl.recommendedSize")}
          </Typography>
        </Box>
        <Box sx={{ height: "32vh", overflow: "hidden" }}>
          <SwiperView images={displayImages} />
        </Box>
      </Box>
      {/* Column 2, Row 2: Select Client + Save */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: { xs: "space-between", md: "center" },
          padding: { xs: 2, md: "0" },
          gap: 2,
          gridRow: { xs: 3, md: 2 },
          gridColumn: { md: 2 },
          mt: 2,
        }}
      >
        {/* Client Selector - BPO Admin only */}
        {isBPOAdmin && (
          <Box sx={{ minWidth: "140px" }}>
            <SelectMenuItem
              name="carousel-client"
              label="swiperControl.selectClient"
              options={clients
                .filter((c) => c.id !== 1)
                .map((c) => ({ value: c.id, labelKey: c.name }))}
              value={selectedClientIds}
              onChange={handleClientChange}
              size="small"
              disabled={saving}
              multiple
              showCheck
              selectAllLabel="swiperControl.selectAll"
              chipSx={quickBroadcastCard.compactSelector.chip}
              sx={quickBroadcastCard.compactSelector.selectSection}
              inputLabelSx={
                quickBroadcastCard.compactSelector.inputLabelSection
              }
              menuItemSx={quickBroadcastCard.compactSelector.menuItem}
            />
          </Box>
        )}
        {/* Submit button */}
        <Button
          variant="contained"
          size="small"
          disabled={
            saving ||
            !hasChanges ||
            (isBPOAdmin && selectedClientIds.length === 0)
          }
          onClick={handleSubmit}
          startIcon={
            saving ? (
              <LoadingProgress size={14} />
            ) : (
              <Save sx={{ fontSize: "1rem" }} />
            )
          }
          sx={{
            ...primaryIconButton,
            height: "32px",
            fontSize: "0.75rem",
            fontWeight: "bold",
            borderRadius: "0.75rem",
            textTransform: "none",
            px: 2,
            boxShadow: `0 4px 12px ${colors.primaryLight}`,
            "&:hover": {
              boxShadow: `0 6px 16px ${colors.primaryLight}`,
            },
          }}
        >
          {saving ? t("swiperControl.saving") : t("swiperControl.save")}
        </Button>
      </Box>

      {/* Notification */}
      <AlertInline ref={notificationRef} asSnackbar />
    </Box>
  );
};
