import React from "react";

import { grey } from "@material-ui/core/colors";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import InstagramIcon from "@material-ui/icons/Instagram";
import FacebookIcon from "@material-ui/icons/Facebook";

// El desplazamiento de -5px lo necesita la lista de conversaciones, donde
// el icono va dentro de una linea de texto. En una fila ya alineada al
// centro sobra, asi que se deja como valor por defecto y quien lo llame
// puede pasar su propio style para anularlo.
const ConnectionIcon = ({ connectionType, className, style }) => {
    const base = { marginBottom: "-5px", ...style };

    return (
        <React.Fragment>
            {connectionType === 'whatsapp' && <WhatsAppIcon fontSize="small" className={className} style={{ ...base, color: "#25D366" }} />}
            {connectionType === 'instagram' && <InstagramIcon fontSize="small" className={className} style={{ ...base, color: "#e1306c" }} />}
            {connectionType === 'facebook' && <FacebookIcon fontSize="small" className={className} style={{ ...base, color: "#3b5998" }} />}
        </React.Fragment>
    );
};

export default ConnectionIcon;
