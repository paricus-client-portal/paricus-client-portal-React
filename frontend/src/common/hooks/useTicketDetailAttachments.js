import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useUploadDetailAttachmentMutation,
  useDeleteDetailAttachmentMutation,
  useLazyGetDetailAttachmentUrlQuery,
} from "../../store/api/ticketsApi";
import { logger } from "../utils/logger";
import { extractApiError } from "../utils/apiHelpers";

/**
 * Hook for managing ticket detail attachments
 * @param {string} ticketId - The ticket ID
 * @param {string} detailId - The detail ID
 * @param {Object} options - Optional configuration
 * @param {Function} options.onError - Callback for error notifications (receives message string)
 * @param {Function} options.onSuccess - Callback for success notifications (receives message string)
 */
export const useTicketDetailAttachments = (ticketId, detailId, options = {}) => {
  const { onError, onSuccess } = options;
  const { t } = useTranslation();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);

  const [uploadAttachment, { isLoading: isUploading }] =
    useUploadDetailAttachmentMutation();
  const [deleteAttachment, { isLoading: isDeleting }] =
    useDeleteDetailAttachmentMutation();
  const [getAttachmentUrl] = useLazyGetDetailAttachmentUrlQuery();

  // Helper to show error notification
  const showError = (message) => {
    if (onError) {
      onError(message);
    } else {
      logger.error(message);
    }
  };

  // Helper to show success notification
  const showSuccess = (message) => {
    if (onSuccess) {
      onSuccess(message);
    }
  };

  // Calculate total size of selected files
  const getTotalSelectedSize = () => {
    return selectedFiles.reduce((total, file) => total + file.size, 0);
  };

  // For collecting files before detail is created
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type - now includes PDFs and Office documents
    const allowedTypes = [
      // Images
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      // PDFs
      "application/pdf",
      // Word documents
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      // Excel spreadsheets
      "application/vnd.ms-excel", // .xls
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      // PowerPoint presentations
      "application/vnd.ms-powerpoint", // .ppt
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    ];

    if (!allowedTypes.includes(file.type)) {
      showError(
        t("tickets.attachments.invalidFileType") ||
        "Only images, PDFs, and Office documents (Word, Excel, PowerPoint) are allowed"
      );
      return;
    }

    // Validate total size (5MB max for all files combined)
    const MAX_TOTAL_SIZE = 5 * 1024 * 1024; // 5MB
    const currentTotalSize = getTotalSelectedSize();
    const newTotalSize = currentTotalSize + file.size;

    if (newTotalSize > MAX_TOTAL_SIZE) {
      const remainingMB = ((MAX_TOTAL_SIZE - currentTotalSize) / (1024 * 1024)).toFixed(2);
      showError(
        t("tickets.attachments.totalSizeExceeded", { remaining: remainingMB }) ||
        `Total attachment size cannot exceed 5MB. You have ${remainingMB}MB remaining.`
      );
      return;
    }

    // Add to selected files list
    setSelectedFiles((prev) => [...prev, file]);

    // Reset input
    event.target.value = "";
  };

  // Upload all selected files after detail is created
  const uploadAllFiles = async (detailIdParam) => {
    const targetDetailId = detailIdParam || detailId;
    if (!ticketId || !targetDetailId || selectedFiles.length === 0) {
      return;
    }

    const uploadPromises = selectedFiles.map((file) => {
      return uploadAttachment({
        ticketId,
        detailId: targetDetailId,
        file,
      }).unwrap();
    });

    try {
      await Promise.all(uploadPromises);
      setSelectedFiles([]); // Clear after successful upload
      showSuccess(t("tickets.attachments.uploadSuccess") || "Files uploaded successfully");
    } catch (error) {
      logger.error(`useTicketDetailAttachments uploadAllFiles: ${error}`);
      throw error;
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setSelectedFiles([]);
  };

  const handleDelete = async (attachmentId) => {
    if (!confirm(t("tickets.attachments.confirmDelete") || "Are you sure you want to delete this file?")) return;

    try {
      await deleteAttachment({
        ticketId,
        detailId,
        attachmentId,
      }).unwrap();
      showSuccess(t("tickets.attachments.deleteSuccess") || "File deleted successfully");
    } catch (error) {
      logger.error("Error deleting file:", error);
      showError(t("tickets.attachments.deleteFailed") || "Failed to delete file");
    }
  };

  const handleImageClick = async (attachment) => {
    try {
      const response = await getAttachmentUrl({
        ticketId,
        detailId,
        attachmentId: attachment.id,
      }).unwrap();

      // The response is the URL string (transformed by RTK Query)
      let url = response;

      if (!url) {
        throw new Error('No URL returned from server');
      }

      // If it's a relative URL, convert to absolute
      if (url.startsWith('/api/')) {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const path = url.slice(4); // remove "/api" prefix since apiUrl already ends with /api
        url = `${apiUrl}${path}`;
      }

      setImageUrl(url);
      setSelectedImage(attachment);
      setOpenDialog(true);
    } catch (error) {
      logger.error(`useTicketDetailAttachments handleImageClick: ${error}`);
      showError(extractApiError(error, "Failed to load file"));
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedImage(null);
    setImageUrl(null);
  };

  return {
    selectedFiles,
    isUploading,
    isDeleting,
    selectedImage,
    imageUrl,
    openDialog,
    handleFileSelect,
    uploadAllFiles,
    removeFile,
    clearFiles,
    handleDelete,
    handleImageClick,
    handleCloseDialog,
  };
};
