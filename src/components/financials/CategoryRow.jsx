import React from "react";
import styled from "@emotion/styled";
import { withTheme } from "@emotion/react";
import Chart from "react-apexcharts";

import { Grid, Card as MuiCard, CardContent, Typography, Box } from "@mui/material";
import { spacing } from "@mui/system";
import { formatCurrency } from "@/utils/mockFinancialData";

const Card = styled(MuiCard)(spacing);

const ChartWrapper = styled.div`
  height: 150px;
  width: 100%;
`;

const ValueContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

const CategoryRow = ({ theme, name, data, currentMonthValue, color, monthLabels }) => {
  const series = [
    {
      name: name,
      data: data,
    },
  ];

  const options = {
    chart: {
      zoom: {
        enabled: false,
      },
      toolbar: {
        show: false,
      },
      sparkline: {
        enabled: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      width: 2,
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
        style: {
          fontSize: '10px',
        },
      },
    },
    yaxis: {
      labels: {
        formatter: function (val) {
          return "$" + val.toFixed(0);
        },
        style: {
          fontSize: '10px',
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
      padding: {
        top: 0,
        right: 10,
        bottom: 0,
        left: 0,
      },
    },
    colors: [color || theme.palette.primary.main],
  };

  // Add title to chart options
  const optionsWithTitle = {
    ...options,
    title: {
      text: name,
      align: 'left',
      style: {
        fontSize: '18px',
        fontWeight: 600,
        color: theme.palette.text.primary
      }
    }
  };

  return (
    <Grid container spacing={3} mb={3}>
      {/* Chart Section - 9/12 (75%) on desktop */}
      <Grid size={{ xs: 12, md: 9 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent sx={{ height: '100%' }}>
            <ChartWrapper>
              <Chart options={optionsWithTitle} series={series} type="line" height="150" />
            </ChartWrapper>
          </CardContent>
        </Card>
      </Grid>

      {/* Current Value Section - 3/12 (25%) on desktop */}
      <Grid size={{ xs: 12, md: 3 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ValueContainer>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                gutterBottom
                align="center"
              >
                Current Month
              </Typography>
              <Typography 
                variant="h3" 
                align="center"
                sx={{ 
                  fontWeight: 600,
                  color: color || theme.palette.primary.main 
                }}
              >
                {formatCurrency(currentMonthValue)}
              </Typography>
            </ValueContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default withTheme(CategoryRow);
