import { useCallback, useEffect, useState } from "react";

import api from "../services/api";
import toastError from "../errors/toastError";

/**
 * Embudo y etapa del Kanban de un ticket.
 *
 * Esta logica vivia dentro de TagsKanbanContainer, que ademas pedia todas las
 * etapas de la empresa sin filtrar: desde que hay varios embudos, eso mezclaba
 * las de todos los tableros sin decir a cual pertenece cada una. Aqui se
 * resuelve una vez y la usan tanto la ficha del contacto como el registro de
 * venta.
 *
 * A que embudo pertenece el ticket se deduce de la lista de etapas y NO de
 * ticket.tags: las etiquetas que devuelve un ticket traen solo id, nombre y
 * color, sin pipelineId. Por eso el arranque pide las etapas sin filtrar (una
 * vez) y de ahi sale tanto el embudo del ticket como las opciones a mostrar;
 * cambiar de embudo a mano ya pide solo las de ese embudo.
 *
 * Mover de etapa es lo mismo que hacia el selector de la ficha: quitar la
 * etiqueta que tuviera el ticket y poner la nueva. Nada nuevo en el backend.
 */
const useTicketPipelineStage = (ticket, activo = true) => {
  const [pipelines, setPipelines] = useState([]);
  const [pipelineId, setPipelineId] = useState("");
  const [stages, setStages] = useState([]);
  const [stageId, setStageId] = useState("");
  const [loading, setLoading] = useState(false);
  // Embudo al que pertenece la etapa que ya tenia el ticket: volver a el
  // devuelve su etapa, en vez de dejar el selector en blanco.
  const [embudoDelTicket, setEmbudoDelTicket] = useState(null);

  const etapaDelTicket = ticket?.tags?.[0]?.id ?? null;

  useEffect(() => {
    if (!activo) return undefined;
    let vigente = true;
    setLoading(true);

    const arrancar = async () => {
      try {
        const [respPipelines, respEtapas] = await Promise.all([
          api.get("/kanban/pipelines"),
          api.get("/tag/kanban/")
        ]);
        if (!vigente) return;

        const lista = Array.isArray(respPipelines.data) ? respPipelines.data : [];
        const todas = respEtapas.data?.lista || [];
        setPipelines(lista);

        const suya = todas.find(t => t.id === etapaDelTicket);
        // Si el embudo de su etapa ya no existe —lo borraron—, se cae al de
        // referencia, como cuando el ticket no tiene etapa.
        const delTicket = lista.find(p => p.id === suya?.pipelineId);
        const porDefecto = lista.find(p => p.isDefault) || lista[0];
        const elegido = delTicket?.id ?? porDefecto?.id ?? "";

        setEmbudoDelTicket(delTicket?.id ?? null);
        setPipelineId(elegido);
        setStages(
          elegido ? todas.filter(t => t.pipelineId === elegido) : todas
        );
        setStageId(etapaDelTicket ?? "");
      } catch (err) {
        if (!vigente) return;
        setPipelines([]);
        setStages([]);
      } finally {
        if (vigente) setLoading(false);
      }
    };

    arrancar();

    return () => {
      vigente = false;
    };
  }, [activo, etapaDelTicket]);

  // Cambiar de embudo a mano deja la etapa en blanco hasta elegir una nueva:
  // la que estaba es de otro tablero. Volver al embudo del ticket recupera la
  // suya.
  const cambiarPipeline = useCallback(
    async id => {
      setPipelineId(id);
      setStageId(id === embudoDelTicket ? etapaDelTicket ?? "" : "");

      try {
        const { data } = await api.get("/tag/kanban/", {
          params: id ? { pipelineId: id } : {}
        });
        setStages(data?.lista || []);
      } catch (err) {
        setStages([]);
      }
    },
    [embudoDelTicket, etapaDelTicket]
  );

  const selectStage = useCallback(
    async tagId => {
      if (!ticket?.id) return;
      const anterior = stageId;
      setStageId(tagId || "");

      try {
        // Solo se borra si habia algo que borrar.
        if (anterior) await api.delete(`/ticket-tags/${ticket.id}`);
        if (tagId) await api.put(`/ticket-tags/${ticket.id}/${tagId}`);
      } catch (err) {
        setStageId(anterior);
        toastError(err);
      }
    },
    [ticket?.id, stageId]
  );

  return {
    pipelines,
    pipelineId,
    setPipelineId: cambiarPipeline,
    stages,
    stageId,
    selectStage,
    loading,
  };
};

export default useTicketPipelineStage;
