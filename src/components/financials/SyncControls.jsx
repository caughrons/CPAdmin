import React, { useState } from "react";
import styled from "@emotion/styled";
import {
  Button,
  CircularProgress,
  Alert,
  Box,
  Typography,
} from "@mui/material";
import { spacing } from "@mui/system";
import { Cloud, RefreshCw } from "lucide-react";
import {
  syncHistoricalClaudeSpend,
  syncCurrentMonth,
} from "@/services/financialsService";

const Container = styled(Box)(spacing);

const ButtonGroup = styled(Box)`
  display: flex;
  gap: ${(props) => props.theme.spacing(2)};
  margin-bottom: ${(props) => props.theme.spacing(2)};
`;

const SyncControls = ({ onSyncComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleHistoricalSync = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await syncHistoricalClaudeSpend();
      setSuccess(`Successfully synced 3 months of Claude spend data`);
      console.log("Historical sync result:", result);
      
      if (result.errors && result.errors.length > 0) {
        console.error("Sync errors:", result.errors);
      }

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err) {
      console.error("Historical sync error:", err);
      console.error("Error details:", JSON.stringify(err, null, 2));
      const errorMessage = err.message || err.code || "Failed to sync historical data";
      setError(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCurrentMonthSync = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await syncCurrentMonth();

      if (result.success) {
        setSuccess(
          `Current month data refreshed: $${result.data?.totalUsd?.toFixed(2) || "0.00"}`
        );

        if (onSyncComplete) {
          onSyncComplete();
        }
      } else {
        setError("Refresh failed. Please try again.");
      }
    } catch (err) {
      console.error("Current month sync error:", err);
      setError(err.message || "Failed to refresh current month data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container mb={4}>
      <Typography variant="h5" gutterBottom>
        Claude API Data Management
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Sync Claude CruisNews spend data from Anthropic API
      </Typography>

      <ButtonGroup mt={3}>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={20} /> : <Cloud />}
          onClick={handleHistoricalSync}
          disabled={loading}
        >
          Sync Historical Data (3 months)
        </Button>

        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={20} /> : <RefreshCw />}
          onClick={handleCurrentMonthSync}
          disabled={loading}
        >
          Refresh Current Month
        </Button>
      </ButtonGroup>

      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Container>
  );
};

export default SyncControls;
