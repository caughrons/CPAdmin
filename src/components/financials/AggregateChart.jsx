import React from "react";
import styled from "@emotion/styled";
import { withTheme } from "@emotion/react";
import Chart from "react-apexcharts";

import { Grid, Card as MuiCard, CardContent, Typography, Box, Divider as MuiDivider } from "@mui/material";
import { spacing } from "@mui/system";
import { formatCurrency } from "@/utils/mockFinancialData";

const Card = styled(MuiCard)(spacing);

const Divider = styled(MuiDivider)(spacing);

const ChartWrapper = styled.div`
  height: 280px;
  width: 100%;
`;

const SummaryContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  height: 100%;
  padding: ${(props) => props.theme.spacing(2)};
`;

const SummaryItem = styled(Box)`
  text-align: center;
  padding: ${(props) => props.theme.spacing(2, 0)};
`;

const AggregateChart = ({ theme, expenseData, revenueData, monthLabels }) => {
  // Calculate current month totals (last value in arrays)
  const currentMonthRevenue = revenueData[revenueData.length - 1];
  const currentMonthExpenses = expenseData[expenseData.length - 1];
  const currentMonthProfit = currentMonthRevenue - currentMonthExpenses;

  const series = [
    {
      name: "Total Expenses",
      data: expenseData,
    },
    {
      name: "Total Revenue",
      data: revenueData,
    },
  ];

  const options = {
    chart: {
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: true,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      width: 3,
      curve: "smooth",
    },
    markers: {
      size: 0,
    },
    xaxis: {
      categories: monthLabels,
      labels: {
        rotate: -45,
        rotateAlways: false,
      },
    },
    yaxis: {
      labels: {
        formatter: function (val) {
          return "$" + val.toFixed(0);
        },
      },
    },
    tooltip: {
      y: {
        formatter: function (val) {
          return formatCurrency(val);
        },
      },
    },
    grid: {
      borderColor: "#f1f1f1",
    },
    colors: [
      theme.palette.warning.main,
      theme.palette.success.main,
    ],
    legend: {
      position: "top",
      horizontalAlign: "right",
    },
  };

  return (
    <Grid container spacing={3} mb={6}>
      {/* Chart Section - 9/12 (75%) on desktop */}
      <Grid size={{ xs: 12, md: 9 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h5" gutterBottom>
              Revenue vs Expenses - Last 12 Months
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Aggregate comparison of total revenue and expenses over time
            </Typography>
            <ChartWrapper>
              <Chart options={options} series={series} type="line" height="280" />
            </ChartWrapper>
          </CardContent>
        </Card>
      </Grid>

      {/* Summary Section - 3/12 (25%) on desktop */}
      <Grid size={{ xs: 12, md: 3 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <SummaryContainer>
              <SummaryItem>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Current Month
                </Typography>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 600,
                    color: theme.palette.success.main 
                  }}
                >
                  {formatCurrency(currentMonthRevenue)}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                  Total Revenue
                </Typography>
              </SummaryItem>

              <Divider my={2} />

              <SummaryItem>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Current Month
                </Typography>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 600,
                    color: theme.palette.warning.main 
                  }}
                >
                  {formatCurrency(currentMonthExpenses)}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                  Total Expenses
                </Typography>
              </SummaryItem>

              <Divider my={2} />

              <SummaryItem>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Current Month
                </Typography>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 600,
                    color: currentMonthProfit >= 0 
                      ? theme.palette.success.main 
                      : theme.palette.error.main
                  }}
                >
                  {formatCurrency(currentMonthProfit)}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                  Profit/Loss
                </Typography>
              </SummaryItem>
            </SummaryContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default withTheme(AggregateChart);
