import React from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

import { TIME_RANGES } from "@/services/activityAdmin";

function TimeRangeSelect({ value, onChange }) {
  return (
    <FormControl size="small" sx={{ minWidth: 180 }}>
      <InputLabel id="time-range-label">Time range</InputLabel>
      <Select
        labelId="time-range-label"
        label="Time range"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {TIME_RANGES.map((r) => (
          <MenuItem key={r.key} value={r.key}>
            {r.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default TimeRangeSelect;
