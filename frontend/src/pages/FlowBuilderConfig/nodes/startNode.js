import { ArrowForwardIos, Message, RocketLaunch } from "@mui/icons-material";
import { i18n } from "../../../translate/i18n";
import React, { memo } from "react";

import { Handle } from "react-flow-renderer";

export default memo(({ data, isConnectable }) => {
  return (
    <div
      style={{
        backgroundColor: "#F9FDF9",
        padding: "8px",
        borderRadius: "8px",
        boxShadow: "rgba(0, 0, 0, 0.05) 0px 3px 5px",
        border: '1px solid rgba(58, 186, 56, 0.25)'
      }}
    >
      <div
        style={{
          color: "#ededed",
          fontSize: "16px",
          flexDirection: "row",
          display: "flex"
        }}
      >
        <RocketLaunch
          sx={{
            width: "16px",
            height: "16px",
            marginRight: "4px",
            marginTop: "4px",
            color: "#3aba38"
          }}
        />
        <div style={{ color: "#232323", fontSize: "16px" }}>
          {i18n.t("flows.flowStart")}
        </div>
      </div>
      <div style={{ color: "#727272", fontSize: "12px" }}>
        {i18n.t("flows.flowStartHelp")}
      </div>
      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          background: "#9a00ed",
          width: "18px",
          height: "18px",
          top: "70%",
          right: "-11px",
          cursor: 'pointer'
        }}
        isConnectable={isConnectable}
      >
        <ArrowForwardIos
          sx={{
            color: "#ffff",
            width: "10px",
            height: "10px",
            marginLeft: "2.9px",
            marginBottom: "1px",
            pointerEvents: 'none'
          }}
        />
      </Handle>
    </div>
  );
});
