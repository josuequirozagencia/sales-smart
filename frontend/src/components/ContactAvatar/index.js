import React from "react";
import Avatar from "@material-ui/core/Avatar";

import { avatarColor, avatarInitials, onColor } from "../../theme/tokens";

/**
 * Avatar de un contacto: su foto si la tiene, y si no un circulo de color
 * con sus iniciales.
 *
 * Por que un componente y no repetirlo en cada pantalla
 * -----------------------------------------------------
 * El color tiene que ser el MISMO para el mismo contacto en toda la
 * aplicacion —lista, panel, grupos—; si no, deja de servir para
 * reconocerlo de un vistazo. Con la logica repetida en cada sitio, basta
 * que uno use el nombre como semilla y otro el id para que el mismo
 * contacto salga de dos colores. Aqui hay una sola definicion.
 *
 * Antes cada pantalla resolvia esto por su cuenta: la lista de
 * conversaciones no tenia iniciales —MUI pintaba su icono generico de
 * persona, igual para todos— y el panel de contacto hacia un
 * `name.charAt(0)` suelto, sin color y sin apellido.
 *
 * El color del texto lo decide onColor() sobre el fondo elegido, nunca se
 * fija blanco: si manana la paleta incluye un tono claro, las iniciales
 * siguen leyendose.
 */
const ContactAvatar = ({
  contact,
  size = 40,
  className,
  onClick,
  style = {},
  ...resto
}) => {
  const nombre = contact?.name || "";
  const foto = contact?.urlPicture || undefined;

  // El id es la semilla preferida: no cambia aunque renombren al contacto,
  // asi que el color tampoco. El nombre es el respaldo cuando no hay id.
  const semilla = contact?.id != null ? contact.id : nombre;
  const fondo = avatarColor(semilla);

  // Con foto no hace falta ni color ni iniciales: Avatar pinta la imagen.
  // Las iniciales se dejan igual como contenido, porque es lo que se ve si
  // la imagen no carga.
  const estilo = {
    width: size,
    height: size,
    // El tamano de letra sigue al del circulo para que no se salga en los
    // avatares pequenos ni quede diminuto en los grandes.
    fontSize: Math.max(11, Math.round(size * 0.38)),
    fontWeight: 600,
    // Sin foto manda el color calculado; con foto, transparente.
    backgroundColor: foto ? undefined : fondo,
    color: foto ? undefined : onColor(fondo),
    ...style,
  };

  return (
    <Avatar
      src={foto}
      alt={nombre}
      className={className}
      onClick={onClick}
      style={estilo}
      {...resto}
    >
      {avatarInitials(nombre)}
    </Avatar>
  );
};

export default ContactAvatar;
