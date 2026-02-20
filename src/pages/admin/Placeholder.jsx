import React from "react";
import { Typography, Box } from "@mui/material";
import { Construction } from "lucide-react";

function Placeholder({ title }) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="40vh"
      gap={2}
    >
      <Construction size={48} strokeWidth={1.5} color="#aaa" />
      <Typography variant="h4" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="body2" color="text.disabled">
        This page is under construction.
      </Typography>
    </Box>
  );
}

export default Placeholder;
