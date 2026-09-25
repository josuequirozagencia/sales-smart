import { styled } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';

// Una sola fila: dentro va la lista o la conversacion.
//
// Tenia dos, la primera para un conmutador propio ("Ticket" / "Atenciones")
// que se retiro: en un movil de 852px de alto se iban 229 en barras antes de
// la primera conversacion, y ese control era redundante con tocar una
// conversacion para abrirla y con la flecha de volver.
const TicketAdvancedLayout = styled(Paper)({
    height: `calc(100% - 48px)`,
    display: "grid",
    gridTemplateRows: "1fr"
})

export default TicketAdvancedLayout;
