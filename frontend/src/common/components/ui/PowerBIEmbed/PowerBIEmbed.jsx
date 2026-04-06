import { useEffect, useRef, useState, useCallback } from "react";
import { Box, CircularProgress, IconButton, Tooltip, Typography } from "@mui/material";
import { PictureAsPdf as PdfIcon } from "@mui/icons-material";
import { useGetEmbedTokenQuery } from "../../../../store/api/powerbiApi";
import * as pbi from "powerbi-client";

// Print styles - hide everything except the Power BI embed
const PRINT_STYLE_ID = "powerbi-print-style";
const injectPrintStyles = () => {
  if (document.getElementById(PRINT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media print {
      /* Hide everything */
      body * { visibility: hidden !important; }
      /* Show only the embed container and its children */
      .powerbi-print-target,
      .powerbi-print-target * {
        visibility: visible !important;
      }
      .powerbi-print-target {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 99999 !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .powerbi-print-target iframe {
        width: 100vw !important;
        height: 100vh !important;
      }
      /* Remove any margins/padding from body */
      @page { margin: 0; }
      body { margin: 0 !important; padding: 0 !important; }
    }
  `;
  document.head.appendChild(style);
};

export const PowerBIEmbed = ({ groupId, reportId, height = "calc(100vh - 220px)" }) => {
  const embedRef = useRef(null);
  const reportRef = useRef(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const {
    data: embedData,
    isLoading,
    error: apiError,
  } = useGetEmbedTokenQuery(
    { groupId, reportId },
    {
      skip: !groupId || !reportId,
      pollingInterval: 55 * 60 * 1000,
    }
  );

  useEffect(() => {
    injectPrintStyles();
  }, []);

  useEffect(() => {
    if (!embedData || !embedRef.current) return;

    try {
      const { embedToken, embedUrl, reportId: rId } = embedData;

      const config = {
        type: "report",
        tokenType: pbi.models.TokenType.Embed,
        accessToken: embedToken,
        embedUrl: embedUrl,
        id: rId,
        settings: {
          panes: {
            filters: { visible: false },
            pageNavigation: { visible: true, position: pbi.models.PageNavigationPosition.Left },
          },
          background: pbi.models.BackgroundType.Transparent,
          layoutType: pbi.models.LayoutType.Custom,
          customLayout: {
            displayOption: pbi.models.DisplayOption.FitToWidth,
          },
          bars: {
            statusBar: { visible: false },
          },
        },
      };

      const powerbiService = new pbi.service.Service(
        pbi.factories.hpmFactory,
        pbi.factories.wpmpFactory,
        pbi.factories.routerFactory
      );

      powerbiService.reset(embedRef.current);
      const report = powerbiService.embed(embedRef.current, config);
      reportRef.current = report;

      report.on("error", (event) => {
        setError(event.detail?.message || "Error loading report");
      });
    } catch (err) {
      setError(err.message);
    }

    return () => {
      if (reportRef.current) {
        reportRef.current.off("error");
      }
    };
  }, [embedData]);

  const handleExportPdf = useCallback(() => {
    if (!embedRef.current) return;
    setExporting(true);
    // Add print class to the embed container, then print
    embedRef.current.classList.add("powerbi-print-target");
    setTimeout(() => {
      window.print();
      // Remove class after print dialog closes
      setTimeout(() => {
        embedRef.current?.classList.remove("powerbi-print-target");
        setExporting(false);
      }, 500);
    }, 100);
  }, []);

  if (!groupId || !reportId) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">
          Power BI report not configured
        </Typography>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height }}>
        <CircularProgress sx={{ color: "#16A34A" }} />
      </Box>
    );
  }

  if (apiError || error) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="error">
          {error || apiError?.data?.error || "Failed to load Power BI report"}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: "relative" }}>
      <Tooltip title="Export as PDF">
        <IconButton
          onClick={handleExportPdf}
          disabled={exporting}
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 10,
            bgcolor: "rgba(255,255,255,0.9)",
            boxShadow: 1,
            "&:hover": { bgcolor: "white" },
          }}
          size="small"
        >
          <PdfIcon sx={{ color: "#16A34A", fontSize: 20 }} />
        </IconButton>
      </Tooltip>
      <Box
        ref={embedRef}
        sx={{
          height,
          width: "100%",
          border: "none",
          borderRadius: 0,
          overflow: "hidden",
          "& iframe": {
            border: "none !important",
            borderRadius: 0,
          },
        }}
      />
    </Box>
  );
};
