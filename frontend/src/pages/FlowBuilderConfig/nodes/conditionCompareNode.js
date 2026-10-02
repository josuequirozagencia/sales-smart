import React, { useState, useEffect } from "react";
import { i18n } from "../../../translate/i18n";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
  Typography,
  Divider,
  Box,
  CircularProgress,
} from "@material-ui/core";
import { CompareArrows } from "@mui/icons-material";

const operators = [
  "equals",
  "notEquals",
  "contains",
  "greaterThan",
  "lessThan",
  "greaterOrEqual",
  "lessOrEqual",
  "startsWith",
  "endsWith",
  "isEmpty",
  "isNotEmpty",
];

const FlowBuilderConditionCompareModal = ({
  open,
  onSave,
  data,
  onUpdate,
  close,
}) => {
  const [formData, setFormData] = useState({
    leftValue: "",
    operator: "equals",
    rightValue: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data) {
      setFormData({
        leftValue: data.leftValue || "",
        operator: data.operator || "equals",
        rightValue: data.rightValue || "",
      });
    } else {
      setFormData({
        leftValue: "",
        operator: "equals",
        rightValue: "",
      });
    }
  }, [data, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = () => {
    setLoading(true);
    try {
      const nodeData = {
        leftValue: formData.leftValue,
        operator: formData.operator,
        rightValue: formData.operator === "isEmpty" || formData.operator === "isNotEmpty" 
          ? "" 
          : formData.rightValue,
      };

      if (data && data.id) {
        // Modo edição
        onUpdate({
          ...data,
          data: {
            ...data.data,
            ...nodeData,
          },
        });
      } else {
        // Modo criação
        onSave(nodeData);
      }
    } catch (error) {
      console.error("Erro ao salvar comparação:", error);
    } finally {
      setLoading(false);
      close();
    }
  };

  return (
    <Dialog
      open={!!open}
      onClose={close}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CompareArrows />
          <Typography variant="h6">
            {data ? i18n.t("flows.compare.edit") : i18n.t("flows.compare.new")}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={i18n.t("flows.compare.value1")}
              name="leftValue"
              value={formData.leftValue}
              onChange={handleChange}
              variant="outlined"
              helperText={i18n.t("flows.compare.valueHelp")}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              select
              fullWidth
              label={i18n.t("flows.compare.operator")}
              name="operator"
              value={formData.operator}
              onChange={handleChange}
              variant="outlined"
            >
              {operators.map((option) => (
                <MenuItem key={option} value={option}>
                  {i18n.t("flows.compare.operators." + option)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          
          {(formData.operator !== "isEmpty" && formData.operator !== "isNotEmpty") && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={i18n.t("flows.compare.value2")}
                name="rightValue"
                value={formData.rightValue}
                onChange={handleChange}
                variant="outlined"
                helperText={i18n.t("flows.compare.valueHelp")}
              />
            </Grid>
          )}
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={close} color="secondary">
          {i18n.t("contactModal.buttons.cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          color="primary"
          variant="contained"
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : i18n.t("contactModal.buttons.okEdit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FlowBuilderConditionCompareModal;