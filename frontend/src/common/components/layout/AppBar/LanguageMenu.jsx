import { useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import { Tooltip, Typography } from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";
import { colors } from "../../../styles/styles";
import { logger } from "../../../utils/logger";

export default function LanguageMenu() {
  const { i18n, t } = useTranslation();
  // Language options
  const options = [
    { code: "en", label: t("language.en"), flag: "/flags/en.png" },
    { code: "es", label: t("language.es"), flag: "/flags/es.png" },
  ];
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(
    options.findIndex((opt) => opt.code === i18n.language) || 0
  );

  const open = Boolean(anchorEl);

  const handleClickListItem = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = (event, index) => {
    try {
      const selectedLang = options[index].code;
      setSelectedIndex(index);
      i18n.changeLanguage(selectedLang);
      localStorage.setItem("lang", selectedLang);
      setAnchorEl(null);
    } catch (err) {
      logger.error(`ERROR handleMenuItemClick: ${err}`);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
      }}
    >
      <IconButton
        disableRipple
        id="language-button"
        aria-haspopup="listbox"
        aria-controls="language-menu"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClickListItem}
        size="large"
        sx={{
          color: "text.secondary",
          "&:hover": {
            backgroundColor: "transparent",
          },
        }}
      >
        <LanguageIcon />
        <Typography
          sx={{
            display: { xs: "none", md: "flex" },
            ml: 1,
            fontWeight: "bold",
          }}
        >
          {options[selectedIndex]?.code.toUpperCase()}
        </Typography>
      </IconButton>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "0.7rem",
            },
          },
          list: {
            "aria-labelledby": "language-button",
            role: "listbox",
          },
        }}
      >
        {options.map((option, index) => (
          <Tooltip
            key={option.code}
            title={option.label}
            placement="left"
            arrow
          >
            <MenuItem
              selected={index === selectedIndex}
              label={option.label}
              onClick={(event) => handleMenuItemClick(event, index)}
              disableRipple
              sx={{
                "&:hover": {
                  backgroundColor: "transparent",
                },
                "&.Mui-selected": {
                  backgroundColor: "transparent",
                  "&:hover": {
                    backgroundColor: "transparent",
                  },
                },
              }}
            >
              <Box display="flex" alignItems="center" gap={1}>
                <Avatar
                  sx={{
                    width: 26,
                    height: 26,
                    bgcolor:
                      index === selectedIndex ? colors.drowerIcons : "grey.300",
                    color: index === selectedIndex ? "black" : "grey.500",
                    fontSize: "0.7rem",
                    fontWeight: "bold",
                  }}
                >
                  {option.code.toUpperCase()}
                </Avatar>
              </Box>
            </MenuItem>
          </Tooltip>
        ))}
      </Menu>
    </Box>
  );
}
