import React, { useContext, useState, useEffect, useMemo, useCallback, memo, useRef } from "react";

import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import { useTheme } from "@material-ui/core/styles";
import { IconButton } from "@mui/material";
import { Groups, SaveAlt } from "@mui/icons-material";

import CallIcon from "@material-ui/icons/Call";
import RecordVoiceOverIcon from "@material-ui/icons/RecordVoiceOver";
import GroupAddIcon from "@material-ui/icons/GroupAdd";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import FilterListIcon from "@material-ui/icons/FilterList";
import ClearIcon from "@material-ui/icons/Clear";
import SendIcon from "@material-ui/icons/Send";
import MessageIcon from "@material-ui/icons/Message";
import AccessAlarmIcon from "@material-ui/icons/AccessAlarm";
import TimerIcon from "@material-ui/icons/Timer";
import * as XLSX from "xlsx";
import CheckCircleOutlineIcon from "@material-ui/icons/RecordVoiceOver";
import ErrorOutlineIcon from "@material-ui/icons/RecordVoiceOver";

import { grey, blue } from "@material-ui/core/colors";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import TabPanel from "../../components/TabPanel";
import TableAttendantsStatus from "../../components/Dashboard/TableAttendantsStatus";
import { isArray } from "lodash";

import { AuthContext } from "../../context/Auth/AuthContext";

import useDashboard from "../../hooks/useDashboard";
import { ChatsUser } from "./ChartsUser";

import Filters from "./Filters";
import { isEmpty } from "lodash";
import moment from "moment";
import { ChartsDate } from "./ChartsDate";
import {
  Avatar,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  SvgIcon,
  Tab,
  Tabs,
  LinearProgress,
  Box,
} from "@mui/material";
import { i18n } from "../../translate/i18n";
import useMediaQuery from "@mui/material/useMediaQuery";
import { PageHeader, SectionHeader, KpiCard, MeterRow, ResponsiveGrid, Card as UiCard, Button as UiButton, BottomSheet, useTokens } from "../../components/ui";
import Grid2 from "@mui/material/Unstable_Grid2/Grid2";
import ForbiddenPage from "../../components/ForbiddenPage";
import { ArrowDownward, ArrowUpward } from "@material-ui/icons";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  overline: {
    fontSize: "0.9rem",
    fontWeight: 700,
    color: theme.palette.text.secondary,
    letterSpacing: "0.5px",
    lineHeight: 2.5,
    textTransform: "uppercase",
    // El valor era "'Plus Jakarta Sans', sans-serif'" con un apostrofo
    // sobrante al final, lo que invalida la declaracion entera: el navegador
    // la descartaba y caia en la tipografia heredada.
    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
  },
  h4: {
    // El valor era "'Plus Jakarta Sans', sans-serif'" con un apostrofo
    // sobrante al final, lo que invalida la declaracion entera: el navegador
    // la descartaba y caia en la tipografia heredada.
    fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
    fontWeight: 500,
    fontSize: "2rem",
    lineHeight: 1,
    color: theme.palette.text.primary,
  },
  selected: {}, // Adiciona a classe selected vazia para referência
  tab: {
    minWidth: "auto",
    width: "auto",
    padding: theme.spacing(0.5, 1),
    borderRadius: 8,
    transition: "0.3s",
    borderWidth: "1px",
    borderStyle: "solid",
    marginRight: theme.spacing(0.5),
    marginLeft: theme.spacing(0.5),

    [theme.breakpoints.down("lg")]: {
      fontSize: "0.9rem",
      padding: theme.spacing(0.4, 0.8),
      marginRight: theme.spacing(0.4),
      marginLeft: theme.spacing(0.4),
    },
    [theme.breakpoints.down("md")]: {
      fontSize: "0.8rem",
      padding: theme.spacing(0.3, 0.6),
      marginRight: theme.spacing(0.3),
      marginLeft: theme.spacing(0.3),
    },
    "&:hover": {
      // Era "rgba(6, 81, 131, 0.3)", el azul por defecto anterior escrito a
      // mano: no seguia al color de marca ni funcionaba en modo oscuro.
      backgroundColor:
        theme.mode === "light"
          ? `${theme.palette.primary.main}14`
          : `${theme.palette.primary.main}26`,
    },
    "&$selected": {
      color: theme.palette.primary.contrastText,
      backgroundColor: theme.palette.primary.main,
    },
  },
  tabIndicator: {
    borderWidth: "2px",
    borderStyle: "solid",
    height: 6,
    bottom: 0,
    color:
      theme.mode === "light"
        ? theme.palette.primary.main
        : theme.palette.primary.contrastText,
  },
  container: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  nps: {
    paddingTop: theme.spacing(1),
    // Era theme.padding, que no existe en el tema: el valor llegaba como
    // undefined y la propiedad se descartaba.
    paddingBottom: theme.spacing(1),
  },
  fixedHeightPaper: {
    padding: theme.palette.tokens.space.xl,
    display: "flex",
    flexDirection: "column",
    height: 240,
    overflowY: "auto",
    borderRadius: theme.palette.tokens.radius.lg,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.palette.tokens.shadow.sm,
    ...theme.scrollbarStyles,
  },
  cardAvatar: {
    fontSize: "55px",
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
    width: theme.spacing(7),
    height: theme.spacing(7),
  },
  cardTitle: {
    fontSize: "18px",
    color: theme.palette.tokens.brand.onSurface,
  },
  cardSubtitle: {
    color: theme.palette.text.secondary,
    fontSize: "14px",
  },
  alignRight: {
    textAlign: "right",
  },
  fullWidth: {
    width: "100%",
  },
  selectContainer: {
    width: "100%",
    textAlign: "left",
  },
  iframeDashboard: {
    width: "100%",
    height: "calc(100vh - 64px)",
    border: "none",
  },
  customFixedHeightPaperLg: {
    padding: theme.palette.tokens.space.xl,
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: "100%",
    borderRadius: theme.palette.tokens.radius.lg,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.palette.tokens.shadow.sm,
  },
  sectionTitle: {
    // Era 1.5rem en el color de marca. Un titulo de seccion no deberia
    // competir en peso visual con los datos que encabeza; se baja a la
    // escala del sistema y al color de texto principal.
    fontSize: "1.125rem",
    fontWeight: 600,
    letterSpacing: "-0.015em",
    color: theme.palette.tokens.text.primary,
    marginBottom: theme.palette.tokens.space.lg,
  },
  mainPaper: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    ...theme.scrollbarStyles,
    backgroundColor: "transparent !important",
    borderRadius: "10px",
  },
  // Tarjetas del panel.
  //
  // Se les da el mismo lenguaje que al resto: borde sutil, sombra suave con
  // tinte azulado en vez de la de serie del MUI, y radio del sistema. El
  // borde importa mas de lo que parece: en modo oscuro la sombra apenas se
  // percibe, y sin borde las tarjetas se funden con el fondo.
  paper: {
    padding: theme.palette.tokens.space.xl,
    borderRadius: theme.palette.tokens.radius.lg,
    backgroundColor: theme.palette.tokens.surface.surface,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.palette.tokens.shadow.sm,
    transition: "box-shadow 180ms ease",
    "&:hover": {
      boxShadow: theme.palette.tokens.shadow.md,
    },
  },
  barContainer: {
    display: "flex",
    alignItems: "center",
    marginBottom: theme.spacing(1),
  },
  progressBar: {
    flex: 1,
    marginRight: theme.spacing(1),
    borderRadius: 5,
    height: 10,
  },
  progressLabel: {
    minWidth: 50,
    textAlign: "right",
    fontWeight: 500,
    color: theme.mode === "light" ? theme.palette.text.secondary : theme.palette.text.primary,
  },
  infoCard: {
    padding: theme.spacing(2),
    textAlign: "center",
    borderRadius: 12,
    boxShadow: theme.shadows[1],
    backgroundColor: theme.palette.background.paper,
    marginBottom: theme.spacing(2),
  },
  infoIcon: {
    fontSize: "2rem",
    color: theme.palette.tokens.brand.onSurface,
    marginBottom: theme.spacing(1),
  },
}));

const Dashboard = () => {
  const theme = useTheme();
  const tk = useTokens();
  const isMobile = useMediaQuery("(max-width:599.95px)");
  const classes = useStyles();
  
  // Estados principais
  const [counters, setCounters] = useState({});
  const [attendants, setAttendants] = useState([]);
  const [messagesCount, setMessagesCount] = useState({
    sent: 0,
    received: 0,
    sentAll: 0,
    receivedAll: 0
  });
  const [contactsCount, setContactsCount] = useState({
    period: 0,
    all: 0
  });
  const [loading, setLoading] = useState(false);
  
  // Usar ref para controlar se já foi carregado
  const hasLoadedRef = useRef(false);
  const isMountedRef = useRef(true);
  
  const { find } = useDashboard();

  // Datas iniciais
  const initialDates = useMemo(() => {
    const newDate = new Date();
    const date = newDate.getDate();
    const month = newDate.getMonth() + 1;
    const year = newDate.getFullYear();
    const nowIni = `${year}-${month < 10 ? `0${month}` : `${month}`}-01`;
    const now = `${year}-${month < 10 ? `0${month}` : `${month}`}-${date < 10 ? `0${date}` : `${date}`}`;
    return { nowIni, now };
  }, []);

  const [showFilter, setShowFilter] = useState(false);
  const [dateStartTicket, setDateStartTicket] = useState(initialDates.nowIni);
  const [dateEndTicket, setDateEndTicket] = useState(initialDates.now);
  const [queueTicket, setQueueTicket] = useState(false);
  const [fetchDataFilter, setFetchDataFilter] = useState(0);

  const { user } = useContext(AuthContext);

  // Função memoizada para formatar tempo
  const formatTime = useCallback((minutes) => {
    return moment().startOf("day").add(minutes, "minutes").format("HH[h] mm[m]");
  }, []);

  // Função memoizada para contar usuários online
  const getUsersOnlineCount = useMemo(() => {
    return attendants.filter(user => user.online === true).length;
  }, [attendants]);

  // Função para buscar contagem de mensagens - otimizada
  const fetchMessagesCount = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const [sentPeriod, receivedPeriod, sentAll, receivedAll] = await Promise.all([
        api.get("/messages-allMe", {
          params: { fromMe: true, dateStart: dateStartTicket, dateEnd: dateEndTicket }
        }),
        api.get("/messages-allMe", {
          params: { fromMe: false, dateStart: dateStartTicket, dateEnd: dateEndTicket }
        }),
        api.get("/messages-allMe", {
          params: { fromMe: true }
        }),
        api.get("/messages-allMe", {
          params: { fromMe: false }
        })
      ]);

      if (isMountedRef.current) {
        setMessagesCount({
          sent: sentPeriod.data.count[0]?.count || 0,
          received: receivedPeriod.data.count[0]?.count || 0,
          sentAll: sentAll.data.count[0]?.count || 0,
          receivedAll: receivedAll.data.count[0]?.count || 0
        });
      }
    } catch (error) {
      console.error("Erro ao buscar mensagens:", error);
    }
  }, [dateStartTicket, dateEndTicket]);

  // Função para buscar contagem de contatos - otimizada
  const fetchContactsCount = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const [contactsPeriod, contactsAll] = await Promise.all([
        api.get("/contacts", {
          params: { dateStart: dateStartTicket, dateEnd: dateEndTicket }
        }),
        api.get("/contacts", {})
      ]);

      if (isMountedRef.current) {
        setContactsCount({
          period: contactsPeriod.data.count || 0,
          all: contactsAll.data.count || 0
        });
      }
    } catch (error) {
      console.error("Erro ao buscar contatos:", error);
    }
  }, [dateStartTicket, dateEndTicket]);

  // Função principal de busca de dados - otimizada
  const fetchData = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setLoading(true);
    
    let params = {};
    
    if (!isEmpty(dateStartTicket) && moment(dateStartTicket).isValid()) {
      params.date_from = moment(dateStartTicket).format("YYYY-MM-DD");
    }
    
    if (!isEmpty(dateEndTicket) && moment(dateEndTicket).isValid()) {
      params.date_to = moment(dateEndTicket).format("YYYY-MM-DD");
    }
    
    if (Object.keys(params).length === 0) {
      params = { days: 30 };
    }
    
    try {
      const [dashboardData] = await Promise.all([
        find(params),
        fetchMessagesCount(),
        fetchContactsCount()
      ]);
      
      if (isMountedRef.current) {
        const safeCounters = {
          avgSupportTime: 0,
          avgWaitTime: 0,
          supportFinished: 0,
          supportHappening: 0,
          supportPending: 0,
          supportGroups: 0,
          leads: 0,
          activeTickets: 0,
          passiveTickets: 0,
          tickets: 0,
          waitRating: 0,
          withoutRating: 0,
          withRating: 0,
          percRating: 0,
          npsPromotersPerc: 0,
          npsPassivePerc: 0,
          npsDetractorsPerc: 0,
          npsScore: 0,
          ...dashboardData.counters
        };
        
        setCounters(safeCounters);
        setAttendants(isArray(dashboardData.attendants) ? dashboardData.attendants : []);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      if (isMountedRef.current) {
        toast.error('Erro ao carregar dados do dashboard');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [dateStartTicket, dateEndTicket, find, fetchMessagesCount, fetchContactsCount]);

  // UseEffect único e otimizado - só executa uma vez
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      const timeoutId = setTimeout(() => {
        fetchData();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, []);

  // UseEffect para mudança de filtros
  useEffect(() => {
    if (fetchDataFilter > 0) {
      fetchData();
    }
  }, [fetchDataFilter, fetchData]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Callback para toggle do filtro
  const toggleShowFilter = useCallback(() => {
    setShowFilter(prev => !prev);
  }, []);

  // Dados memoizados para os indicadores
  const indicators = useMemo(() => [
    { label: i18n.t("dashboard.cards.inAttendance"), value: counters.supportHappening || 0, icon: <CallIcon />, tone: "info" },
    { label: i18n.t("dashboard.cards.waiting"), value: counters.supportPending || 0, icon: <HourglassEmptyIcon />, tone: "warning" },
    { label: i18n.t("dashboard.cards.finalized"), value: counters.supportFinished || 0, icon: <CheckCircleIcon />, tone: "success" },
    { label: i18n.t("dashboard.cards.groups"), value: counters.supportGroups || 0, icon: <Groups />, tone: "info" },
    { label: i18n.t("dashboard.cards.activeAttendants"), value: `${getUsersOnlineCount}/${attendants.length}`, icon: <RecordVoiceOverIcon />, tone: "brand" },
    { label: i18n.t("dashboard.cards.newContacts"), value: counters.leads || 0, icon: <GroupAddIcon />, tone: "brand" },
    { label: i18n.t("dashboard.cards.totalReceivedMessages"), value: `${messagesCount.received}/${messagesCount.receivedAll}`, icon: <MessageIcon />, tone: "info" },
    { label: i18n.t("dashboard.cards.totalSentMessages"), value: `${messagesCount.sent}/${messagesCount.sentAll}`, icon: <SendIcon />, tone: "success" },
    { label: i18n.t("dashboard.cards.averageServiceTime"), value: formatTime(counters.avgSupportTime), icon: <AccessAlarmIcon />, tone: "warning" },
    { label: i18n.t("dashboard.cards.averageWaitingTime"), value: formatTime(counters.avgWaitTime), icon: <TimerIcon />, tone: "error" },
    { label: i18n.t("dashboard.cards.activeTickets"), value: counters.activeTickets || 0, icon: <ArrowUpward />, tone: "brand" },
    { label: i18n.t("dashboard.cards.passiveTickets"), value: counters.passiveTickets || 0, icon: <ArrowDownward />, tone: "success" },
  ], [counters, getUsersOnlineCount, attendants.length, messagesCount, formatTime]);

  // Dados memoizados para NPS
  const npsData = useMemo(() => [
    { label: i18n.t("dashboard.nps.score"), value: counters.npsScore || 0, color: "#000", tone: "brand" },
    { label: i18n.t("dashboard.nps.promoters"), value: counters.npsPromotersPerc || 0, color: "#2EA85A", tone: "success" },
    { label: i18n.t("dashboard.nps.neutrals"), value: counters.npsPassivePerc || 0, color: "#F7EC2C", tone: "warning" },
    { label: i18n.t("dashboard.nps.detractors"), value: counters.npsDetractorsPerc || 0, color: "#F73A2C", tone: "error" },
  ], [counters]);

  // Dados memoizados para atendimentos
  const attendanceData = useMemo(() => [
    { label: i18n.t("dashboard.attendances.total"), value: counters.tickets || 0, icon: <CallIcon />, tone: "info" },
    { label: i18n.t("dashboard.attendances.waitingRating"), value: counters.waitRating || 0, icon: <HourglassEmptyIcon />, tone: "warning" },
    { label: i18n.t("dashboard.attendances.withoutRating"), value: counters.withoutRating || 0, icon: <ErrorOutlineIcon />, tone: "error" },
    { label: i18n.t("dashboard.attendances.withRating"), value: counters.withRating || 0, icon: <CheckCircleOutlineIcon />, tone: "success" },
  ], [counters]);

  // Verificação de perfil memoizada
  const shouldShowDashboard = useMemo(() => {
    return !(user?.profile === "user" && user?.showDashboard === "disabled");
  }, [user?.profile, user?.showDashboard]);

  if (!shouldShowDashboard) {
    return <ForbiddenPage />;
  }

  const filtersNode = (
    <Filters
      classes={classes}
      setDateStartTicket={setDateStartTicket}
      setDateEndTicket={setDateEndTicket}
      dateStartTicket={dateStartTicket}
      dateEndTicket={dateEndTicket}
      setQueueTicket={setQueueTicket}
      queueTicket={queueTicket}
      fetchData={setFetchDataFilter}
      onApplied={isMobile ? toggleShowFilter : undefined}
    />
  );

  const periodLabel = `${moment(dateStartTicket).isValid() ? moment(dateStartTicket).format("DD/MM/YYYY") : "—"} – ${moment(dateEndTicket).isValid() ? moment(dateEndTicket).format("DD/MM/YYYY") : "—"}`;

  return (
    <MainContainer>
      <Box sx={{ width: "100%", maxWidth: 1440, mx: "auto", px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 2, md: 3 }, overflowX: "hidden", overflowY: "auto", boxSizing: "border-box" }}>
        <PageHeader
          title={i18n.t("mainDrawer.listItems.dashboard")}
          subtitle={periodLabel}
          actions={
            <UiButton
              tone={showFilter ? "primary" : "secondary"}
              onClick={toggleShowFilter}
              startIcon={!showFilter || isMobile ? <FilterListIcon /> : <ClearIcon />}
              aria-expanded={showFilter}
            >
              {showFilter && !isMobile ? i18n.t("dashboard.filters.hide") : i18n.t("dashboard.filters.show")}
            </UiButton>
          }
        />

        {/* FILTROS: panel en línea en escritorio, hoja inferior en móvil */}
        {!isMobile && showFilter && <Box sx={{ mb: 3 }}>{filtersNode}</Box>}
        {isMobile && (
          <BottomSheet open={showFilter} onClose={toggleShowFilter} title={String(i18n.t("dashboard.filter")).trim()}>
            <Box sx={{ px: 2, pb: 3 }}>{filtersNode}</Box>
          </BottomSheet>
        )}

        {/* Indicadores Gerais */}
        <SectionHeader title={i18n.t("dashboard.sections.indicators")} />
        <ResponsiveGrid min={220} sx={{ mb: 4, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(auto-fill, minmax(220px, 1fr))" } }}>
          {indicators.map((indicator, index) => (
            <KpiCard key={`indicator-${index}`} loading={loading} {...indicator} />
          ))}
        </ResponsiveGrid>

        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, mb: 4 }}>
          {/* Pesquisa de Satisfação (NPS) */}
          <UiCard>
            <SectionHeader title={i18n.t("dashboard.sections.satisfactionSurvey")} />
            {npsData.map((nps, index) => (
              <MeterRow key={`nps-${index}`} label={nps.label} value={nps.value} tone={nps.tone} />
            ))}
          </UiCard>

          {/* Informações de Atendimento + Índice de Avaliação */}
          <UiCard>
            <SectionHeader title={i18n.t("dashboard.sections.attendances")} />
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "1fr 1fr", mb: 2 }}>
              {attendanceData.map((attInfo, index) => (
                <Box key={`attendance-${index}`} sx={{ p: 1.5, borderRadius: `${tk?.radius.md ?? 8}px`, border: `1px solid ${tk?.border.border}`, minWidth: 0 }}>
                  <Typography style={{ fontSize: 12, color: tk?.text.muted, fontWeight: 600 }}>{attInfo.label}</Typography>
                  <Typography style={{ fontSize: 22, fontWeight: 700, color: tk?.text.primary, fontVariantNumeric: "tabular-nums" }}>{attInfo.value}</Typography>
                </Box>
              ))}
            </Box>
            <MeterRow
              label={i18n.t("dashboard.sections.ratingIndex")}
              value={Number(counters.percRating || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
              tone="warning"
            />
          </UiCard>
        </Box>

        {/* Tabela de Atendentes */}
        <SectionHeader title={i18n.t("dashboard.sections.attendants")} />
        <UiCard padding="md" sx={{ mb: 4, overflowX: "auto" }}>
          <TableAttendantsStatus attendants={attendants} loading={loading} />
        </UiCard>

        {/* Gráficos */}
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
          <UiCard sx={{ minWidth: 0 }}><ChatsUser /></UiCard>
          <UiCard sx={{ minWidth: 0 }}><ChartsDate /></UiCard>
        </Box>
      </Box>
    </MainContainer>
  );
};

export default Dashboard;