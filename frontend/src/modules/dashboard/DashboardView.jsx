import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Tabs, Tab, Typography } from "@mui/material";
import {
  Outlet,
  useNavigate,
  useLocation,
  useOutletContext,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  boxTypography,
  colors,
  titlesTypography,
} from "../../common/styles/styles";
import { DashboardHeader } from "./components/DashboardHeader/DashboardHeader";

function a11yProps(index) {
  return {
    id: `dashboard-tab-${index}`,
    "aria-controls": `dashboard-tabpanel-${index}`,
  };
}

const tabs = [
  { route: "kpi", label: "dashboardKpi" },
  { route: "swiper", label: "dashboardSwiper" },
  { route: "general-info", label: "dashboardGeneralInfo" },
];

/**
 * DashboardView - Main dashboard component with tab navigation
 * Follows the same pattern as QuickBroadcast
 */
export const DashboardView = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  let setTitleState;
  try {
    const context = useOutletContext();
    setTitleState = context?.setTitleState;
  } catch {
    // no context available
  }

  // State for client/user selection (shared across all tabs via Outlet context)
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Edit mode for drag-and-drop layout customization
  const [editMode, setEditMode] = useState(false);

  // Ref to hold reset function from child DashboardViewSelect
  const resetLayoutRef = useRef(null);
  const handleResetLayout = useCallback(() => {
    resetLayoutRef.current?.();
  }, []);

  const handleSelectionChange = ({ clientId, userId }) => {
    setSelectedClientId(clientId);
    setSelectedUserId(userId);
  };

  // Determine active tab from current URL
  const currentPath = location.pathname.split("/").pop();
  const initialTab = tabs.findIndex((tab) => tab.route === currentPath);
  const [activeTab, setActiveTab] = useState(initialTab >= 0 ? initialTab : 0);

  useEffect(() => {
    const selected = tabs[activeTab];
    navigate(`/app/dashboard/${selected.route}`, { replace: true });
    if (setTitleState) setTitleState(selected.label);
  }, [activeTab, navigate, setTitleState]);

  // Sync tab when URL changes externally (e.g. from mobile drawer)
  useEffect(() => {
    const path = location.pathname.split("/").pop();
    const idx = tabs.findIndex((tab) => tab.route === path);
    if (idx >= 0 && idx !== activeTab) {
      setActiveTab(idx);
    }
  }, [location.pathname]);

  const handleChange = (_, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={boxTypography.box}>
      {/* Page Header with Selector */}
      <DashboardHeader
        onSelectionChange={handleSelectionChange}
        editMode={editMode}
        setEditMode={setEditMode}
        onResetLayout={handleResetLayout}
      />
      {/* Tabs - hidden (mobile uses drawer, desktop shows all content) */}
      <Box sx={{ display: "none" }}>
        <Tabs
          value={activeTab}
          onChange={handleChange}
          sx={{
            "& .MuiTab-root": {
              color: "#1a7e22ff 0%",
            },
            "& .Mui-selected": {
              color: "black !important",
            },
            "& .MuiTabs-indicator": {
              backgroundColor: colors.primary,
            },
          }}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={tab.route}
              label={
                <Typography sx={titlesTypography.managementSection}>
                  {t(`navigation.${tab.label}`)}
                </Typography>
              }
              {...a11yProps(index)}
            />
          ))}
        </Tabs>
      </Box>

      {/* Content - rendered by nested routes */}
      <Box sx={{ overflow: "hidden" }}>
        <Outlet context={{ selectedClientId, selectedUserId, editMode, setEditMode, resetLayoutRef }} />
      </Box>
    </Box>
  );
};
