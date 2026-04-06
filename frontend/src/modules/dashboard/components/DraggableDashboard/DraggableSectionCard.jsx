import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Box } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { colors } from "../../../../common/styles/styles";

/**
 * DraggableSectionCard - Sortable wrapper for dashboard sections
 *
 * In edit mode: shows drag handle, dashed border, hover effects
 * In view mode: transparent wrapper with no visual changes
 */
export const DraggableSectionCard = ({
  id,
  editMode,
  gridColumn,
  children,
  sx: sxProp,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 200ms ease",
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        gridColumn: gridColumn || undefined,
        position: "relative",
        borderRadius: "1.5rem",
        transition: "border-color 200ms ease, box-shadow 200ms ease",
        ...(editMode && {
          border: `2px dashed ${colors.border}`,
          p: "0.5rem",
          cursor: "grab",
          "&:hover": {
            borderColor: colors.primary,
            boxShadow: `0 0 0 1px ${colors.primary}20`,
          },
        }),
        ...(isDragging && {
          boxShadow: "0 12px 28px rgba(0,0,0,0.15)",
          opacity: 0.85,
          zIndex: 100,
          cursor: "grabbing",
        }),
        ...sxProp,
      }}
      {...attributes}
      {...listeners}
    >
      {/* Drag handle indicator */}
      {editMode && (
        <Box
          sx={{
            position: "absolute",
            top: "0.35rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            color: isDragging ? colors.primary : colors.textSecondary,
            cursor: "grab",
            p: "2px 8px",
            borderRadius: "0.5rem",
            backgroundColor: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            transition: "color 200ms, background-color 200ms",
            "&:hover": {
              color: colors.primary,
              backgroundColor: colors.primaryLight,
            },
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: 18 }} />
        </Box>
      )}
      {children}
    </Box>
  );
};
