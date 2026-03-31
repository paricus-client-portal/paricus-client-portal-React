import { useEffect, useState } from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { colors, titlesTypography } from "../../../../common/styles/styles";
import { Typography } from "@mui/material";

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

export const NavBarOptions = ({ setTitleState }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.auth.user);

  // Check permissions
  const hasClientsPermission = authUser?.permissions?.includes("admin_clients");
  const hasUsersPermission = authUser?.permissions?.includes("admin_users");
  const hasRolesPermission = authUser?.permissions?.includes("admin_roles");
  // BPO Admin can access logs - check by permission
  const isBPOAdmin = hasClientsPermission;


  const [value, setValue] = useState(0);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  // Build tabs array based on permissions
  const availableTabs = [];
  if (hasClientsPermission) {
    availableTabs.push({ route: 'clients', title: 'clientManagement' });
  }
  if (hasUsersPermission) {
    availableTabs.push({ route: 'users', title: 'usersManagement' });
  }
  if (hasRolesPermission) {
    availableTabs.push({ route: 'rolesPermissions', title: 'roleManagement' });
  }
  if (isBPOAdmin) {
    availableTabs.push({ route: 'logs', title: 'logsManagement' });
  }


  useEffect(() => {
    if (availableTabs.length > 0 && value < availableTabs.length) {
      const selectedTab = availableTabs[value];
      navigate(`/app/users-management/${selectedTab.route}`);
      if (setTitleState) setTitleState(selectedTab.title);
    }
  }, [value, navigate, setTitleState]);

  // Map of tab configurations
  const tabConfig = {
    clients: { label: t("userManagement.clients.title") },
    users: { label: t("userManagement.users.title") },
    rolesPermissions: { label: t("userManagement.rolesPermissions.title") },
    logs: { label: t("userManagement.logs.title") },
  };

  return (
    <>
      <Box sx={{ borderBottom: 0, display: { xs: "none", md: "contents" } }}>
        <Tabs
          value={value}
          onChange={handleChange}
          sx={{
            "& .MuiTab-root": {
              color: "#1a7e22ff 0%",
            },
            "& .Mui-selected": {
              color: `black !important`,
            },
            "& .MuiTabs-indicator": {
              backgroundColor: `${colors.primary}`,
            },
          }}
        >
          {availableTabs.map((tab, index) => (
            <Tab
              key={tab.route}
              label={
                <Typography sx={titlesTypography.managementSection}>
                  {tabConfig[tab.route].label}
                </Typography>
              }
              {...a11yProps(index)}
            />
          ))}
        </Tabs>
      </Box>
    </>
  );
};

export default NavBarOptions;
