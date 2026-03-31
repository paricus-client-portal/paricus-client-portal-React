import PropTypes from "prop-types";
import {
  Box,
  Card,
  CardContent,
  Typography,
} from "@mui/material";
import {
  summaryCard,
  colors,
  titlesTypography,
} from "../../../../common/styles/styles";
import { AppText } from "../../../../common/components/ui/AppText";
import { useTranslation } from "react-i18next";

/**
 * SummaryCardMobile - Smaller version of summary card for mobile
 */
const SummaryCardMobile = ({ item, formatCurrency }) => {
  return (
    <Card
      sx={{
        ...summaryCard,
        // height: 100,
        width: "100%",
        // minHeight: 100,
        // maxHeight: 100,
        borderLeft: `4px solid ${item.borderCol}`,
        borderRadius: "2.5rem",
        bgcolor: colors.surface,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CardContent
        sx={{
          padding: "0.25rem !important",
          textAlign: "center",
          width: "100%",
          overflow: "hidden",
        }}
      >
        <AppText
          variant="small"
          color="muted"
          sx={{
            fontSize: "0.8rem",
            fontWeight: 600,
            mb: 0.25,
            display: "block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.label}
        </AppText>
        <AppText
          variant="h3"
          sx={{
            mb: 0.25,
            fontSize: "1rem",
            fontWeight: 700,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
          }}
        >
          {item.label !== "Active Clients" && item.label !== "Total Invoices"
            ? formatCurrency(item.overallStatsInfo.tp1)
            : item.overallStatsInfo.tp1}
        </AppText>
        <AppText
          variant="small"
          color="muted"
          sx={{
            fontSize: "0.75rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.overallStatsInfo.tp2} {item.invoiceState}
        </AppText>
      </CardContent>
    </Card>
  );
};

SummaryCardMobile.propTypes = {
  item: PropTypes.shape({
    borderCol: PropTypes.string.isRequired,
    cardColor: PropTypes.string.isRequired,
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
  }).isRequired,
  formatCurrency: PropTypes.func.isRequired,
};

export const ClientSummaryMobile = ({
  loading,
  refetchAllClients,
  formatCurrency,
  payload,
}) => {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: { xs: "block", md: "none" },
        mt: 1,
        mb: 3,
        width: "100%",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          mb: 1.5,
        }}
      >
        <Typography
          variant="subtitle2"
          //fontWeight="600"
          sx={{ ...titlesTypography.mobilDataTableTableHeader, mb: 1 }}
        >
          {t("financials.clientSummary.title")}
        </Typography>
      </Box>

      {/* Cards Grid - 2 rows x 2 columns */}
      {payload.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1.5,
            width: "100%",
          }}
        >
          {payload.map((item, index) => (
            <SummaryCardMobile
              key={index}
              item={item}
              formatCurrency={formatCurrency}
            />
          ))}
        </Box>
      ) : (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            No data available
          </Typography>
        </Box>
      )}
    </Box>
  );
};

ClientSummaryMobile.propTypes = {
  loading: PropTypes.bool,
  refetchAllClients: PropTypes.func.isRequired,
  formatCurrency: PropTypes.func.isRequired,
  payload: PropTypes.arrayOf(
    PropTypes.shape({
      borderCol: PropTypes.string.isRequired,
      cardColor: PropTypes.string.isRequired,
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
};
