import React from "react";
import styled from "@emotion/styled";
import { Helmet } from "react-helmet-async";

import { Button as MuiButton, Typography } from "@mui/material";
import { spacing } from "@mui/system";

import useAuth from "@/hooks/useAuth";

const Button = styled(MuiButton)(spacing);

const Wrapper = styled.div`
  text-align: center;
`;

function Page403() {
  const { signOut } = useAuth();

  return (
    <Wrapper>
      <Helmet title="403 Forbidden" />
      <Typography component="h1" variant="h1" align="center" gutterBottom>
        403
      </Typography>
      <Typography component="h2" variant="h4" align="center" gutterBottom>
        Access Denied
      </Typography>
      <Typography
        component="h2"
        variant="subtitle1"
        align="center"
        gutterBottom
      >
        Your account does not have admin privileges.
      </Typography>

      <Button
        onClick={signOut}
        variant="contained"
        color="secondary"
        mt={2}
      >
        Sign Out
      </Button>
    </Wrapper>
  );
}

export default Page403;
