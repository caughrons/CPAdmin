import React from "react";
import { Helmet } from "react-helmet-async";
import Placeholder from "../Placeholder";

function News() {
  return (
    <React.Fragment>
      <Helmet title="News" />
      <Placeholder title="News" />
    </React.Fragment>
  );
}

export default News;
