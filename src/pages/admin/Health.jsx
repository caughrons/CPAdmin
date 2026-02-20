import React from "react";
import { Helmet } from "react-helmet-async";
import Placeholder from "./Placeholder";

function Health() {
  return (
    <React.Fragment>
      <Helmet title="Health" />
      <Placeholder title="Health" />
    </React.Fragment>
  );
}

export default Health;
