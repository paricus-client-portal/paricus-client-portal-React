import { useState, useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ClientFolders } from "./components/ClientFolders";
import {
  useGetClientFoldersQuery,
  useLazyGetClientReportsQuery,
  useUploadReportMutation,
  useLazyDownloadReportQuery,
  useDeleteReportMutation,
  useGetClientsQuery,
  useGetFolderAccessQuery,
  useGrantFolderAccessMutation,
  useRevokeFolderAccessMutation,
} from "../../store/api/reportsApi";
import { useCreateLogMutation } from "../../store/api/logsApi";
import { useSelector } from "react-redux";
import { boxTypography } from "../../common/styles/styles";
import { HeaderBoxTypography } from "../../common/components/ui/HeaderBoxTypography/HeaderBoxTypography";
import { AlertInline } from "../../common/components/ui/AlertInline";
import { extractApiError } from "../../common/utils/apiHelpers";
import { useNotification } from "../../common/hooks";
import { PowerBIManagement } from "./components/PowerBIManagement";
import {
  formatDateTime as formatDateTimeUtil,
  formatFileSize as formatFileSizeUtil,
} from "../../common/utils/formatters";
import { logger } from "../../common/utils/logger";

export const ReportsManagementView = () => {
  const { t } = useTranslation();
  const authUser = useSelector((state) => state.auth.user);
  const [createLog] = useCreateLogMutation();
  const { notificationRef, showNotification } = useNotification();

  // RTK Query hooks
  const {
    data: clientFolders = [],
    isLoading: loading,
    refetch: refetchFolders,
  } = useGetClientFoldersQuery();

  // Use lazy query for reports - will be called when folders are expanded
  const [getReports, { data: reportsData, isLoading: loadingReports }] =
    useLazyGetClientReportsQuery();

  // Store reports by folder
  const [allReports, setAllReports] = useState({});
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);

  // Fetch reports for all folders when component mounts
  useEffect(() => {
    const fetchAllReports = async () => {
      if (clientFolders.length === 0) return;

      setIsLoadingInitial(true);

      try {
        // Fetch reports for all folders in parallel
        const promises = clientFolders.map(async (folder) => {
          try {
            const result = await getReports(folder).unwrap();
            return { folder, reports: result };
          } catch (error) {
            logger.error(`Failed to fetch reports for ${folder}:`, error);
            return { folder, reports: [] };
          }
        });

        const results = await Promise.all(promises);

        // Update state with all results
        const reportsMap = {};
        results.forEach(({ folder, reports }) => {
          reportsMap[folder] = reports;
        });

        setAllReports(reportsMap);
      } finally {
        setIsLoadingInitial(false);
      }
    };

    fetchAllReports();
  }, [clientFolders.length]); // Only re-run when number of folders changes

  // Function to fetch reports for a folder (for refresh after upload/delete)
  const fetchReportsForFolder = async (folder) => {
    try {
      const result = await getReports(folder).unwrap();
      setAllReports((prev) => ({ ...prev, [folder]: result }));
    } catch (error) {
      logger.error(`Failed to fetch reports for ${folder}:`, error);
      setAllReports((prev) => ({ ...prev, [folder]: [] }));
    }
  };

  const isLoadingAnyReports = loadingReports || isLoadingInitial;

  // Mutations
  const [uploadReport, { isLoading: uploading }] = useUploadReportMutation();
  const [downloadReportQuery] = useLazyDownloadReportQuery();
  const [deleteReportMutation] = useDeleteReportMutation();
  const [grantAccess, { isLoading: grantingAccess }] =
    useGrantFolderAccessMutation();
  const [revokeAccess] = useRevokeFolderAccessMutation();

  // Folder access management
  const [showFolderAccessModal, setShowFolderAccessModal] = useState(false);
  const { data: clients = [] } = useGetClientsQuery(undefined, {
    skip: !showFolderAccessModal,
  });
  const {
    data: folderAccess = [],
    isLoading: loadingAccess,
    refetch: refetchAccess,
  } = useGetFolderAccessQuery(undefined, { skip: !showFolderAccessModal });

  // State
  const [showUploadModal, setShowUploadModal] = useState(null); // Changed to store folder name
  const [accessForm, setAccessForm] = useState({
    clientId: "",
    folderName: "",
  });

  // Upload form
  const [uploadForm, setUploadForm] = useState({
    reportName: "",
    description: "",
    file: null,
  });

  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    try {
      if (event.target.files && event.target.files[0]) {
        setUploadForm({ ...uploadForm, file: event.target.files[0] });
      }
    } catch (err) {
      logger.error(`ERROR handleFileSelect: ${err}`);
    }
  };

  const handleUploadReport = async () => {
    if (!uploadForm.file || !showUploadModal) return;

    try {
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      if (uploadForm.reportName) {
        formData.append("reportName", uploadForm.reportName);
      }
      if (uploadForm.description) {
        formData.append("description", uploadForm.description);
      }

      await uploadReport({ folder: showUploadModal, formData }).unwrap();

      showNotification(t("reportsManagement.upload.uploadSuccess"), "success");
      setShowUploadModal(null);
      resetUploadForm();

      // Refetch reports for this folder
      await fetchReportsForFolder(showUploadModal);
    } catch (error) {
      showNotification(extractApiError(error, t("reportsManagement.upload.uploadError")), "error");
    }
  };

  const getReportUrl = async (folder, fileName) => {
    const response = await downloadReportQuery({ folder, fileName }).unwrap();
    if (response.downloadUrl) return response.downloadUrl;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
    return `${apiUrl}/reports/download/${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}`;
  };

  const handleViewReport = async (folder, report) => {
    try {
      const url = await getReportUrl(folder, report.name);
      window.open(url, "_blank");

      try {
        await createLog({
          userId: authUser.id.toString(),
          eventType: "VIEW",
          entity: "Report",
          description: `Viewed report ${report.name} from folder ${folder}`,
          status: "SUCCESS",
        }).unwrap();
      } catch (logErr) {
        logger.error("Error logging report view:", logErr);
      }
    } catch (error) {
      showNotification(extractApiError(error, t("reportsManagement.upload.downloadError")), "error");
    }
  };

  const handleDownloadReport = async (folder, report) => {
    try {
      const url = await getReportUrl(folder, report.name);

      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = report.name || "report.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      try {
        await createLog({
          userId: authUser.id.toString(),
          eventType: "DOWNLOAD",
          entity: "Report",
          description: `Downloaded report ${report.name} from folder ${folder}`,
          status: "SUCCESS",
        }).unwrap();
      } catch (logErr) {
        logger.error("Error logging report download:", logErr);
      }
    } catch (error) {
      showNotification(extractApiError(error, t("reportsManagement.upload.downloadError")), "error");
    }
  };

  const handleDeleteReport = async (report) => {
    try {
      // Key format: "client-access-reports/flex-mobile/bi-reports/filename.pdf"
      const parts = report.key.split("/");
      const folder = parts[1]; // flex-mobile
      const fileName = report.name;

      await deleteReportMutation({ folder, fileName }).unwrap();

      try {
        await createLog({
          userId: authUser.id.toString(),
          eventType: "DELETE",
          entity: "Report",
          description: `Deleted report ${fileName} from folder ${folder}`,
          status: "SUCCESS",
        }).unwrap();
      } catch (logErr) {
        logger.error("Error logging report deletion:", logErr);
      }

      await fetchReportsForFolder(folder);
      showNotification(t("reportsManagement.upload.deleteSuccess"), "success");
    } catch (error) {
      showNotification(extractApiError(error, t("reportsManagement.upload.deleteError")), "error");
    }
  };

  const resetUploadForm = () => {
    try {
      setUploadForm({
        reportName: "",
        description: "",
        file: null,
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      logger.error(`ERROR resetUploadForm: ${err}`);
    }
  };

  const locale = t("common.locale") || "en-US";
  const fileSizeLabels = [
    t("reportsManagement.fileSize.bytes"),
    t("reportsManagement.fileSize.kb"),
    t("reportsManagement.fileSize.mb"),
    t("reportsManagement.fileSize.gb"),
  ];
  const formatFileSize = (bytes) => formatFileSizeUtil(bytes, fileSizeLabels);
  const formatDate = (dateString) => formatDateTimeUtil(dateString, locale);


  // Folder access management functions
  // const handleGrantFolderAccess = async () => {
  //   if (!accessForm.clientId || !accessForm.folderName) return;

  //   try {
  //     await grantAccess({
  //       clientId: parseInt(accessForm.clientId),
  //       folderName: accessForm.folderName,
  //     }).unwrap();

  //     showNotification(
  //       "success",
  //       t("reportsManagement.folderAccess.grantSuccess"),
  //     );
  //     setAccessForm({ clientId: "", folderName: "" });
  //   } catch (error) {
  //     showNotification(
  //       "error",
  //       error.data?.message || t("reportsManagement.folderAccess.grantError"),
  //     );
  //   }
  // };

  // const handleRevokeFolderAccess = async (clientId, folderName) => {
  //   if (
  //     !window.confirm(
  //       t("reportsManagement.folderAccess.confirmRevoke", { folderName }),
  //     )
  //   )
  //     return;

  //   try {
  //     await revokeAccess({ clientId, folderName }).unwrap();
  //     showNotification(
  //       "success",
  //       t("reportsManagement.folderAccess.revokeSuccess"),
  //     );
  //   } catch (error) {
  //     showNotification(
  //       "error",
  //       error.data?.message || t("reportsManagement.folderAccess.revokeError"),
  //     );
  //   }
  // };

  const openFolderAccessModal = () => {
    try {
      setShowFolderAccessModal(true);
    } catch (err) {
      logger.error(`ERROR openFolderAccessModal: ${err}`);
    }
  };

  return (
    <Box sx={boxTypography.box}>
      {/* Page Header */}
      <HeaderBoxTypography text={t("reportsManagement.title")} />

      {/* Power BI Dashboard Management */}
      <Box sx={{ mb: 3 }}>
        <PowerBIManagement showNotification={showNotification} />
      </Box>

      {/* Client Folders Section with Expandable Reports */}
      <Box>
        <ClientFolders
          clientFolders={clientFolders}
          loading={loading}
          refetchFolders={refetchFolders}
          openFolderAccessModal={openFolderAccessModal}
          reports={allReports}
          loadingReports={isLoadingAnyReports}
          fetchReportsForFolder={fetchReportsForFolder}
          handleViewReport={handleViewReport}
          handleDownloadReport={handleDownloadReport}
          handleDeleteReport={handleDeleteReport}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
          showUploadModal={showUploadModal}
          setShowUploadModal={setShowUploadModal}
          uploadForm={uploadForm}
          setUploadForm={setUploadForm}
          handleFileSelect={handleFileSelect}
          handleUploadReport={handleUploadReport}
          uploading={uploading}
          fileInputRef={fileInputRef}
          selectedFolderForUpload={showUploadModal}
        />
      </Box>

      {/* Snackbar para notificaciones */}
      <AlertInline ref={notificationRef} asSnackbar />
    </Box>
  );
};


