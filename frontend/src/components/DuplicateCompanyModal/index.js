import React, { useEffect, useState } from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
} from "@material-ui/core";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { useDate } from "../../hooks/useDate";
import {
  useEstilosClonado,
  listaTraducida,
  BloqueLista,
  ResumenClonado,
} from "../CloneCompanyConfigModal/comun";

/**
 * Duplicar una empresa: crea otra con su plan y su configuracion.
 *
 * Solo para superadministrador, desde Configuracion > Empresas; el backend
 * lo vuelve a comprobar. La empresa nueva hereda plan, vencimiento y
 * facturacion, recibe la configuracion clonada y nace con un unico usuario:
 * el admin cuyo email y contrasena se escriben aqui. Que lleva y que no:
 * DuplicateCompanyService y docs/CLONAR_EMPRESA.md.
 */

// Nombres y emails escritos por el usuario: i18n no los escapa, ya lo hace React.
const SIN_ESCAPAR = { interpolation: { escapeValue: false } };

const VACIO = { name: "", email: "", password: "", phone: "", document: "" };
const EMAIL = /^\S+@\S+\.\S+$/;

// Las recurrencias se guardan con su codigo original en portugues.
const RECURRENCIAS = {
  MENSAL: "compaies.table.monthly",
  BIMESTRAL: "compaies.table.bimonthly",
  TRIMESTRAL: "compaies.table.quarterly",
  SEMESTRAL: "compaies.table.semester",
  ANUAL: "compaies.table.yearly",
};

const DuplicateCompanyModal = ({ open, onClose, company, onDuplicated }) => {
  const classes = useEstilosClonado();
  const { dateToClient } = useDate();

  // Se guarda la empresa aparte: al cerrar, el padre pasa company a null
  // antes de que termine la animacion de salida del dialogo.
  const [empresa, setEmpresa] = useState(null);
  const [valores, setValores] = useState(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    if (!open || !company) return;
    setEmpresa(company);
    setValores({
      name: `${company.name} (copia)`,
      email: "",
      password: "",
      phone: company.phone || "",
      document: company.document || "",
    });
    setResultado(null);
  }, [open, company]);

  if (!empresa) return null;

  const bloqueado = enviando || Boolean(resultado);

  const valido =
    valores.name.trim().length >= 2 &&
    EMAIL.test(valores.email.trim()) &&
    valores.password.length >= 5;

  const cambiar = (campo) => (e) => {
    const { value } = e.target;
    setValores((v) => ({ ...v, [campo]: value }));
  };

  const duplicar = async () => {
    setEnviando(true);
    try {
      const { data } = await api.post(`/companies/${empresa.id}/duplicate`, {
        ...valores,
        name: valores.name.trim(),
        email: valores.email.trim(),
      });
      setResultado(data);
      toast.success(i18n.t("duplicateCompany.done", { name: data.empresa.name, ...SIN_ESCAPAR }));
      if (onDuplicated) onDuplicated(data);
    } catch (err) {
      toastError(err);
    }
    setEnviando(false);
  };

  const si = i18n.t("duplicateCompany.inherits.yes");
  const no = i18n.t("duplicateCompany.inherits.no");
  const recurrencia = RECURRENCIAS[empresa.recurrence]
    ? i18n.t(RECURRENCIAS[empresa.recurrence])
    : empresa.recurrence;

  const heredado = [
    `${i18n.t("duplicateCompany.inherits.plan")}: ${empresa.plan?.name || "—"}`,
    `${i18n.t("duplicateCompany.inherits.dueDate")}: ${
      empresa.dueDate ? dateToClient(empresa.dueDate) : "—"
    }${recurrencia ? ` (${recurrencia})` : ""}`,
    `${i18n.t("duplicateCompany.inherits.currency")}: ${empresa.currency || "BRL"}`,
    `${i18n.t("duplicateCompany.inherits.invoice")}: ${
      empresa.generateInvoice === false ? no : si
    }`,
    `${i18n.t("duplicateCompany.inherits.active")}: ${
      empresa.status === false ? no : si
    }`,
  ];

  const campo = (nombre, props = {}) => (
    <TextField
      className={classes.campo}
      variant="outlined"
      size="small"
      label={i18n.t(`duplicateCompany.fields.${nombre}`)}
      value={valores[nombre]}
      onChange={cambiar(nombre)}
      disabled={bloqueado}
      {...props}
    />
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>
        {i18n.t("duplicateCompany.title", { name: empresa.name, ...SIN_ESCAPAR })}
      </DialogTitle>

      <DialogContent dividers>
        <div className={classes.ayuda}>{i18n.t("duplicateCompany.help")}</div>

        <div className={classes.fila}>
          {campo("name", { required: true })}
          {campo("email", {
            required: true,
            type: "email",
            autoComplete: "off",
            helperText: i18n.t("duplicateCompany.fields.emailHelp"),
          })}
        </div>
        <div className={classes.fila}>
          {campo("password", {
            required: true,
            type: "password",
            // Sin esto el navegador rellena la contrasena del superadmin.
            autoComplete: "new-password",
            helperText: i18n.t("duplicateCompany.fields.passwordHelp"),
          })}
          {campo("phone")}
          {campo("document")}
        </div>

        {!resultado && (
          <>
            <div className={classes.columnas}>
              <BloqueLista
                titulo={i18n.t("duplicateCompany.inheritsTitle")}
                items={heredado}
              />
              <BloqueLista
                titulo={i18n.t("duplicateCompany.copiesTitle")}
                items={listaTraducida("cloneCompany.copiesList")}
              />
              <BloqueLista
                titulo={i18n.t("duplicateCompany.notCopies")}
                items={listaTraducida("duplicateCompany.notCopiesList")}
              />
            </div>

            <BloqueLista
              className={classes.separado}
              titulo={i18n.t("duplicateCompany.notesTitle")}
              items={listaTraducida("duplicateCompany.notes")}
            />
          </>
        )}

        {resultado && (
          <>
            <BloqueLista
              className={classes.separado}
              titulo={i18n.t("duplicateCompany.done", { name: resultado.empresa.name, ...SIN_ESCAPAR })}
              items={[
                i18n.t("duplicateCompany.created", {
                  id: resultado.empresa.id,
                  email: resultado.empresa.email,
                  ...SIN_ESCAPAR,
                }),
              ]}
            />
            <div className={classes.separado}>
              <ResumenClonado resumen={resultado.clon} />
            </div>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={enviando}>
          {resultado
            ? i18n.t("duplicateCompany.close")
            : i18n.t("duplicateCompany.cancel")}
        </Button>
        {!resultado && (
          <Button
            color="primary"
            variant="contained"
            onClick={duplicar}
            disabled={!valido || enviando}
          >
            {enviando ? (
              <>
                <CircularProgress size={16} style={{ marginRight: 8 }} />
                {i18n.t("duplicateCompany.duplicating")}
              </>
            ) : (
              i18n.t("duplicateCompany.confirm")
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DuplicateCompanyModal;
