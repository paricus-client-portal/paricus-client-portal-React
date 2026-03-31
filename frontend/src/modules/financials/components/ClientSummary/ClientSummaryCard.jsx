import React from "react";
import PropTypes from "prop-types";
import { Box, Card, CardContent } from "@mui/material";
import { summaryCard, colors, spacing } from "../../../../common/styles/styles";
import { AppText } from "../../../../common/components/ui/AppText";

export const ClientSummaryCard = ({ payload, formatCurrency }) => {
  return (
    <Box
      sx={{
        display: "flex",
        mb: 3,
        gap: spacing.md / 8, // gap-6 (24px converted to MUI units)
        width: "100%",
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      {payload.map((item, index) => {
        return (
          <Box flex={1} key={index}>
            <Card
              sx={{
                ...summaryCard,
                height: "100%",
                borderLeft: `4px solid ${item.borderCol}`, // 4px left border for status
                bgcolor: colors.surface,
              }}
            >
              <CardContent sx={{ padding: "1rem 0 0 1rem" }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    mb: 1,
                  }}
                >
                  <AppText variant="smallBold" color="muted">
                    {item.label}
                  </AppText>
                </Box>
                <AppText variant="h2" sx={{ mb: 0.5 }}>
                  {item.label !== "Active Clients" && item.label !== "Total Invoices"
                    ? formatCurrency(item.overallStatsInfo.tp1)
                    : item.overallStatsInfo.tp1}
                </AppText>
                <AppText variant="small" color="muted">
                  {item.overallStatsInfo.tp2} {item.invoiceState}
                </AppText>
              </CardContent>
            </Card>
          </Box>
        );
      })}
    </Box>
  );
};

ClientSummaryCard.propTypes = {
  payload: PropTypes.arrayOf(
    PropTypes.shape({
      borderCol: PropTypes.string.isRequired,
      cardColor: PropTypes.string.isRequired,
      textColor: PropTypes.string,
      label: PropTypes.string.isRequired,
      invoiceState: PropTypes.string.isRequired,
      overallStatsInfo: PropTypes.shape({
        tp1: PropTypes.number.isRequired,
        tp2: PropTypes.number.isRequired,
      }).isRequired,
      icon: PropTypes.shape({
        icon: PropTypes.node.isRequired,
        color: PropTypes.string.isRequired,
      }),
    }),
  ).isRequired,
  formatCurrency: PropTypes.func.isRequired,
};

export default ClientSummaryCard;
