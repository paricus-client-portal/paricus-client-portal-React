import { ItemMenu } from "./ItemMenu";
import { AccordionMenuItem } from "./AccordionMenuItem";
import {
  Divider,
  ListItem,
  ListItemIcon,
  MenuItem,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { SingOutButton } from "./SingOutButton";
import { colors } from "../../../styles/styles";
import { menuItemsAdmin, menuItemsAvatar, menuItemsCommon } from "../../../../config/menu/MenusSection";


export const MenuSections = ({
  setTitleState,
  titleState,
  open,
  filteredCommonItems = menuItemsCommon,
  filteredAdminItems = menuItemsAdmin
}) => {
  const isMobileDrawer = open === undefined;

  return (
    <>
      {filteredCommonItems.map((item) =>
        isMobileDrawer && item.subItems ? (
          <AccordionMenuItem
            key={item.route || item.label}
            label={item.label}
            icon={item.icon}
            subItems={item.subItems}
            setTitleState={setTitleState}
            titleState={titleState}
          />
        ) : (
          <ListItem key={item.route || item.label} disablePadding sx={{ display: "block" }}>
            <ItemMenu
              label={item.label}
              icon={item.icon}
              route={item.route}
              setTitleState={setTitleState}
              titleState={titleState}
              open={open}
            />
          </ListItem>
        )
      )}

      {filteredAdminItems.length > 0 && (
        <Divider
          sx={{
            width: "60%",
            height: 3.5,
            bgcolor: colors.border,
            alignSelf: "center",
            borderRadius: 2,
            mx: "auto",
            mb: 0,
          }}
        />
      )}

      {filteredAdminItems.map((item) =>
        isMobileDrawer && item.subItems ? (
          <AccordionMenuItem
            key={item.route || item.label}
            label={item.label}
            icon={item.icon}
            subItems={item.subItems}
            setTitleState={setTitleState}
            titleState={titleState}
          />
        ) : (
          <ListItem key={item.route || item.label} disablePadding sx={{ display: "block" }}>
            <ItemMenu
              label={item.label}
              icon={item.icon}
              route={item.route}
              setTitleState={setTitleState}
              titleState={titleState}
              open={open}
            />
          </ListItem>
        )
      )}
    </>
  );
};

export const MenuSectionsAvatar = ({
  handleCloseUserMenu,
  userAuth,
  setTitleState,
  filteredAvatarItems = menuItemsAvatar
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleMenuOption = (route) => {
    navigate(`/app/${route}`);
  };

  return (
    <>
      <MenuItem
        onClick={handleCloseUserMenu}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <Typography sx={{ textAlign: "justify", fontWeight: "bold" }}>
          {`${userAuth?.firstName || ""} ${userAuth?.lastName || ""}`}
        </Typography>

        <Typography
          variant="body2"
          sx={{ textAlign: "justify", color: "text.secondary" }}
        >
          {userAuth?.email || ""}
        </Typography>
      </MenuItem>

      <Divider />
      {filteredAvatarItems.map((setting, index) => (
        <MenuItem
          key={index}
          onClick={() => {
            setTitleState(setting.label);
            handleMenuOption(setting.route);
            handleCloseUserMenu();
          }}
        >
          <ListItemIcon>{setting.icon}</ListItemIcon>
          <Typography sx={{ textAlign: "center", color: "text.secondary" }}>
            {t(`navigation.${setting.label}`)}
          </Typography>
        </MenuItem>
      ))}
      <SingOutButton />
    </>
  );
};
