import { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { AlertInline } from "../../../../common/components/ui/AlertInline";
import { MobileFilterPanel } from "../../../../common/components/ui/MobileFilterPanel";
import { QuickFiltersMobile } from "../QuickFilters";
import { TableView } from "../TableView";
import { FilterButton } from "../FilterButton";
import { AudioPlayerBar } from "../AudioPlayerBar";
import { useAudioRecordings } from "../../hooks/useAudioRecordings";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { formatDateTime } from "../../../../common/utils/formatDateTime";
import { companies } from "../AdvancedFilters/company.js";

/**
 * AudioRecordingsContent - Main content component for audio recordings
 * Combines data fetching, filtering, and audio playback
 */
export const AudioRecordingsContent = () => {
  const { t } = useTranslation();
  const permissions = useSelector((state) => state.auth?.permissions);
  const isBPOAdmin = permissions?.includes("admin_audio_recordings") ?? false;

  // Data and filters
  const {
    recordings,
    totalCount,
    callTypes,
    loading,
    error,
    setError,
    dbConfigured,
    isDebouncing,
    isOpen,
    setIsOpen,
    filters,
    setFilters,
    setLoadCallTypes,
    page,
    setPage,
    itemsPerPage,
    setItemsPerPage,
    refetch,
    clearFilters,
    setCompanyFilter,
    setAudioFilter,
  } = useAudioRecordings();

  // Audio player
  const {
    audioPlayer,
    currentlyPlaying,
    loadingAudioUrl,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackSpeed,
    progressPercentage,
    currentRecording,
    toggleAudio,
    stopAudio,
    togglePlayPause,
    seekAudio,
    rewind,
    forward,
    toggleMute,
    handleVolumeChange,
    cyclePlaybackSpeed,
    downloadAudio,
    handlePrefetchAudio,
    updateProgress,
    handleMetadataLoaded,
    handleAudioEnded,
    handleAudioError,
    formatTime,
  } = useAudioPlayer(recordings);

  // Mobile filter config
  const mobileFilterConfig = useMemo(() => {
    const cfg = [];
    if (isBPOAdmin) {
      cfg.push({
        key: "company",
        label: t("audioRecordings.table.company"),
        type: "select",
        value: filters.company || "",
        options: companies.map((c) => ({ label: c.name, value: c.name })),
      });
    }
    cfg.push(
      {
        key: "interactionId",
        label: t("audioRecordings.table.interactionId"),
        type: "text",
        value: filters.interactionId,
      },
      {
        key: "callType",
        label: t("audioRecordings.table.callType"),
        type: "select",
        value: filters.callType,
        options: callTypes.map((ct) => ({ label: ct, value: ct })),
      },
      {
        key: "startDate",
        label: t("audioRecordings.table.startTime"),
        type: "date",
        value: filters.startDate,
      },
      {
        key: "endDate",
        label: t("audioRecordings.table.endTime"),
        type: "date",
        value: filters.endDate,
      },
      {
        key: "customerPhone",
        label: t("audioRecordings.table.customerPhone"),
        type: "text",
        value: filters.customerPhone,
      },
      {
        key: "agentName",
        label: t("audioRecordings.table.agentName"),
        type: "text",
        value: filters.agentName,
      },
    );
    return cfg;
  }, [t, filters, callTypes, isBPOAdmin]);

  const handleMobileFilterChange = (key, value) => {
    if (key === "company") {
      setCompanyFilter(value || null);
    } else {
      setFilters((prev) => ({ ...prev, [key]: value }));
    }
  };

  // Wrap toggleAudio to handle errors
  const handleToggleAudio = async (item) => {
    try {
      await toggleAudio(item);
    } catch (err) {
      setError("Failed to load audio file. Please try again.");
    }
  };

  // Wrap downloadAudio to handle errors
  const handleDownloadAudio = async (item) => {
    try {
      await downloadAudio(item);
    } catch (err) {
      setError("Failed to download audio file. Please try again.");
    }
  };

  return (
    <>
      {/* Database Connection Warning */}
      {!dbConfigured && (
        <AlertInline severity="warning" sx={{ mb: 3 }} icon={<WarningIcon />}>
          <Typography variant="subtitle2" fontWeight="bold">
            {t("audioRecordings.databaseNotConfigured")}
          </Typography>
          <Typography variant="body2">
            {t("audioRecordings.databaseNotConfiguredMessage")}
          </Typography>
        </AlertInline>
      )}

      {/* Error Alert */}
      {error && (
        <AlertInline
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => setError(null)}
          icon={<ErrorIcon />}
          message={error}
        />
      )}

      {/* Filter Button - Desktop only */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: 1,
          marginRight: 2,
        }}
      >
        <FilterButton
          folderName="audioRecordings.filters"
          isOpen={isOpen}
          setIsOpen={setIsOpen}
        />
      </Box>

      {/* Audio Recordings Table - Desktop */}
      <TableView
        dataViewInfo={recordings}
        formatDateTime={formatDateTime}
        loading={loading}
        toggleAudio={handleToggleAudio}
        downloadAudio={handleDownloadAudio}
        currentlyPlaying={currentlyPlaying}
        loadingAudioUrl={loadingAudioUrl}
        handlePrefetchAudio={handlePrefetchAudio}
        page={page}
        itemsPerPage={itemsPerPage}
        totalCount={totalCount}
        onPageChange={setPage}
        onPageSizeChange={setItemsPerPage}
        filters={filters}
        refetch={refetch}
        setFilters={setFilters}
        setLoadCallTypes={setLoadCallTypes}
        isDebouncing={isDebouncing}
        clearFilters={clearFilters}
        callTypes={callTypes}
        setCompanyFilter={setCompanyFilter}
        setAudioFilter={setAudioFilter}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />

      {/* Mobile-Friendly Collapsible Table */}
      <QuickFiltersMobile
        dataViewInfo={recordings}
        formatDateTime={formatDateTime}
        toggleAudio={handleToggleAudio}
        downloadAudio={handleDownloadAudio}
        currentlyPlaying={currentlyPlaying}
        loadingAudioUrl={loadingAudioUrl}
        handlePrefetchAudio={handlePrefetchAudio}
        filters={filters}
        setFilters={setFilters}
        refetch={refetch}
        setLoadCallTypes={setLoadCallTypes}
        isDebouncing={isDebouncing}
        loading={loading}
        clearFilters={clearFilters}
        callTypes={callTypes}
        page={page}
        itemsPerPage={itemsPerPage}
        totalCount={totalCount}
        onPageChange={setPage}
        onPageSizeChange={setItemsPerPage}
        headerActions={
          <FilterButton
            folderName="audioRecordings.filters"
            isOpen={isOpen}
            setIsOpen={setIsOpen}
          />
        }
        subHeader={
          <MobileFilterPanel
            isOpen={isOpen}
            filters={mobileFilterConfig}
            onFilterChange={handleMobileFilterChange}
            onSearch={refetch}
            onClear={clearFilters}
            loading={loading}
            isDebouncing={isDebouncing}
          />
        }
      />

      {/* Audio Player Control Bar (Fixed Bottom) */}
      <AudioPlayerBar
        currentlyPlaying={currentlyPlaying}
        currentRecording={currentRecording}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        playbackSpeed={playbackSpeed}
        progressPercentage={progressPercentage}
        audioPlayer={audioPlayer}
        stopAudio={stopAudio}
        togglePlayPause={togglePlayPause}
        seekAudio={seekAudio}
        rewind={rewind}
        forward={forward}
        toggleMute={toggleMute}
        handleVolumeChange={handleVolumeChange}
        cyclePlaybackSpeed={cyclePlaybackSpeed}
        updateProgress={updateProgress}
        handleMetadataLoaded={handleMetadataLoaded}
        handleAudioEnded={handleAudioEnded}
        handleAudioError={handleAudioError}
        formatTime={formatTime}
      />
    </>
  );
};
