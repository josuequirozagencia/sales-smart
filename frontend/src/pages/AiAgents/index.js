import React, { useContext, useEffect, useState } from "react";
import {
  Button,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { DeleteOutline, Edit } from "@material-ui/icons";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import ConfirmationModal from "../../components/ConfirmationModal";
import ForbiddenPage from "../../components/ForbiddenPage";
import AiAgentModal from "../../components/AiAgentModal";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

// Agentes IA de la empresa. La API es de administrador, como Prompts IA y
// Meta: quien no lo sea ve la pantalla de sin permiso en vez de una lista
// vacia con errores.

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  canal: { marginRight: theme.spacing(0.5) },
  apagado: { color: theme.palette.text.secondary },
}));

const AiAgents = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [agentes, setAgentes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  const esAdmin = user.profile === "admin";

  const cargar = async () => {
    setCargando(true);
    try {
      const { data } = await api.get("/ai-agents");
      setAgentes(data);
    } catch (err) {
      toastError(err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (esAdmin) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin]);

  const cerrarModal = (guardado) => {
    setModalAbierto(false);
    setSeleccionado(null);
    if (guardado) cargar();
  };

  const borrar = async (agente) => {
    try {
      await api.delete(`/ai-agents/${agente.id}`);
      toast.success(i18n.t("aiAgents.toasts.deleted"));
      cargar();
    } catch (err) {
      toastError(err);
    }
    setSeleccionado(null);
    setConfirmarAbierto(false);
  };

  if (!esAdmin) return <ForbiddenPage />;

  return (
    <MainContainer>
      <ConfirmationModal
        title={seleccionado && `${i18n.t("aiAgents.confirmationModal.deleteTitle")} ${seleccionado.name}?`}
        open={confirmarAbierto}
        onClose={() => {
          setConfirmarAbierto(false);
          setSeleccionado(null);
        }}
        onConfirm={() => borrar(seleccionado)}
      >
        {i18n.t("aiAgents.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <AiAgentModal open={modalAbierto} onClose={cerrarModal} agentId={seleccionado?.id} />

      <MainHeader>
        <Title>{i18n.t("aiAgents.title")}</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setSeleccionado(null);
              setModalAbierto(true);
            }}
          >
            {i18n.t("aiAgents.buttons.add")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="left">{i18n.t("aiAgents.table.name")}</TableCell>
              <TableCell align="left">{i18n.t("aiAgents.table.model")}</TableCell>
              <TableCell align="left">{i18n.t("aiAgents.table.channels")}</TableCell>
              <TableCell align="left">{i18n.t("aiAgents.table.status")}</TableCell>
              <TableCell align="center">{i18n.t("aiAgents.table.actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {agentes.map((agente) => (
              <TableRow key={agente.id}>
                <TableCell align="left">{agente.name}</TableCell>
                <TableCell align="left">
                  {agente.provider} · {agente.model}
                </TableCell>
                <TableCell align="left">
                  {agente.channels?.length ? (
                    agente.channels.map((canal) => (
                      <Chip
                        key={canal.whatsappId}
                        size="small"
                        label={canal.name}
                        className={classes.canal}
                      />
                    ))
                  ) : (
                    <Typography variant="caption" className={classes.apagado}>
                      {i18n.t("aiAgents.table.noChannels")}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="left">
                  {i18n.t(agente.isActive ? "aiAgents.table.active" : "aiAgents.table.inactive")}
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSeleccionado(agente);
                      setModalAbierto(true);
                    }}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSeleccionado(agente);
                      setConfirmarAbierto(true);
                    }}
                  >
                    <DeleteOutline />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {cargando && <TableRowSkeleton columns={5} />}
            {!cargando && agentes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" className={classes.apagado}>
                    {i18n.t("aiAgents.table.empty")}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default AiAgents;
