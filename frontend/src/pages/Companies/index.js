import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
// import { SocketContext } from "../../context/Socket/SocketContext";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import Chip from "@material-ui/core/Chip";
import MenuItem from "@material-ui/core/MenuItem";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";

import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import CompanyModal from "../../components/CompaniesModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";
import usePlans from "../../hooks/usePlans";
import moment from "moment";
import ColorModeContext from "../../layout/themeContext";

const reducer = (state, action) => {
  if (action.type === "LOAD_COMPANIES") {
    const companies = action.payload;
    const newCompanies = [];

    companies.forEach((company) => {
      const companyIndex = state.findIndex((u) => u.id === company.id);
      if (companyIndex !== -1) {
        state[companyIndex] = company;
      } else {
        newCompanies.push(company);
      }
    });

    return [...state, ...newCompanies];
  }

  if (action.type === "UPDATE_COMPANIES") {
    const company = action.payload;
    const companyIndex = state.findIndex((u) => u.id === company.id);

    if (companyIndex !== -1) {
      state[companyIndex] = company;
      return [...state];
    } else {
      return [company, ...state];
    }
  }

  if (action.type === "DELETE_COMPANIES") {
    const companyId = action.payload;

    const companyIndex = state.findIndex((u) => u.id === companyId);
    if (companyIndex !== -1) {
      state.splice(companyIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
}));

const Companies = () => {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [deletingCompany, setDeletingCompany] = useState(null);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [companies, dispatch] = useReducer(reducer, []);
  // Filtro por estado de la solicitud y dialogo del motivo de rechazo.
  const [filtroSolicitud, setFiltroSolicitud] = useState("todas");
  const [rechazando, setRechazando] = useState(null);
  const [motivo, setMotivo] = useState("");
  // Historial de la solicitud. Se pide solo al abrirlo: traerlo con cada
  // listado cargaria la pantalla con datos que casi nunca se miran.
  const [historialDe, setHistorialDe] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const { dateToClient, datetimeToClient } = useDate();

  // const { getPlanCompany } = usePlans();
  //   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);
  const { mode } = useContext(ColorModeContext);
  const theme = useTheme();

  useEffect(() => {
    async function fetchData() {
      if (!user.super) {
        toast.error(
          "Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando."
        );
        setTimeout(() => {
          history.push(`/`);
        }, 1000);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchCompanies = async () => {
        try {
          const { data } = await api.get("/companiesPlan/", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_COMPANIES", payload: data.companies });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchCompanies();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  const handleOpenCompanyModal = () => {
    setSelectedCompany(null);
    setCompanyModalOpen(true);
  };

  const handleCloseCompanyModal = () => {
    setSelectedCompany(null);
    setCompanyModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditCompany = (company) => {
    setSelectedCompany(company);
    setCompanyModalOpen(true);
  };

  const handleDeleteCompany = async (companyId) => {
    try {
      await api.delete(`/companies/${companyId}`);
      toast.success(i18n.t("compaies.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingCompany(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  // Color por estado. Se acompana SIEMPRE del texto en la etiqueta: quien
  // no distinga los tonos tiene que poder leer el estado igualmente.
  const estiloSolicitud = (estado) => {
    const t = theme.palette.tokens;
    switch (estado) {
      case "pending":
        return { backgroundColor: t.semantic.warning.soft, color: t.semantic.warning.text };
      case "rejected":
        return { backgroundColor: t.semantic.error.soft, color: t.semantic.error.text };
      case "suspended":
        return { backgroundColor: t.surface.surfaceSecondary, color: theme.palette.text.secondary };
      default:
        return { backgroundColor: t.semantic.success.soft, color: t.semantic.success.text };
    }
  };

  const revisar = async (company, status, razon) => {
    try {
      await api.put(`/companies/${company.id}/review`, { status, reason: razon });
      toast.success(i18n.t("compaies.approval.updated"));
      // Se fuerza la relectura: el efecto que carga la lista depende de
      // pageNumber, asi que reiniciar y volver a la primera pagina la
      // vuelve a pedir. Llamar a handleSearch no valdria: espera un evento.
      dispatch({ type: "RESET" });
      setPageNumber(1);
    } catch (err) {
      toastError(err);
    } finally {
      setRechazando(null);
      setMotivo("");
    }
  };

  const verHistorial = async (company) => {
    setHistorialDe(company);
    setHistorial([]);
    setCargandoHistorial(true);
    try {
      const { data } = await api.get(`/companies/${company.id}/audit`);
      setHistorial(data);
    } catch (err) {
      toastError(err);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const pedirMotivo = (company) => {
    setMotivo("");
    setRechazando(company);
  };

  // El filtro se aplica sobre lo ya cargado. La lista de empresas de una
  // instalacion es corta; pedir al servidor por cada cambio de filtro
  // seria un viaje sin ganancia.
  const empresasVisibles = companies.filter((c) => {
    if (filtroSolicitud === "todas") return true;
    return (c.approvalStatus || "approved") === filtroSolicitud;
  });

  const renderStatus = (row) => {
    return row.status === false ? "Não" : "Sim";
  };

  const renderPlanValue = (row) => {
    return row.planId !== null
      ? row.plan.amount
        ? row.plan.amount.toLocaleString("pt-br", { minimumFractionDigits: 2 })
        : "00.00"
      : "-";
  };

  const renderWhatsapp = (row) => {
    return row.useWhatsapp === false ? "Não" : "Sim";
  };

  const renderFacebook = (row) => {
    return row.useFacebook === false ? "Não" : "Sim";
  };

  const renderInstagram = (row) => {
    return row.useInstagram === false ? "Não" : "Sim";
  };

  const renderCampaigns = (row) => {
    return row.useCampaigns === false ? "Não" : "Sim";
  };

  const renderSchedules = (row) => {
    return row.useSchedules === false ? "Não" : "Sim";
  };

  const renderInternalChat = (row) => {
    return row.useInternalChat === false ? "Não" : "Sim";
  };

  const renderExternalApi = (row) => {
    return row.useExternalApi === false ? "Não" : "Sim";
  };

  const rowStyle = (record) => {
    if (moment(record.dueDate).isValid()) {
      const now = moment();
      const dueDate = moment(record.dueDate);
      const diff = dueDate.diff(now, "days");
      if (diff >= 1 && diff <= 5) {
        return { backgroundColor: "#fffead" };
      }
      if (diff <= 0) {
        return { backgroundColor: "#fa8c8c" };
      }
    }
    return {};
  };

  const cellStyle = (record) => {
    if (moment(record.dueDate).isValid()) {
      const now = moment();
      const dueDate = moment(record.dueDate);
      const diff = dueDate.diff(now, "days");
      if (diff >= 1 && diff <= 5) {
        return { color: "#000" };
      }
      if (diff <= 0) {
        return { color: "#fff" };
      }
    }
    return {};
  };

  const formatFolderSize = (size) => {
    if (!size || size === 0) return '0 Bytes';
    
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    let index = 0;
    let formattedSize = size;

    while (formattedSize >= 1024 && index < units.length - 1) {
        formattedSize /= 1024;
        index++;
    }

    return `${formattedSize.toFixed(2)} ${units[index]}`;
};

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingCompany &&
          `${i18n.t("compaies.confirmationModal.deleteTitle")} ${
            deletingCompany.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteCompany(deletingCompany.id)}
      >
        {i18n.t("compaies.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <CompanyModal
        open={companyModalOpen}
        onClose={handleCloseCompanyModal}
        aria-labelledby="form-dialog-title"
        companyId={selectedCompany && selectedCompany.id}
      />
      <MainHeader>
        <Title>
          {i18n.t("compaies.title")} ({empresasVisibles.length})
        </Title>
        <TextField
          select
          size="small"
          variant="outlined"
          style={{ minWidth: 180, marginLeft: 16 }}
          value={filtroSolicitud}
          onChange={(e) => setFiltroSolicitud(e.target.value)}
          label={i18n.t("compaies.approval.filter")}
        >
          {["todas", "pending", "approved", "rejected", "suspended"].map((v) => (
            <MenuItem key={v} value={v}>
              {i18n.t(`compaies.approval.${v}`)}
            </MenuItem>
          ))}
        </TextField>
        {/* <MainHeaderButtonsWrapper>
                    <TextField
                        placeholder={i18n.t("contacts.searchPlaceholder")}
                        type="search"
                        value={searchParam}
                        onChange={handleSearch}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon style={{ color: "gray" }} />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleOpenCompanyModal}
                    >
                        {i18n.t("compaies.buttons.add")}
                    </Button>
                </MainHeaderButtonsWrapper> */}
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">
                {i18n.t("compaies.table.ID")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("compaies.table.status")}
              </TableCell>
              {/* Estado de la SOLICITUD, distinto del campo status, que
                  dice si la empresa esta activa. Son dos cosas. */}
              <TableCell align="center">
                {i18n.t("compaies.table.approval")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("compaies.table.name")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("compaies.table.email")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("compaies.table.namePlan")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("compaies.table.value")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("compaies.table.createdAt")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("compaies.table.dueDate")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("compaies.table.lastLogin")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("compaies.table.folderSize")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("compaies.table.totalFiles")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("compaies.table.lastUpdate")}
              </TableCell>
              {/* <TableCell align="center">{i18n.t("compaies.table.numberAttendants")}</TableCell> */}
              {/* <TableCell align="center">{i18n.t("compaies.table.numberConections")}</TableCell> */}
              {/* <TableCell align="center">{i18n.t("compaies.table.numberQueues")}</TableCell> */}
              {/* <TableCell align="center">{i18n.t("compaies.table.useWhatsapp")}</TableCell> */}
              {/* <TableCell align="center">{i18n.t("compaies.table.useFacebook")}</TableCell> */}
              {/* <TableCell align="center">{i18n.t("compaies.table.useInstagram")}</TableCell> */}
              {/* <TableCell align="center">{i18n.t("compaies.table.useCampaigns")}</TableCell> */}
              {/* <TableCell align="center">{i18n.t("compaies.table.useExternalApi")}</TableCell> */}
              {/* <TableCell align="center">{i18n.t("compaies.table.useInternalChat")}</TableCell> */}
              {/* <TableCell align="center">{i18n.t("compaies.table.useSchedules")}</TableCell> */}
              {/* <TableCell align="center">{i18n.t("compaies.table.actions")}</TableCell> */}
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {empresasVisibles.map((company) => (
                <TableRow style={rowStyle(company)} key={company.id}>
                  <TableCell style={cellStyle(company)} align="center">{company.id}</TableCell>
                  <TableCell style={cellStyle(company)} align="center">
                    {renderStatus(company.status)}
                  </TableCell>
                  <TableCell style={cellStyle(company)} align="center">
                    <Chip
                      size="small"
                      label={i18n.t(`compaies.approval.${company.approvalStatus || "approved"}`)}
                      style={estiloSolicitud(company.approvalStatus)}
                    />
                    {/* Las acciones solo aparecen donde tienen sentido: no
                        se ofrece aprobar lo ya aprobado. */}
                    {company.approvalStatus === "pending" && (
                      <div style={{ marginTop: 4 }}>
                        <Button size="small" color="primary"
                          onClick={() => revisar(company, "approved")}>
                          {i18n.t("compaies.approval.approve")}
                        </Button>
                        <Button size="small"
                          onClick={() => pedirMotivo(company)}>
                          {i18n.t("compaies.approval.reject")}
                        </Button>
                      </div>
                    )}
                    {(company.approvalStatus === "rejected" ||
                      company.approvalStatus === "suspended") && (
                      <div style={{ marginTop: 4 }}>
                        <Button size="small" color="primary"
                          onClick={() => revisar(company, "approved")}>
                          {i18n.t("compaies.approval.reactivate")}
                        </Button>
                      </div>
                    )}
                    {/* El historial esta siempre disponible: la pregunta
                        de quien aprobo esto y cuando se hace sobre todo
                        cuando ya no queda ninguna accion pendiente. */}
                    <div>
                      <Button size="small" onClick={() => verHistorial(company)}>
                        {i18n.t("compaies.approval.history")}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell style={cellStyle(company)} align="center">{company.name}</TableCell>
                  <TableCell style={cellStyle(company)} align="center">{company.email}</TableCell>
                  <TableCell style={cellStyle(company)} align="center">{company?.plan?.name}</TableCell>
                  <TableCell style={cellStyle(company)} align="center">
                    R$ {renderPlanValue(company)}
                  </TableCell>
                  <TableCell style={cellStyle(company)} align="center">
                    {dateToClient(company.createdAt)}
                  </TableCell>
                  <TableCell style={cellStyle(company)} align="center">
                    {dateToClient(company.dueDate)}
                    <br />
                    <span style={cellStyle(company)}>{company.recurrence}</span>
                  </TableCell>
                  <TableCell style={cellStyle(company)} align="center">
                    {datetimeToClient(company.lastLogin)}
                  </TableCell>
                  <TableCell style={cellStyle(company)} align="center">{formatFolderSize(company?.metrics?.folderSize || 0)}</TableCell>
                  <TableCell style={cellStyle(company)} align="center">
                    {company?.metrics?.numberOfFiles || 0}
                  </TableCell>
                  <TableCell style={cellStyle(company)} align="center">
                    {datetimeToClient(company?.metrics?.lastUpdate || 'Não disponível')}
                  </TableCell>
                  {/* <TableCell align="center">{company.plan.users}</TableCell> */}
                  {/* <TableCell align="center">{company.plan.connections}</TableCell> */}
                  {/* <TableCell align="center">{company.plan.queues}</TableCell> */}
                  {/* <TableCell align="center">{renderWhatsapp(company.plan.useWhatsapp)}</TableCell> */}
                  {/* <TableCell align="center">{renderFacebook(company.plan.useFacebook)}</TableCell> */}
                  {/* <TableCell align="center">{renderInstagram(company.plan.useInstagram)}</TableCell> */}
                  {/* <TableCell align="center">{renderCampaigns(company.plan.useCampaigns)}</TableCell> */}
                  {/* <TableCell align="center">{renderExternalApi(company.plan.useExternalApi)}</TableCell> */}
                  {/* <TableCell align="center">{renderInternalChat(company.plan.useInternalChat)}</TableCell> */}
                  {/* <TableCell align="center">{renderSchedules(company.plan.useSchedules)}</TableCell> */}
                  {/* <TableCell align="center">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleEditCompany(company)}
                                        >
                                            <EditIcon />
                                        </IconButton>

                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                setConfirmModalOpen(true);
                                                setDeletingCompany(company);
                                            }}
                                        >
                                            <DeleteOutlineIcon />
                                        </IconButton>
                                    </TableCell> */}
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={4} />}
            </>
          </TableBody>
        </Table>
      </Paper>
      {/* Rechazar pide confirmacion y permite anotar el motivo. Sin
          confirmacion, un clic accidental dejaria fuera a una empresa. */}
      <Dialog open={!!rechazando} onClose={() => setRechazando(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{i18n.t("compaies.approval.rejectTitle")}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" style={{ marginBottom: 12 }}>
            {i18n.t("compaies.approval.rejectConfirm", {
              empresa: rechazando ? rechazando.name : "",
            })}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={2}
            variant="outlined"
            size="small"
            label={i18n.t("compaies.approval.reason")}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRechazando(null)}>
            {i18n.t("compaies.approval.cancel")}
          </Button>
          <Button
            color="secondary"
            variant="contained"
            onClick={() => revisar(rechazando, "rejected", motivo)}
          >
            {i18n.t("compaies.approval.reject")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Historial de la solicitud. Solo lectura: se consulta, no se
          edita, porque una linea de auditoria que se puede cambiar no
          sirve para lo que existe. */}
      <Dialog
        open={!!historialDe}
        onClose={() => setHistorialDe(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {i18n.t("compaies.approval.historyTitle")}
          {historialDe ? ` — ${historialDe.name}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          {cargandoHistorial && (
            <Typography variant="body2">
              {i18n.t("compaies.approval.historyLoading")}
            </Typography>
          )}
          {!cargandoHistorial && historial.length === 0 && (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("compaies.approval.historyEmpty")}
            </Typography>
          )}
          {!cargandoHistorial &&
            historial.map((linea) => (
              <div
                key={linea.id}
                style={{
                  padding: 8,
                  borderBottom: `1px solid ${theme.palette.tokens.border.border}`,
                }}
              >
                <Typography variant="body2" style={{ fontWeight: 600 }}>
                  {i18n.t(`compaies.approval.events.${linea.event}`)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {new Date(linea.createdAt).toLocaleString()}
                  {linea.actor ? ` · ${linea.actor.name}` : ""}
                  {linea.ip ? ` · ${linea.ip}` : ""}
                </Typography>
                {linea.detail && (
                  <Typography variant="body2" color="textSecondary">
                    {linea.detail}
                  </Typography>
                )}
              </div>
            ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistorialDe(null)}>
            {i18n.t("compaies.approval.close")}
          </Button>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
};

export default Companies;