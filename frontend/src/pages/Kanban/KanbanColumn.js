import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Droppable } from 'react-beautiful-dnd';
import KanbanCard from './KanbanCard';
import { Typography } from '@material-ui/core';
import { useCurrency } from '../../utils/currencyUtils';

// Columna del tablero.
//
// Antes el color de la etapa pintaba el DIV ENTERO —encabezado y tarjetas—, y
// el tablero quedaba como un mosaico de bloques de color donde las tarjetas
// blancas competian con el fondo. Ahora el color va solo en una barra sobre el
// encabezado, como en un tablero de GoHighLevel, y el cuerpo queda en un gris
// neutro. El total, que ocupaba un renglon propio, va en la misma linea del
// titulo junto al numero de tarjetas.

const useStyles = makeStyles(theme => ({
  column: {
    backgroundColor:
      theme.mode === 'light'
        ? theme.palette.tokens.surface.surfaceSecondary
        : theme.palette.tokens.surface.surface,
    border: `1px solid ${theme.palette.tokens.border.border}`,
    borderRadius: 8,
    // 244 en vez de 272: entran dos columnas mas en una pantalla de 1366.
    minWidth: 244,
    maxWidth: 244,
    marginRight: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
  },
  // La barra de color es lo unico que lleva el color de la etapa.
  barraColor: props => ({
    height: 6,
    backgroundColor: props.color || theme.palette.tokens.text.muted,
    flexShrink: 0,
  }),
  columnHeader: {
    padding: theme.spacing(1, 1.25, 0.75),
  },
  tituloFila: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    minWidth: 0,
  },
  columnTitle: {
    fontWeight: 700,
    fontSize: '0.8125rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: theme.palette.tokens.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  conteo: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: theme.palette.tokens.text.secondary,
    backgroundColor: theme.palette.tokens.surface.surface,
    border: `1px solid ${theme.palette.tokens.border.border}`,
    borderRadius: 999,
    padding: '0 6px',
    flexShrink: 0,
  },
  totalValue: {
    marginLeft: 'auto',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.tokens.text.secondary,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
  cardList: {
    flexGrow: 1,
    overflowY: 'auto',
    ...theme.scrollbarStyles,
    maxHeight: 'calc(100vh - 200px)',
    padding: theme.spacing(0, 1, 1),
  },
}));

const KanbanColumn = ({ id, title, tickets, color, updateTicket }) => {
  const classes = useStyles({ color });
  const { formatCurrency } = useCurrency();

  const totalValue = tickets.reduce((acc, ticket) => {
    const customFields = ticket.contact.extraInfo || [];
    const valueField = customFields.find(field => field.name === 'valor');
    const opportunityValue = valueField ? parseFloat(valueField.value) : 0;
    return acc + opportunityValue;
  }, 0);

  return (
    <Droppable droppableId={id}>
      {(provided, snapshot) => (
        <div
          className={classes.column}
          ref={provided.innerRef}
          {...provided.droppableProps}
        >
          <div className={classes.barraColor} />
          <div className={classes.columnHeader}>
            <div className={classes.tituloFila}>
              <Typography className={classes.columnTitle} title={title}>
                {title}
              </Typography>
              <span className={classes.conteo}>{tickets.length}</span>
              <span className={classes.totalValue}>
                {formatCurrency(totalValue)}
              </span>
            </div>
          </div>
          <div className={classes.cardList}>
            {tickets.map((ticket, index) => (
              <KanbanCard
                key={ticket.id}
                ticket={ticket}
                index={index}
                updateTicket={updateTicket}
              />
            ))}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
};

export default KanbanColumn;
