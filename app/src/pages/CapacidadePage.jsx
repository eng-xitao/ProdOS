import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";

/**
 * MRP II — compara a carga necessária (soma das quantidades das ordens
 * de produção abertas em cada etapa) com a capacidade disponível
 * (soma da capacidade dos Centros de Trabalho vinculados a cada etapa).
 */
export default function CapacidadePage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [hasWorkCenters, setHasWorkCenters] = useState(true);

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function calculate() {
    setLoading(true);

    const { data: stages } = await supabase
      .from("production_stages")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true });

    const { data: workCenters } = await supabase
      .from("work_centers")
      .select("id, stage_id, capacity, capacity_unit");

    const { data: orders } = await supabase
      .from("production_orders")
      .select("stage_id, quantity")
      .not("stage_id", "is", null);

    setHasWorkCenters((workCenters ?? []).length > 0);

    const capacityByStage = {};
    (workCenters ?? []).forEach((wc) => {
      if (!wc.stage_id) return;
      if (!capacityByStage[wc.stage_id]) capacityByStage[wc.stage_id] = { total: 0, unit: wc.capacity_unit };
      capacityByStage[wc.stage_id].total += Number(wc.capacity);
    });

    const loadByStage = {};
    (orders ?? []).forEach((o) => {
      loadByStage[o.stage_id] = (loadByStage[o.stage_id] ?? 0) + Number(o.quantity);
    });

    const result = (stages ?? []).map((stage) => {
      const capacity = capacityByStage[stage.id]?.total ?? 0;
      const unit = capacityByStage[stage.id]?.unit ?? "—";
      const load = loadByStage[stage.id] ?? 0;
      return {
        id: stage.id,
        name: stage.name,
        capacity,
        unit,
        load,
        overloaded: capacity > 0 && load > capacity,
        noCapacityDefined: capacity === 0,
      };
    });

    setRows(result);
    setLoading(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Capacidade (MRP II)</h1>
        <p style={styles.subtitle}>
          Compara a carga das ordens de produção abertas com a capacidade disponível em cada
          etapa, somada a partir dos Centros de Trabalho. Uma primeira visão simplificada —
          próximas versões podem considerar tempo por unidade e horizonte de datas.
        </p>
      </header>

      {!hasWorkCenters && (
        <div style={styles.notice}>
          Nenhum Centro de Trabalho cadastrado ainda, então não é possível comparar com capacidade
          disponível. Cadastre em <Link to="/centros-trabalho" style={styles.link}>Cadastro → Centros de Trabalho</Link>.
        </div>
      )}

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : rows.length === 0 ? (
        <p style={styles.dim}>Nenhuma etapa configurada ainda.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Etapa</th>
                <th style={styles.th}>Capacidade disponível</th>
                <th style={styles.th}>Carga necessária</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>{r.name}</td>
                  <td style={styles.td}>{r.noCapacityDefined ? "—" : `${r.capacity.toLocaleString("pt-BR")} ${r.unit}`}</td>
                  <td style={styles.td}>{r.load.toLocaleString("pt-BR")}</td>
                  <td style={styles.td}>
                    {r.noCapacityDefined ? (
                      <span style={{ color: "var(--text-dim)" }}>Sem centro de trabalho</span>
                    ) : r.overloaded ? (
                      <span style={{ color: "var(--red)", fontWeight: 700 }}>Sobrecarga</span>
                    ) : (
                      <span style={{ color: "var(--green)", fontWeight: 700 }}>OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  notice: {
    background: "rgba(232,163,61,0.1)",
    border: "1px solid var(--amber)",
    color: "var(--text)",
    borderRadius: "var(--radius)",
    padding: "12px 16px",
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 20,
    maxWidth: 640,
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--text-dim)",
    padding: "10px 14px",
    background: "var(--panel)",
    borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
};
