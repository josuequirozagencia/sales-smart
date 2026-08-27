import React, { useState, useCallback } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
  },
  hint: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  totals: {
    fontWeight: "bold",
  },
  empty: {
    padding: theme.spacing(4),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
}));

// Segundos crus não se leem: 4380 não diz nada, "1h 13m" sim.
const formatDuration = seconds => {
  if (seconds === null || seconds === undefined) return "—";

  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;

  const minutes = Math.floor(total / 60);
  if (minutes < 60) {
    const rest = total % 60;
    return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours}h` : `${hours}h ${restMinutes}m`;
};

const daysAgo = days => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
};

const today = () => new Date().toISOString().split("T")[0];

const ResponseTime = () => {
  const classes = useStyles();

  const [initialDate, setInitialDate] = useState(daysAgo(7));
  const [finalDate, setFinalDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const loadReport = useCallback(async () => {
    if (initialDate > finalDate) {
      toast.warn("A data inicial não pode ser posterior à final.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get("/response-time", {
        params: { initialDate, finalDate },
      });
      setReport(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [initialDate, finalDate]);

  const rows = report?.rows || [];
  const totals = report?.totals;

  return (
    <MainContainer>
      <MainHeader>
        <Title>Tempo de resposta</Title>
        <MainHeaderButtonsWrapper>
          <div className={classes.filters}>
            <TextField
              label="De"
              type="date"
              value={initialDate}
              onChange={e => setInitialDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              variant="outlined"
              size="small"
            />
            <TextField
              label="Até"
              type="date"
              value={finalDate}
              onChange={e => setFinalDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              variant="outlined"
              size="small"
            />
            <Button
              variant="contained"
              color="primary"
              onClick={loadReport}
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : "Gerar"}
            </Button>
          </div>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Typography variant="body2" className={classes.hint}>
          Mede do primeiro recado do cliente até a primeira resposta de um
          atendente. Mensagens automáticas e notas internas não contam. A
          mediana resiste melhor a um caso esquecido do que a média: se alguém
          tem um ticket de três horas, a média dispara e a mediana continua
          mostrando o comportamento habitual.
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Atendente</TableCell>
              <TableCell align="center">Tickets</TableCell>
              <TableCell align="center">Respondidos</TableCell>
              <TableCell align="center">Média</TableCell>
              <TableCell align="center">Mediana</TableCell>
              <TableCell align="center">Pior caso</TableCell>
              <TableCell align="center">Espera até abrir</TableCell>
              <TableCell align="center">Duração</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && <TableRowSkeleton columns={8} />}

            {!loading &&
              rows.map(row => (
                <TableRow key={row.userId === null ? "sem-atendente" : row.userId}>
                  <TableCell>{row.userName}</TableCell>
                  <TableCell align="center">{row.tickets}</TableCell>
                  <TableCell align="center">{row.answeredTickets}</TableCell>
                  <TableCell align="center">
                    {formatDuration(row.avgFirstResponseSeconds)}
                  </TableCell>
                  <TableCell align="center">
                    {formatDuration(row.medianFirstResponseSeconds)}
                  </TableCell>
                  <TableCell align="center">
                    {formatDuration(row.maxFirstResponseSeconds)}
                  </TableCell>
                  <TableCell align="center">
                    {formatDuration(row.avgWaitSeconds)}
                  </TableCell>
                  <TableCell align="center">
                    {formatDuration(row.avgSupportSeconds)}
                  </TableCell>
                </TableRow>
              ))}

            {!loading && totals && rows.length > 0 && (
              <TableRow>
                <TableCell className={classes.totals}>Total</TableCell>
                <TableCell align="center" className={classes.totals}>
                  {totals.tickets}
                </TableCell>
                <TableCell align="center" className={classes.totals}>
                  {totals.answeredTickets}
                </TableCell>
                <TableCell align="center" className={classes.totals}>
                  {formatDuration(totals.avgFirstResponseSeconds)}
                </TableCell>
                <TableCell align="center" className={classes.totals}>
                  {formatDuration(totals.medianFirstResponseSeconds)}
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            )}
          </TableBody>
        </Table>

        {!loading && report && rows.length === 0 && (
          <div className={classes.empty}>
            Nenhum atendimento no período selecionado.
          </div>
        )}

        {!loading && !report && (
          <div className={classes.empty}>
            Escolha o período e clique em Gerar.
          </div>
        )}
      </Paper>
    </MainContainer>
  );
};

export default ResponseTime;
