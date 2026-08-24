import React, { memo, useCallback, useState } from "react";

import {
  Button,
  Grid,
  Paper,
  TextField,
} from "@material-ui/core";

import Title from "./Title";
import { i18n } from "../../translate/i18n";

const Filters = memo(({
  classes,
  setDateStartTicket,
  setDateEndTicket,
  dateStartTicket,
  dateEndTicket,
  setQueueTicket,
  queueTicket,
  fetchData,
}) => {
  const [dateStart, setDateStart] = useState(dateStartTicket);
  const [dateEnd, setDateEnd] = useState(dateEndTicket);

  // Callbacks memoizados
  const handleDateStartChange = useCallback((e) => {
    setDateStart(e.target.value);
  }, []);

  const handleDateEndChange = useCallback((e) => {
    setDateEnd(e.target.value);
  }, []);

  const handleFilterClick = useCallback(() => {
    setQueueTicket(queueTicket);
    setDateStartTicket(dateStart);
    setDateEndTicket(dateEnd);
    fetchData(prev => !prev);
  }, [queueTicket, dateStart, dateEnd, setQueueTicket, setDateStartTicket, setDateEndTicket, fetchData]);

  return (
    <Grid item xs={12}>
      <Paper className={classes.customFixedHeightPaperLg} elevation={6}>
        <Title>{i18n.t("dashboard.filters")} </Title>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={5}>
            <TextField
              fullWidth
              name="dateStart"
              label={i18n.t("dashboard.date.initialDate")}
              InputLabelProps={{
                shrink: true,
              }}
              type="date"
              value={dateStart}
              onChange={handleDateStartChange}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={5}>
            <TextField
              fullWidth
              name="dateEnd"
              label={i18n.t("dashboard.date.finalDate")}
              InputLabelProps={{
                shrink: true,
              }}
              type="date"
              value={dateEnd}
              onChange={handleDateEndChange}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleFilterClick}
            >
              {i18n.t("dashboard.buttons.filter")}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Grid>
  );
});

export default Filters;