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
    fontFamily: "'Plus Jakarta Sans', sans-serif'",
  },
  h4: {
    fontFamily: "'Plus Jakarta Sans', sans-serif'",
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
      backgroundColor: "rgba(6, 81, 131, 0.3)",
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
      theme.palette.mode === "light"
        ? theme.palette.primary.main
        : theme.palette.primary.contrastText,
  },
  container: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  nps: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.padding,
  },
  fixedHeightPaper: {
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    height: 240,
    overflowY: "auto",
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
    color: theme.palette.primary.main,
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
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: "100%",
  },
  sectionTitle: {
    fontSize: "1.5rem",
    fontWeight: 700,
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(2),
  },
  mainPaper: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    ...theme.scrollbarStyles,
    backgroundColor: "transparent !important",
    borderRadius: "10px",
  },
  paper: {
    padding: theme.spacing(2),
    borderRadius: 12,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[1],
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
    color: theme.palette.mode === "light" ? theme.palette.text.secondary : theme.palette.text.primary,
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
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(1),
  },
}));

// Componente memoizado para os indicadores
const IndicatorCard = memo(({ label, value, icon }) => {
  const classes = useStyles();
  return (
    <Grid2 xs={12} sm={6} md={4} lg={3}>
      <Paper className={classes.paper}>
        <Box display="flex" alignItems="center">
          {icon}
          <Box ml={2}>
            <Typography variant="h6">{value}</Typography>
            <Typography variant="body2">{label}</Typography>
          </Box>
        </Box>
      </Paper>
    </Grid2>
  );
});

// Componente memoizado para NPS
const NPSCard = memo(({ label, value, color }) => {
  const classes = useStyles();
  return (
    <Grid2 xs={12} md={6} lg={3}>
      <Paper className={classes.paper}>
        <Box className={classes.barContainer}>
          <Typography className={classes.progressLabel}>{label}</Typography>
          <LinearProgress
            variant="determinate"
            value={value}
            className={classes.progressBar}
            style={{ backgroundColor: color }}
          />
          <Typography className={classes.progressLabel}>{value}%</Typography>
        </Box>
      </Paper>
    </Grid2>
  );
});

// Componente memoizado para informações de atendimento
const AttendanceCard = memo(({ label, value, icon }) => {
  const classes = useStyles();
  return (
    <Grid2 xs={12} sm={6} md={3}>
      <Paper className={classes.infoCard} style={{ height: '100%' }}>
        <Box display="flex" alignItems="center">
          {icon}
          <Box ml={2}>
            <Typography variant="h6">{value}</Typography>
            <Typography variant="body2">{label}</Typography>
          </Box>
        </Box>
      </Paper>
    </Grid2>
  );
});

const Dashboard = () => {
  const theme = useTheme();
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
    { label: i18n.t("dashboard.cards.inAttendance"), value: counters.supportHappening || 0, icon: <CallIcon style={{ color: "#01BBAC" }} /> },
    { label: i18n.t("dashboard.cards.waiting"), value: counters.supportPending || 0, icon: <HourglassEmptyIcon style={{ color: "#47606e" }} /> },
    { label: i18n.t("dashboard.cards.finalized"), value: counters.supportFinished || 0, icon: <CheckCircleIcon style={{ color: "#5852ab" }} /> },
    { label: i18n.t("dashboard.cards.groups"), value: counters.supportGroups || 0, icon: <Groups style={{ color: "#01BBAC" }} /> },
    { label: i18n.t("dashboard.cards.activeAttendants"), value: `${getUsersOnlineCount}/${attendants.length}`, icon: <RecordVoiceOverIcon style={{ color: "#805753" }} /> },
    { label: i18n.t("dashboard.cards.newContacts"), value: counters.leads || 0, icon: <GroupAddIcon style={{ color: "#8c6b19" }} /> },
    { label: i18n.t("dashboard.cards.totalReceivedMessages"), value: `${messagesCount.received}/${messagesCount.receivedAll}`, icon: <MessageIcon style={{ color: "#333133" }} /> },
    { label: i18n.t("dashboard.cards.totalSentMessages"), value: `${messagesCount.sent}/${messagesCount.sentAll}`, icon: <SendIcon style={{ color: "#558a59" }} /> },
    { label: i18n.t("dashboard.cards.averageServiceTime"), value: formatTime(counters.avgSupportTime), icon: <AccessAlarmIcon style={{ color: "#F79009" }} /> },
    { label: i18n.t("dashboard.cards.averageWaitingTime"), value: formatTime(counters.avgWaitTime), icon: <TimerIcon style={{ color: "#8a2c40" }} /> },
    { label: i18n.t("dashboard.cards.activeTickets"), value: counters.activeTickets || 0, icon: <ArrowUpward style={{ color: "#EE4512" }} /> },
    { label: i18n.t("dashboard.cards.passiveTickets"), value: counters.passiveTickets || 0, icon: <ArrowDownward style={{ color: "#28C037" }} /> },
  ], [counters, getUsersOnlineCount, attendants.length, messagesCount, formatTime]);

  // Dados memoizados para NPS
  const npsData = useMemo(() => [
    { label: i18n.t("dashboard.nps.score"), value: counters.npsScore || 0, color: "#000" },
    { label: i18n.t("dashboard.nps.promoters"), value: counters.npsPromotersPerc || 0, color: "#2EA85A" },
    { label: i18n.t("dashboard.nps.neutrals"), value: counters.npsPassivePerc || 0, color: "#F7EC2C" },
    { label: i18n.t("dashboard.nps.detractors"), value: counters.npsDetractorsPerc || 0, color: "#F73A2C" },
  ], [counters]);

  // Dados memoizados para atendimentos
  const attendanceData = useMemo(() => [
    { label: i18n.t("dashboard.attendances.total"), value: counters.tickets || 0, icon: <CallIcon style={{ color: '#01BBAC' }} /> },
    { label: i18n.t("dashboard.attendances.waitingRating"), value: counters.waitRating || 0, icon: <HourglassEmptyIcon style={{ color: '#47606e' }} /> },
    { label: i18n.t("dashboard.attendances.withoutRating"), value: counters.withoutRating || 0, icon: <ErrorOutlineIcon style={{ color: '#8a2c40' }} /> },
    { label: i18n.t("dashboard.attendances.withRating"), value: counters.withRating || 0, icon: <CheckCircleOutlineIcon style={{ color: '#805753' }} /> },
  ], [counters]);

  // Verificação de perfil memoizada
  const shouldShowDashboard = useMemo(() => {
    return !(user?.profile === "user" && user?.showDashboard === "disabled");
  }, [user?.profile, user?.showDashboard]);

  if (!shouldShowDashboard) {
    return <ForbiddenPage />;
  }

  return (
    <MainContainer>
      <Paper className={classes.mainPaper} variant="outlined">
        <Container maxWidth={false} className={classes.container} style={{ padding: '16px 8px', maxWidth: '100%', overflowX: 'hidden' }}>
          <Grid2 container spacing={2} className={classes.container} style={{ margin: 0, width: '100%' }}>
            {/* FILTROS */}
            <Grid2 xs={12} container justifyContent="flex-end">
              <Button
                onClick={toggleShowFilter}
                color="primary"
                startIcon={!showFilter ? <FilterListIcon /> : <ClearIcon />}
              >
                {showFilter ? i18n.t("dashboard.filters.hide") : i18n.t("dashboard.filters.show")}
              </Button>
            </Grid2>

            {showFilter && (
              <Grid2 xs={12} style={{ marginBottom: "20px" }}>
                <Filters
                  classes={classes}
                  setDateStartTicket={setDateStartTicket}
                  setDateEndTicket={setDateEndTicket}
                  dateStartTicket={dateStartTicket}
                  dateEndTicket={dateEndTicket}
                  setQueueTicket={setQueueTicket}
                  queueTicket={queueTicket}
                  fetchData={setFetchDataFilter}
                />
              </Grid2>
            )}
            
            {/* Indicadores Gerais */}
            <Grid2 xs={12} style={{ marginTop: '20px', paddingLeft: '4px' }}>
              <Typography variant="h5" style={{ marginBottom: '10px', color: theme.palette.primary.main }}>
                {i18n.t("dashboard.sections.indicators")}
              </Typography>
            </Grid2>
            {indicators.map((indicator, index) => (
              <IndicatorCard key={`indicator-${index}`} {...indicator} />
            ))}

            {/* Pesquisa de Satisfação (NPS) */}
            <Grid2 xs={12} style={{ marginTop: '40px', paddingLeft: '4px' }}>
              <Typography variant="h5" style={{ marginBottom: '10px', color: theme.palette.primary.main }}>
                {i18n.t("dashboard.sections.satisfactionSurvey")}
              </Typography>
            </Grid2>
            {npsData.map((nps, index) => (
              <NPSCard key={`nps-${index}`} {...nps} />
            ))}

            {/* Informações de Atendimento */}
            <Grid2 xs={12} style={{ marginTop: '40px', paddingLeft: '4px' }}>
              <Typography variant="h5" style={{ marginBottom: '10px', color: theme.palette.primary.main }}>
                {i18n.t("dashboard.sections.attendances")}
              </Typography>
            </Grid2>
            {attendanceData.map((attInfo, index) => (
              <AttendanceCard key={`attendance-${index}`} {...attInfo} />
            ))}

            {/* Índice de Avaliação */}
            <Grid2 xs={12} style={{ marginTop: '40px', paddingLeft: '4px', paddingRight: '4px' }}>
              <Typography variant="h6" style={{ marginBottom: '15px', color: theme.palette.primary.main }}>
                {i18n.t("dashboard.sections.ratingIndex")}
              </Typography>
              <Grid2 container alignItems="center" spacing={2}>
                <Grid2 xs={12} sm={2}>
                  <Paper className={classes.infoCard} style={{ textAlign: 'center', padding: '8px', backgroundColor: '#FFE3B3' }}>
                    <Typography variant="h6" style={{ color: '#F79009' }}>
                      {Number(counters.percRating / 100).toLocaleString(undefined, { style: 'percent' }) || "0%"}
                    </Typography>
                  </Paper>
                </Grid2>
                <Grid2 xs={12} sm={10}>
                  <LinearProgress
                    variant="determinate"
                    value={counters.percRating || 0}
                    className={classes.progressBar}
                    style={{ backgroundColor: "#e0e0e0", height: 10, borderRadius: 5 }}
                  />
                </Grid2>
              </Grid2>
            </Grid2>

            {/* Tabela de Atendentes */}
            <Grid2 xs={12} style={{ marginTop: '40px', paddingLeft: '4px' }}>
              <Typography variant="h5" style={{ marginBottom: '10px', color: theme.palette.primary.main }}>
                {i18n.t("dashboard.sections.attendants")}
              </Typography>
              <Paper className={classes.paper}>
                <TableAttendantsStatus
                  attendants={attendants}
                  loading={loading}
                />
              </Paper>
            </Grid2>

            {/* Gráficos */}
            <Grid2 container spacing={3} xs={12}>
              <Grid2 xs={12} md={6}>
                <Paper className={classes.paper} style={{ marginBottom: "16px" }}>
                  <ChatsUser />
                </Paper>
              </Grid2>
              <Grid2 xs={12} md={6}>
                <Paper className={classes.paper}>
                  <ChartsDate />
                </Paper>
              </Grid2>
            </Grid2>
          </Grid2>
        </Container>
      </Paper>
    </MainContainer>
  );
};

export default Dashboard;