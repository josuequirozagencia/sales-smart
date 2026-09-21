import React, { useState, useEffect, useContext } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import api from '../../services/api';
import { AuthContext } from '../../context/Auth/AuthContext';
import { toast } from 'react-toastify';
import { i18n } from '../../translate/i18n';
import { useHistory } from 'react-router-dom';
import {
  Button,
  TextField,
  Paper,
  FormControl,
  InputLabel,
  Select,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
} from '@material-ui/core';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import SearchIcon from '@material-ui/icons/Search';
import toastError from '../../errors/toastError';
import { format } from 'date-fns';
import { Can } from '../../components/Can';
import MainContainer from '../../components/MainContainer';
import MainHeader from '../../components/MainHeader';
import MainHeaderButtonsWrapper from '../../components/MainHeaderButtonsWrapper';
import Title from '../../components/Title';
import KanbanBoard from './KanbanBoard';

const useStyles = makeStyles(theme => ({
  mainPaper: {
    flex: 1,
    display: 'flex',
    padding: theme.spacing(1),
    overflowX: 'auto',
    ...theme.scrollbarStyles,
    borderRadius: '10px',
  },
  button: {
    borderRadius: '10px',
  },
  dateInput: {
    '& .MuiOutlinedInput-root': {
      borderRadius: '10px',
    },
    marginRight: theme.spacing(1),
  },
  sortSelect: {
    minWidth: 150,
    marginRight: theme.spacing(1),
    '& .MuiOutlinedInput-root': {
      borderRadius: '10px',
    },
  },
  // Selector de embudo en el sitio del titulo: el nombre del tablero activo
  // con una flecha, como en GoHighLevel.
  selectorEmbudo: {
    textTransform: 'none',
    fontSize: '1.25rem',
    fontWeight: 700,
    padding: theme.spacing(0.25, 1),
    color: theme.palette.tokens.text.primary,
  },
  buscadorEmbudos: {
    padding: theme.spacing(0.5, 1.5, 1),
  },
  vacio: {
    padding: theme.spacing(4),
    textAlign: 'center',
    color: theme.palette.tokens.text.secondary,
  },
}));

// Por encima de este numero de embudos, el menu trae buscador.
const EMBUDOS_CON_BUSCADOR = 8;
// Ultimo embudo abierto, por navegador: al volver al tablero se abre el mismo.
const CLAVE_EMBUDO = 'kanbanPipelineId';

const Kanban = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);
  const [tags, setTags] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [pipelineId, setPipelineId] = useState(() => {
    const guardado = Number(localStorage.getItem(CLAVE_EMBUDO));
    return Number.isInteger(guardado) && guardado > 0 ? guardado : null;
  });
  const [menuEmbudos, setMenuEmbudos] = useState(null);
  const [menuCrear, setMenuCrear] = useState(null);
  const [buscaEmbudo, setBuscaEmbudo] = useState('');
  const [nuevoEmbudo, setNuevoEmbudo] = useState(null);
  const [guardandoEmbudo, setGuardandoEmbudo] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [lanes, setLanes] = useState([]);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const queueIds = (user.queues || []).map(queue => queue.UserQueue.queueId);

  const [sortOrder, setSortOrder] = useState(() => {
    return localStorage.getItem('sortOrder') || 'ticketNumber';
  });

  useEffect(() => {
    localStorage.setItem('sortOrder', sortOrder);
  }, [sortOrder]);

  // Embudos de la empresa. El activo es el ultimo que se abrio en este
  // navegador; si ya no existe, el de referencia o el primero.
  useEffect(() => {
    const cargarPipelines = async () => {
      try {
        const { data } = await api.get('/kanban/pipelines');
        const lista = Array.isArray(data) ? data : [];
        setPipelines(lista);
        setPipelineId(previo => {
          if (previo && lista.some(p => p.id === previo)) return previo;
          const porDefecto = lista.find(p => p.isDefault) || lista[0];
          return porDefecto ? porDefecto.id : null;
        });
      } catch (err) {
        // Sin embudos el tablero sigue funcionando con todas las etapas.
        setPipelines([]);
      }
    };
    cargarPipelines();
  }, []);

  useEffect(() => {
    if (pipelineId) localStorage.setItem(CLAVE_EMBUDO, String(pipelineId));
    fetchTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId]);

  const fetchTags = async () => {
    try {
      const response = await api.get('/tag/kanban/', {
        // Sin embudo (empresa que aun no tiene ninguno) se piden todas, que es
        // como se comportaba el tablero antes de los embudos.
        params: pipelineId ? { pipelineId } : {},
      });
      const fetchedTags = response.data.lista || [];
      setTags(fetchedTags);
      fetchTickets(fetchedTags);
    } catch (error) {
      console.log(error);
    }
  };

  const fetchTickets = async (fetchedTags = tags) => {
    try {
      const { data } = await api.get('/ticket/kanban', {
        params: {
          queueIds: JSON.stringify(queueIds),
          startDate: startDate,
          endDate: endDate,
        },
      });
      setTickets(data.tickets);
      organizeLanes(fetchedTags, data.tickets);
    } catch (err) {
      console.log(err);
      setTickets([]);
    }
  };

  useEffect(() => {
    const companyId = user.companyId;

    const onAppMessage = data => {
      if (['create', 'update', 'delete'].includes(data.action)) {
        fetchTickets();
      }
    };

    socket.on(`company-${companyId}-ticket`, onAppMessage);
    socket.on(`company-${companyId}-appMessage`, onAppMessage);

    return () => {
      socket.off(`company-${companyId}-ticket`, onAppMessage);
      socket.off(`company-${companyId}-appMessage`, onAppMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user.companyId]);

  const handleSearchClick = () => {
    fetchTickets();
  };

  const handleStartDateChange = event => {
    setStartDate(event.target.value);
  };

  const handleEndDateChange = event => {
    setEndDate(event.target.value);
  };

  const updateTicket = updatedTicket => {
    setTickets(prevTickets =>
      prevTickets.map(ticket =>
        ticket.id === updatedTicket.id ? updatedTicket : ticket
      )
    );
  };

  const getOpportunityValue = (ticket) => {
    const customFields = ticket.contact.extraInfo || [];
    const valueField = customFields.find(field => field.name === 'valor');
    const opportunityValue = valueField ? parseFloat(valueField.value) : 0;
    return opportunityValue;
  };

  const organizeLanes = (fetchedTags = tags, fetchedTickets = tickets) => {
    const sortedTickets = [...fetchedTickets];

    if (sortOrder === 'ticketNumber') {
      sortedTickets.sort((a, b) => a.id - b.id);
    } else if (sortOrder === 'lastMessageTime') {
      sortedTickets.sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      );
    } else if (sortOrder === 'valorDesc') {
      sortedTickets.sort((a, b) => {
        const valorA = getOpportunityValue(a);
        const valorB = getOpportunityValue(b);
        return valorB - valorA;
      });
    }

    const defaultTickets = sortedTickets.filter(
      ticket => ticket.tags.length === 0
    );

    const lanesData = [
      {
        id: 'lane0',
        title: i18n.t('tagsKanban.laneDefault'),
        tickets: defaultTickets,
        color: '#757575',
      },
      ...fetchedTags.map(tag => {
        const taggedTickets = sortedTickets.filter(ticket =>
          ticket.tags.some(t => t.id === tag.id)
        );
        return {
          id: tag.id.toString(),
          title: tag.name,
          tickets: taggedTickets,
          color: tag.color || '#757575',
        };
      }),
    ];

    setLanes(lanesData);
  };

  useEffect(() => {
    organizeLanes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags, tickets, sortOrder]);

  const handleCardMove = async (ticketId, targetLaneId) => {
    ticketId = parseInt(ticketId, 10);
    try {
      await api.delete(`/ticket-tags/${ticketId}`);

      if (targetLaneId !== 'lane0') {
        await api.put(`/ticket-tags/${ticketId}/${targetLaneId}`);
        toast.success(i18n.t('kanban.ticketUpdatedSuccess'));
      } else {
        toast.success(i18n.t('kanban.ticketRemovedSuccess'));
      }

      fetchTickets();
    } catch (err) {
      console.log(err);
    }
  };

  // "Nueva etapa" lleva al mismo mantenimiento de siempre, con el embudo
  // activo preseleccionado.
  const handleAddColumnClick = () => {
    setMenuCrear(null);
    history.push(pipelineId ? `/tagsKanban?pipelineId=${pipelineId}` : '/tagsKanban');
  };

  const handleCrearEmbudo = async () => {
    const nombre = (nuevoEmbudo || '').trim();
    if (nombre.length < 2) return;
    setGuardandoEmbudo(true);
    try {
      const { data } = await api.post('/kanban/pipelines', { name: nombre });
      setPipelines(previos => [...previos, data]);
      setPipelineId(data.id);
      setNuevoEmbudo(null);
      toast.success(i18n.t('kanban.pipelineCreated'));
    } catch (err) {
      toastError(err);
    } finally {
      setGuardandoEmbudo(false);
    }
  };

  const embudoActivo = pipelines.find(p => p.id === pipelineId);
  const embudosFiltrados = pipelines.filter(p =>
    p.name.toLowerCase().includes(buscaEmbudo.toLowerCase())
  );

  const handleSortOrderChange = event => {
    setSortOrder(event.target.value);
  };

  return (
    <MainContainer>
      <MainHeader>
        {pipelines.length > 0 ? (
          <>
            <Button
              className={classes.selectorEmbudo}
              onClick={e => setMenuEmbudos(e.currentTarget)}
              endIcon={<ArrowDropDownIcon />}
            >
              {embudoActivo ? embudoActivo.name : i18n.t('kanban.pipeline')}
            </Button>
            <Menu
              anchorEl={menuEmbudos}
              open={Boolean(menuEmbudos)}
              onClose={() => setMenuEmbudos(null)}
              getContentAnchorEl={null}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
              {pipelines.length > EMBUDOS_CON_BUSCADOR && (
                <div className={classes.buscadorEmbudos}>
                  <TextField
                    size="small"
                    variant="outlined"
                    autoFocus
                    fullWidth
                    placeholder={i18n.t('kanban.searchPipeline')}
                    value={buscaEmbudo}
                    onChange={e => setBuscaEmbudo(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </div>
              )}
              {embudosFiltrados.map(p => (
                <MenuItem
                  key={p.id}
                  selected={p.id === pipelineId}
                  onClick={() => {
                    setPipelineId(p.id);
                    setMenuEmbudos(null);
                    setBuscaEmbudo('');
                  }}
                >
                  {p.name}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : (
          <Title>{i18n.t('Kanban')}</Title>
        )}
        <MainHeaderButtonsWrapper>
          <FormControl
            variant="outlined"
            size="small"
            className={classes.sortSelect}
          >
            <InputLabel htmlFor="sort-order-select">{i18n.t('kanban.sortOrder')}</InputLabel>
            <Select
              native
              value={sortOrder}
              onChange={handleSortOrderChange}
              label={i18n.t('kanban.sortOrder')}
              inputProps={{
                name: 'sortOrder',
                id: 'sort-order-select',
              }}
            >
              <option value="ticketNumber">{i18n.t('kanban.ticketNumber')}</option>
              <option value="lastMessageTime">{i18n.t('kanban.lastMessage')}</option>
              <option value="valorDesc">{i18n.t('kanban.valueDesc')}</option>
            </Select>
          </FormControl>
          <TextField
            label={i18n.t('kanban.startDate')}
            type="date"
            value={startDate}
            onChange={handleStartDateChange}
            InputLabelProps={{
              shrink: true,
            }}
            variant="outlined"
            className={classes.dateInput}
            size="small"
          />
          <TextField
            label={i18n.t('kanban.endDate')}
            type="date"
            value={endDate}
            onChange={handleEndDateChange}
            InputLabelProps={{
              shrink: true,
            }}
            variant="outlined"
            className={classes.dateInput}
            size="small"
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSearchClick}
            className={classes.button}
          >
            {i18n.t('kanban.search')}
          </Button>
          <Can
            role={user.profile}
            perform="dashboard:view"
            yes={() => (
              <>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={e => setMenuCrear(e.currentTarget)}
                  className={classes.button}
                  endIcon={<ArrowDropDownIcon />}
                >
                  {i18n.t('kanban.create')}
                </Button>
                <Menu
                  anchorEl={menuCrear}
                  open={Boolean(menuCrear)}
                  onClose={() => setMenuCrear(null)}
                  getContentAnchorEl={null}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <MenuItem onClick={handleAddColumnClick}>
                    {i18n.t('kanban.newStage')}
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setMenuCrear(null);
                      setNuevoEmbudo('');
                    }}
                  >
                    {i18n.t('kanban.newPipeline')}
                  </MenuItem>
                </Menu>
              </>
            )}
          />
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Dialog
        open={nuevoEmbudo !== null}
        onClose={() => setNuevoEmbudo(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{i18n.t('kanban.newPipeline')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            variant="outlined"
            size="small"
            label={i18n.t('kanban.pipelineName')}
            value={nuevoEmbudo || ''}
            onChange={e => setNuevoEmbudo(e.target.value)}
            onKeyPress={e => {
              if (e.key === 'Enter') handleCrearEmbudo();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNuevoEmbudo(null)} disabled={guardandoEmbudo}>
            {i18n.t('kanban.cancel')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCrearEmbudo}
            disabled={guardandoEmbudo || (nuevoEmbudo || '').trim().length < 2}
          >
            {i18n.t('kanban.saveValue')}
          </Button>
        </DialogActions>
      </Dialog>

      <Paper variant="outlined" className={classes.mainPaper}>
        <KanbanBoard
          lanes={lanes}
          onCardMove={handleCardMove}
          updateTicket={updateTicket}
        />
      </Paper>
    </MainContainer>
  );
};

export default Kanban;
