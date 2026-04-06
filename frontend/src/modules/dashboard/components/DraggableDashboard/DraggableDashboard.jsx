import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Box, Skeleton } from "@mui/material";
import { DraggableSectionCard } from "./DraggableSectionCard";

/**
 * DraggableDashboard - Core layout orchestrator with drag-and-drop
 *
 * Renders dashboard sections in a CSS Grid based on saved layout order.
 * In edit mode, sections are draggable and reorderable.
 *
 * @param {boolean} editMode - Whether drag-and-drop is active
 * @param {Array} layout - Array of { sectionId, width } objects
 * @param {function} onLayoutChange - Callback with new layout after drag
 * @param {Object} sections - Map of sectionId -> React element (null = hidden)
 * @param {string} mobileSection - Active mobile section route ("kpi", "swiper", "general-info")
 * @param {boolean} isLoading - Show skeleton loading state
 */
export const DraggableDashboard = ({
  editMode,
  layout,
  onLayoutChange,
  sections,
  mobileSection,
  isLoading,
}) => {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter layout to only include sections that are available (not null)
  const visibleLayout = layout.filter(
    (item) => sections[item.sectionId] !== null && sections[item.sectionId] !== undefined
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = layout.findIndex((item) => item.sectionId === active.id);
    const newIndex = layout.findIndex((item) => item.sectionId === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newLayout = arrayMove(layout, oldIndex, newIndex);
    onLayoutChange(newLayout);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 3,
        }}
      >
        <Skeleton
          variant="rounded"
          sx={{
            gridColumn: "1 / -1",
            height: 180,
            borderRadius: "1.5rem",
          }}
        />
        <Skeleton variant="rounded" sx={{ height: 220, borderRadius: "1.5rem" }} />
        <Skeleton variant="rounded" sx={{ height: 220, borderRadius: "1.5rem" }} />
        <Skeleton variant="rounded" sx={{ height: 220, borderRadius: "1.5rem" }} />
        <Skeleton variant="rounded" sx={{ height: 220, borderRadius: "1.5rem" }} />
      </Box>
    );
  }

  // Determine mobile visibility for each section
  const getMobileVisibility = (sectionId) => {
    if (!mobileSection) return true; // Desktop: show all
    switch (sectionId) {
      case "kpi_statistics":
        return mobileSection === "kpi";
      case "announcements":
      case "swiper":
        return mobileSection === "swiper";
      case "active_tasks":
      case "master_repository":
        return mobileSection === "general-info";
      default:
        return true;
    }
  };

  const activeItem = activeId
    ? visibleLayout.find((item) => item.sectionId === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={visibleLayout.map((item) => item.sectionId)}
        strategy={rectSortingStrategy}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
            gap: 3,
          }}
        >
          {visibleLayout.map((item) => {
            const isVisible = getMobileVisibility(item.sectionId);

            return (
              <DraggableSectionCard
                key={item.sectionId}
                id={item.sectionId}
                editMode={editMode}
                gridColumn={item.width === "full" ? "1 / -1" : undefined}
                sx={{
                  display: {
                    xs: isVisible ? "block" : "none",
                    md: "block",
                  },
                  // Match existing height constraints for specific sections
                  ...(item.sectionId === "announcements" ||
                  item.sectionId === "swiper"
                    ? { minHeight: { md: "32vh" }, maxHeight: { md: "32vh" } }
                    : {}),
                }}
              >
                {sections[item.sectionId]}
              </DraggableSectionCard>
            );
          })}
        </Box>
      </SortableContext>

      {/* Drag overlay for clean preview */}
      <DragOverlay>
        {activeItem ? (
          <Box
            sx={{
              borderRadius: "1.5rem",
              boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
              opacity: 0.92,
              transform: "scale(1.02)",
              backgroundColor: "white",
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            {sections[activeItem.sectionId]}
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
