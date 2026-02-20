import React from "react";
import styled from "@emotion/styled";

import {
  Box,
  Card as MuiCard,
  CardContent as MuiCardContent,
  Chip as MuiChip,
  CircularProgress,
  Typography as MuiTypography,
} from "@mui/material";
import { spacing } from "@mui/system";

const Card = styled(MuiCard)`
  position: relative;
  height: 100%;
`;

const CardContent = styled(MuiCardContent)`
  position: relative;

  &:last-child {
    padding-bottom: ${(props) => props.theme.spacing(4)};
  }
`;

const Typography = styled(MuiTypography)(spacing);

const Chip = styled(MuiChip)`
  position: absolute;
  top: 16px;
  right: 16px;
  height: 20px;
  padding: 4px 0;
  font-size: 85%;
  background-color: ${(props) => props.theme.palette.secondary.main};
  color: ${(props) => props.theme.palette.common.white};

  span {
    padding-left: ${(props) => props.theme.spacing(2)};
    padding-right: ${(props) => props.theme.spacing(2)};
  }
`;

const StatCard = ({ title, value, chip, icon: Icon, loading, error }) => {
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={4}>
          {Icon && (
            <Box color="text.secondary" display="flex">
              <Icon size={18} />
            </Box>
          )}
          <Typography variant="h6" color="text.secondary">
            {title}
          </Typography>
        </Box>

        {loading ? (
          <Box display="flex" alignItems="center" height={40}>
            <CircularProgress size={24} />
          </Box>
        ) : value === null ? (
          <Typography variant="h5" color="text.disabled">
            —
          </Typography>
        ) : (
          <Typography variant="h3">
            <Box fontWeight="fontWeightRegular">
              {typeof value === "number" ? value.toLocaleString() : value}
            </Box>
          </Typography>
        )}

        {chip && <Chip label={chip} />}
      </CardContent>
    </Card>
  );
};

export default StatCard;
