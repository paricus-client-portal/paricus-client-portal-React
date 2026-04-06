export const SECTION_IDS = {
  KPI_STATISTICS: "kpi_statistics",
  ANNOUNCEMENTS: "announcements",
  SWIPER: "swiper",
  ACTIVE_TASKS: "active_tasks",
  MASTER_REPOSITORY: "master_repository",
};

export const DEFAULT_LAYOUT = [
  { sectionId: SECTION_IDS.KPI_STATISTICS, width: "full" },
  { sectionId: SECTION_IDS.ANNOUNCEMENTS, width: "half" },
  { sectionId: SECTION_IDS.SWIPER, width: "half" },
  { sectionId: SECTION_IDS.ACTIVE_TASKS, width: "half" },
  { sectionId: SECTION_IDS.MASTER_REPOSITORY, width: "half" },
];
