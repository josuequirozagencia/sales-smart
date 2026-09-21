import { styled } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';

// 44px y no 56 para el conmutador de arriba.
//
// En un movil de 393x852 se iban 258px en barras antes de la primera
// conversacion: la del sistema, esta, la busqueda, los iconos y las pestanas.
// Cada fila que se recorta es media conversacion mas a la vista.
const TicketAdvancedLayout = styled(Paper)({
    height: `calc(100% - 48px)`,
    display: "grid",
    gridTemplateRows: "44px 1fr",
    "& .MuiBottomNavigation-root": {
        height: 44,
    },
    // La etiqueta de serie sube de 12 a 14px al seleccionarse y descoloca la
    // fila entera; con la barra mas baja se nota mas.
    "& .MuiBottomNavigationAction-label": {
        fontSize: "0.75rem",
        "&.Mui-selected": {
            fontSize: "0.75rem",
        },
    },
    "& .MuiBottomNavigationAction-root": {
        paddingTop: 2,
        minWidth: 0,
    },
})

export default TicketAdvancedLayout;