import React from "react";
import SvgIcon from "@material-ui/core/SvgIcon";

/**
 * Set de iconos en trazo (outline), estilo "moderno" tipo Feather/Lucide,
 * para reemplazar los iconos rellenos de @material-ui/icons en la seccion
 * de conversaciones (MessageInput, MessagesList, ContactDrawer, ticket
 * list, chat header).
 *
 * Por que un componente propio y no una libreria nueva
 * ------------------------------------------------------
 * Instalar una libreria de iconos (lucide-react, feather-icons, etc.)
 * significaria un npm install que esta sesion no puede ejecutar en tu
 * maquina. En vez de eso, cada icono es un <SvgIcon> de Material-UI —el
 * mismo componente base que usan los iconos de @material-ui/icons por
 * dentro— con un dibujo de trazo propio. Al ser el mismo componente base,
 * hereda automaticamente todo lo que ya depende de un icono de MUI: la
 * clase MuiSvgIcon-root (por si algun estilo la selecciona), el prop
 * fontSize ("small"/"default"/"large"/"inherit"), el prop color, y el
 * tamano via className o style. Los sitios donde se usan estos iconos NO
 * cambian: unicamente cambia de donde se importan.
 *
 * Los iconos de marca (WhatsApp, Facebook, Instagram) NO estan aqui a
 * proposito — igual que en theme/tokens.js, la identidad de un servicio de
 * terceros no se unifica con el resto del sistema visual.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const dot = { fill: "currentColor", stroke: "none" };

function mk(children, viewBox = "0 0 24 24") {
  return React.forwardRef(function Icon(props, ref) {
    return (
      <SvgIcon ref={ref} viewBox={viewBox} {...props}>
        {children}
      </SvgIcon>
    );
  });
}

/* ---------------------------------------------------------------- */
/* Composer / MessageInput                                            */
/* ---------------------------------------------------------------- */

export const AttachFile = mk(
  <path
    d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L10.13 18.1a2 2 0 0 1-2.83-2.83l8.49-8.48"
    {...stroke}
  />
);

export const Send = mk(<path d="m22 2-7 20-4-9-9-4Z" {...stroke} />);

export const Mic = mk(
  <>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" {...stroke} />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" {...stroke} />
  </>
);

export const Mood = mk(
  <>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" {...stroke} />
  </>
);

export const MoreVert = mk(
  <>
    <circle cx="12" cy="5" r="1.3" {...dot} />
    <circle cx="12" cy="12" r="1.3" {...dot} />
    <circle cx="12" cy="19" r="1.3" {...dot} />
  </>
);

export const PermMedia = mk(
  <>
    <rect x="2" y="6" width="15" height="15" rx="2" {...stroke} />
    <path d="M7 15V4a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2" {...stroke} />
  </>
);

export const Person = mk(
  <>
    <circle cx="12" cy="8" r="4" {...stroke} />
    <path d="M4 21a8 8 0 0 1 16 0" {...stroke} />
  </>
);
export const PermIdentity = Person;

export const Reply = mk(
  <>
    <path d="m9 14-5-5 5-5" {...stroke} />
    <path d="M4 9h11a5 5 0 0 1 5 5v2" {...stroke} />
  </>
);

export const Duo = mk(
  <>
    <rect x="2" y="6" width="14" height="12" rx="2" {...stroke} />
    <path d="m22 8-6 4 6 4Z" {...stroke} />
  </>
);
export const Videocam = Duo;

export const Timer = mk(
  <>
    <circle cx="12" cy="13" r="8" {...stroke} />
    <path d="M12 9v4l3 2M9 2h6" {...stroke} />
  </>
);
export const AccessTime = mk(
  <>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path d="M12 7v5l3 2" {...stroke} />
  </>
);

export const Info = mk(
  <>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path d="M12 16v-4M12 8h.01" {...stroke} />
  </>
);
export const InfoOutlined = Info;

export const AccountTree = mk(
  <>
    <circle cx="6" cy="6" r="2.2" {...stroke} />
    <circle cx="6" cy="18" r="2.2" {...stroke} />
    <circle cx="18" cy="12" r="2.2" {...stroke} />
    <path d="M6 8.2V15.8M8.1 6H13a4 4 0 0 1 4 4v0" {...stroke} />
  </>
);

export const Add = mk(<path d="M12 5v14M5 12h14" {...stroke} />);

export const CameraAlt = mk(
  <>
    <path
      d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
      {...stroke}
    />
    <circle cx="12" cy="13" r="4" {...stroke} />
  </>
);

export const Clear = mk(<path d="M18 6 6 18M6 6l12 12" {...stroke} />);
export const Close = Clear;
export const HighlightOff = mk(
  <>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path d="m15 9-6 6M9 9l6 6" {...stroke} />
  </>
);

export const CheckCircleOutline = mk(
  <>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path d="m8 12 3 3 5-6" {...stroke} />
  </>
);
export const Done = mk(<path d="M20 6 9 17l-5-5" {...stroke} />);
export const DoneAll = mk(
  <>
    <path d="m18 6-8 9-4-4" {...stroke} />
    <path d="m22 6-8.5 9.5" {...stroke} />
  </>
);

export const Comment = mk(
  <path
    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
    {...stroke}
  />
);
export const Message = Comment;

export const Create = mk(
  <>
    <path d="M12 20h9" {...stroke} />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" {...stroke} />
  </>
);

export const Description = mk(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...stroke} />
    <path d="M14 2v6h6" {...stroke} />
    <path d="M9 13h6M9 17h6M9 9h1" {...stroke} />
  </>
);
export const InsertDriveFile = mk(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...stroke} />
    <path d="M14 2v6h6" {...stroke} />
  </>
);

// ContactDrawer lo importa con el sufijo Icon, que es como se nombra al
// traerlo suelto de @material-ui/icons. Sin este alias el import no
// resuelve: no falla la compilacion, llega como undefined y React revienta
// al pintar la pestana de documentos. Mismo criterio que InfoOutlined,
// Close, Videocam, PermIdentity y Message, mas abajo y mas arriba.
export const InsertDriveFileIcon = InsertDriveFile;

/* ---------------------------------------------------------------- */
/* Toolbar de formato (respuestas rapidas)                            */
/* ---------------------------------------------------------------- */

export const FormatBoldIcon = mk(
  <path
    d="M6 4h6a3.5 3.5 0 0 1 0 7H6zM6 11h7a3.5 3.5 0 0 1 0 7H6z"
    {...stroke}
  />
);
export const FormatItalicIcon = mk(<path d="M11 4h6M7 20h6M14 4 10 20" {...stroke} />);
export const FormatStrikethroughIcon = mk(
  <>
    <path d="M4 12h16" {...stroke} />
    <path
      d="M8 6.5C8 5 9.5 4 12 4s4 1 4 2.5c0 1-.8 1.8-2 2.3M16 17.5c0 1.5-1.5 2.5-4 2.5s-4-1-4-2.5"
      {...stroke}
    />
  </>
);
export const CodeIcon = mk(<path d="m8 6-6 6 6 6M16 6l6 6-6 6" {...stroke} />);
export const FormatListNumberedIcon = mk(
  <>
    <path d="M10 6h11M10 12h11M10 18h11" {...stroke} />
    <path d="M4 6h1v4M4 10h2M4 14a1 1 0 1 1 1.5-.87L4 15h2" {...stroke} />
  </>
);
export const FormatListBulletedIcon = mk(
  <>
    <path d="M9 6h12M9 12h12M9 18h12" {...stroke} />
    <circle cx="4" cy="6" r="1.1" {...dot} />
    <circle cx="4" cy="12" r="1.1" {...dot} />
    <circle cx="4" cy="18" r="1.1" {...dot} />
  </>
);
export const FormatQuoteIcon = mk(
  <>
    <path d="M7 7a3 3 0 0 0-3 3v3h3v4H4v-1a6 6 0 0 1 6-6V7Z" {...stroke} />
    <path d="M17 7a3 3 0 0 0-3 3v3h3v4h-3v-1a6 6 0 0 1 6-6V7Z" {...stroke} />
  </>
);
export const FormatClearIcon = mk(
  <>
    <path
      d="m7 21-4-4a2 2 0 0 1 0-2.8L14.6 3a2 2 0 0 1 2.8 0l3.6 3.6a2 2 0 0 1 0 2.8L11 20"
      {...stroke}
    />
    <path d="M22 21H7" {...stroke} />
  </>
);

/* ---------------------------------------------------------------- */
/* MessagesList                                                       */
/* ---------------------------------------------------------------- */

export const ExpandMore = mk(<path d="m6 9 6 6 6-6" {...stroke} />);
export const GetApp = mk(
  <>
    <path d="M12 3v12" {...stroke} />
    <path d="m7 10 5 5 5-5" {...stroke} />
    <path d="M4 21h16" {...stroke} />
  </>
);
export const LockIcon = mk(
  <>
    <rect x="4" y="11" width="16" height="9" rx="2" {...stroke} />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" {...stroke} />
  </>
);
export const LockOpenIcon = mk(
  <>
    <rect x="4" y="11" width="16" height="9" rx="2" {...stroke} />
    <path d="M8 11V7a4 4 0 0 1 7.5-2" {...stroke} />
  </>
);

/* ---------------------------------------------------------------- */
/* ContactDrawer                                                      */
/* ---------------------------------------------------------------- */

export const CloseIcon = Clear;
export const GroupIcon = mk(
  <>
    <circle cx="9" cy="8" r="3.2" {...stroke} />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" {...stroke} />
    <circle cx="17" cy="9" r="2.6" {...stroke} />
    <path d="M15.5 13.2A5 5 0 0 1 21.5 20" {...stroke} />
  </>
);
export const PermIdentityIcon = Person;
export const PersonIcon = Person;
export const CreateIcon = Create;
export const MonetizationOnOutlinedIcon = mk(
  <>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path
      d="M12 6v12M15 9.5c0-1.4-1.4-2.5-3-2.5s-3 1-3 2.3c0 1.2.9 1.8 3 2.2 2.1.4 3 1 3 2.3 0 1.3-1.4 2.2-3 2.2s-3-1-3-2.4"
      {...stroke}
    />
  </>
);
export const EventAvailableOutlinedIcon = mk(
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" {...stroke} />
    <path d="M16 3v4M8 3v4M3 11h18" {...stroke} />
    <path d="m9 16 2 2 4-4" {...stroke} />
  </>
);
export const SearchIcon = mk(
  <>
    <circle cx="11" cy="11" r="7" {...stroke} />
    <path d="m21 21-4.3-4.3" {...stroke} />
  </>
);
export const ClearIcon = Clear;
export const BlockIcon = mk(
  <>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path d="m5.5 5.5 13 13" {...stroke} />
  </>
);
export const ImageIcon = mk(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" {...stroke} />
    <circle cx="8.5" cy="8.5" r="1.5" {...dot} />
    <path d="m21 15-5-5L5 21" {...stroke} />
  </>
);
export const VideocamIcon = Duo;
export const AudiotrackIcon = mk(
  <>
    <path d="M9 18V5l11-2v13" {...stroke} />
    <circle cx="6" cy="18" r="3" {...stroke} />
    <circle cx="17" cy="16" r="3" {...stroke} />
  </>
);
export const LinkIcon = mk(
  <>
    <path d="M10 13a5 5 0 0 0 7.5.4l2-2a5 5 0 0 0-7-7l-1 1" {...stroke} />
    <path d="M14 11a5 5 0 0 0-7.5-.4l-2 2a5 5 0 0 0 7 7l1-1" {...stroke} />
  </>
);
export const InfoIcon = Info;
export const MessageIcon = Comment;

/* ---------------------------------------------------------------- */
/* Ticket list / chat header                                          */
/* ---------------------------------------------------------------- */

export const SwapHoriz = mk(
  <>
    <path d="m17 2 4 4-4 4" {...stroke} />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" {...stroke} />
    <path d="m7 22-4-4 4-4" {...stroke} />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" {...stroke} />
  </>
);
export const Replay = mk(
  <>
    <path d="M21 12a9 9 0 1 1-3-6.7" {...stroke} />
    <path d="M21 3v6h-6" {...stroke} />
  </>
);
export const Visibility = mk(
  <>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" {...stroke} />
    <circle cx="12" cy="12" r="3" {...stroke} />
  </>
);

// Acciones de la cabecera del chat. Son las que ya existian ahi con
// iconos rellenos de Material-UI; aqui estan redibujadas en trazo para
// que la barra no mezcle dos lenguajes graficos.
export const ArrowBack = mk(
  <>
    <path d="M19 12H5" {...stroke} />
    <path d="m12 19-7-7 7-7" {...stroke} />
  </>
);
export const Undo = mk(
  <>
    <path d="m9 14-5-5 5-5" {...stroke} />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" {...stroke} />
  </>
);
export const ContentCopy = mk(
  <>
    <rect x="9" y="9" width="13" height="13" rx="2" {...stroke} />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...stroke} />
  </>
);
export const Bolt = mk(
  <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" {...stroke} />
);
export const Wallet = mk(
  <>
    <path d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2" {...stroke} />
    <rect x="3" y="7" width="18" height="12" rx="2" {...stroke} />
    <path d="M21 11h-4a2 2 0 0 0 0 4h4" {...stroke} />
  </>
);

// Nombres con sufijo Icon, que es como los importan los ficheros que ya
// existian. Ver la nota del bloque de alias de mas arriba.
export const ArrowBackIcon = ArrowBack;
export const UndoIcon = Undo;
export const FileCopyIcon = ContentCopy;
export const FlashOnIcon = Bolt;
export const AccountBalanceWalletIcon = Wallet;
export const SwapHorizOutlined = SwapHoriz;
export const HighlightOffIcon = HighlightOff;
