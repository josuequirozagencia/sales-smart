import React, { useEffect, useState } from "react";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import FormHelperText from "@material-ui/core/FormHelperText";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { guardarLimite } from "../../services/inactividadSesion";

// Tiempo sin actividad tras el que se cierra la sesion de los usuarios de la
// empresa. Solo lo ve y lo cambia el administrador (el backend lo exige
// tambien). Va por su propia ruta, validada, y no por /companySettings.
const OPCIONES_MINUTOS = [15, 30, 60, 120, 180, 240, 300, 480, 720, 1440];

const etiqueta = (minutos) => {
  if (minutos < 60) {
    return i18n.t("settings.settings.options.sessionInactivityMinutes", { n: minutos });
  }
  const horas = minutos / 60;
  return horas === 1
    ? i18n.t("settings.settings.options.sessionInactivityHour")
    : i18n.t("settings.settings.options.sessionInactivityHours", { n: horas });
};

export default function SessionInactivity({ className }) {
  const [minutos, setMinutos] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api
      .get("/session-settings")
      .then(({ data }) => setMinutos(data?.inactivityMinutes ?? ""))
      .catch(toastError);
  }, []);

  const cambiar = async (e) => {
    const previo = minutos;
    const nuevo = e.target.value;
    setMinutos(nuevo);
    setGuardando(true);
    try {
      const { data } = await api.put("/session-settings", { inactivityMinutes: nuevo });
      // La propia sesion toma el limite al momento; las demas llegan por socket.
      guardarLimite(data?.inactivityMinutes);
      toast.success(i18n.t("settings.settings.options.sessionInactivitySaved"));
    } catch (err) {
      setMinutos(previo);
      toastError(err);
    } finally {
      setGuardando(false);
    }
  };

  // Un valor guardado que no este en la lista (se puso por otra via) se
  // muestra igualmente en vez de dejar el selector en blanco.
  const opciones =
    minutos !== "" && !OPCIONES_MINUTOS.includes(minutos)
      ? [...OPCIONES_MINUTOS, minutos].sort((a, b) => a - b)
      : OPCIONES_MINUTOS;

  return (
    <Grid xs={12} sm={6} md={4} item>
      <FormControl className={className}>
        <InputLabel id="SessionInactivity-label">
          {i18n.t("settings.settings.options.sessionInactivity")}
        </InputLabel>
        <Select
          labelId="SessionInactivity-label"
          value={minutos}
          onChange={cambiar}
          disabled={minutos === "" || guardando}
        >
          {opciones.map((m) => (
            <MenuItem key={m} value={m}>
              {etiqueta(m)}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          {guardando
            ? i18n.t("settings.settings.options.updating")
            : i18n.t("settings.settings.options.sessionInactivityHelp")}
        </FormHelperText>
      </FormControl>
    </Grid>
  );
}
