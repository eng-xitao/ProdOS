import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";

const WEEKS_HORIZON = 8;

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day; // volta pra segunda-feira
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatWeekLabel(weekStart) {
  const end = addDays(weekStart, 6);
  return `${weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} – ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

function weekKey(date) {
  return startOfWeek(date).toISOString().slice(0, 10);
}

/**
 * Plano Mestre de Produção (MPS): pega as Ordens de Produção em aberto
 * e monta duas visões — (1) um timeline semanal de cada ordem, do
 * início planejado ao prazo, colorido pelo % já produzido (usa os
 * apontamentos parciais); (2) carga x capacidade por etapa, mas agora
 * dentro de uma semana específica escolhida, ao invés de tudo junto.
 */
export default function CapacidadePage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [stages, setStages] = useState([]);
  const [workCenters, setWorkCenters] = useState([]);
  const [hasWorkCenters, setHasWorkCenters] = useState(true);

  const weeks = useMemo(() => {
    const first = startOfWeek(new Date());
    return Array.from({ length: WEEKS_HORIZON }, (_, i) => addDays(first, i * 7));
  }, []);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);

  useEffect(() => {
    if (company?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function load() {
    setLoading(true);
    const [{ data: ordersData }, { data: stagesData }, { data: wcData }] = await Promise.all([
      supabase
        .from("production_orders")
        .select("id, code, quantity, quantity_produced, stage_id, planned_start_date, due_date, status, products:product_id (sku, name)")
        .neq("status", "concluida")
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("production_stages").select("id, name, sort_order").order("sort_order"),
      supabase.from("work_centers").select("id, stage_id, capacity, capacity_unit"),
    ]);
    setOrders(ordersData ?? []);
    setStages(stagesData ?? []);
    setWorkCenters(wcData ?? []);
    setHasWorkCenters((wcData ?? []).length > 0);
    setLoading(false);
  }

  const selectedWeek = weeks[selectedWeekIdx];
  const selectedWeekKey = weekKey(selectedWeek);

  // Carga x capacidade, só das ordens cujo prazo cai na semana escolhida.
  const capacityRows = useMemo(() => {
    const capacityByStage = {};
    workCenters.forEach((wc) => {
      if (!wc.stage_id) return;
      if (!capacityByStage[wc.stage_id]) capacityByStage[wc.stage_id] = { total: 0, unit: wc.capacity_unit };
      capacityByStage[wc.stage_id].total += Number(wc.capacity);
    });

    const loadByStage = {};
    orders.forEach((o) => {
      if (!o.due_date || weekKey(o.due_date) !== selectedWeekKey) return;
      const remaining = Math.max(Number(o.quantity) - Number(o.quantity_produced ?? 0), 0);
      loadByStage[o.stage_id] = (loadByStage[o.stage_id] ?? 0) + remaining;
    });

    return stages.map((stage) => {
      const capacity = capacityByStage[stage.id]?.total ?? 0;
      const unit = capacityByStage[stage.id]?.unit ?? "—";
      const load = loadByStage[stage.id] ?? 0;
      return {
        id: stage.id, name: stage.name, capacity, unit, load,
        overloaded: capacity > 0 && load > capacity,
        noCapacityDefined: capacity === 0,
      };
    });
  }, [stages, workCenters, orders, selectedWeekKey]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Plano Mestre de Produção</h1>
        <p style={styles.subtitle}>
          Timeline das ordens em aberto (início planejado até o prazo, colorido pelo que já foi
          produzido) e a carga x capacidade de cada etapa, semana a semana.
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
      ) : (
        <>
          <div style={styles.ganttBox}>
            <span style={styles.sectionLabel}>Timeline das ordens (próximas {WEEKS_HORIZON} semanas)</span>
            {orders.length === 0 ? (
              <p style={styles.dim}>Nenhuma ordem em aberto.</p>
            ) : (
              <div style={styles.ganttScroll}>
                <div style={{ ...styles.ganttHeaderRow, gridTemplateColumns: `180px repeat(${WEEKS_HORIZON}, 90px)` }}>
                  <div />
                  {weeks.map((w, i) => (
                    <div key={i} style={styles.ganttHeaderCell}>{formatWeekLabel(w)}</div>
                  ))}
                </div>
                {orders.map((o) => (
                  <GanttRow key={o.id} order={o} weeks={weeks} today={today} />
                ))}
              </div>
            )}
          </div>

          <div style={styles.weekSelectorRow}>
            <span style={styles.sectionLabel}>Carga x capacidade na semana:</span>
            <select style={styles.weekSelect} value={selectedWeekIdx} onChange={(e) => setSelectedWeekIdx(Number(e.target.value))}>
              {weeks.map((w, i) => <option key={i} value={i}>{formatWeekLabel(w)}</option>)}
            </select>
          </div>

          {stages.length === 0 ? (
            <p style={styles.dim}>Nenhuma etapa configurada ainda.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Etapa</th>
                    <th style={styles.th}>Capacidade disponível</th>
                    <th style={styles.th}>Carga necessária (prazo nessa semana)</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {capacityRows.map((r) => (
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
        </>
      )}
    </div>
  );
}

function GanttRow({ order, weeks, today }) {
  const start = order.planned_start_date ? new Date(order.planned_start_date + "T00:00:00") : (order.due_date ? addDays(new Date(order.due_date + "T00:00:00"), -7) : null);
  const end = order.due_date ? new Date(order.due_date + "T00:00:00") : start;
  const isLate = order.due_date && new Date(order.due_date + "T00:00:00") < today;
  const percent = order.quantity > 0 ? Math.min((Number(order.quantity_produced ?? 0) / Number(order.quantity)) * 100, 100) : 0;

  const horizonStart = weeks[0];
  const horizonEnd = addDays(weeks[weeks.length - 1], 7);

  let barStyle = null;
  if (start && end) {
    const clampedStart = start < horizonStart ? horizonStart : start;
    const clampedEnd = end > horizonEnd ? horizonEnd : end;
    if (clampedEnd >= clampedStart) {
      const totalDays = (horizonEnd - horizonStart) / 86400000;
      const leftPct = ((clampedStart - horizonStart) / 86400000 / totalDays) * 100;
      const widthPct = Math.max(((clampedEnd - clampedStart) / 86400000 / totalDays) * 100, 1.5);
      barStyle = { left: `${leftPct}%`, width: `${widthPct}%` };
    }
  }

  return (
    <div style={{ ...styles.ganttRow, gridTemplateColumns: `180px repeat(${weeks.length}, 90px)` }}>
      <div style={styles.ganttLabel}>
        <span style={{ fontWeight: 700 }}>{order.code}</span>
        <span style={styles.ganttLabelSub}>{order.products?.sku}</span>
      </div>
      <div style={{ gridColumn: `2 / span ${weeks.length}`, position: "relative", height: 28 }}>
        {barStyle && (
          <div style={{ ...styles.ganttBar, ...barStyle, background: isLate ? "rgba(217,105,95,0.25)" : "rgba(232,163,61,0.25)", borderColor: isLate ? "var(--red)" : "var(--amber)" }}>
            <div style={{ ...styles.ganttBarFill, width: `${percent}%`, background: isLate ? "var(--red)" : "var(--amber)" }} />
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 680, lineHeight: 1.5 },
  notice: {
    background: "rgba(232,163,61,0.1)", border: "1px solid var(--amber)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "12px 16px", fontSize: 13, lineHeight: 1.5, marginBottom: 20, maxWidth: 640,
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  sectionLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)", fontWeight: 700 },
  ganttBox: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 16, marginBottom: 24,
  },
  ganttScroll: { overflowX: "auto", marginTop: 12 },
  ganttHeaderRow: { display: "grid", gap: 0, marginBottom: 4 },
  ganttHeaderCell: { fontSize: 10.5, color: "var(--text-dim)", textAlign: "center", fontWeight: 700 },
  ganttRow: { display: "grid", alignItems: "center", minHeight: 34, borderTop: "1px solid var(--line)" },
  ganttLabel: { display: "flex", flexDirection: "column", padding: "6px 10px 6px 0", fontSize: 12.5 },
  ganttLabelSub: { fontSize: 11, color: "var(--text-dim)" },
  ganttBar: {
    position: "absolute", top: 4, height: 20, borderRadius: 4, border: "1px solid",
    overflow: "hidden",
  },
  ganttBarFill: { height: "100%" },
  weekSelectorRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  weekSelect: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "7px 10px", color: "var(--text)", fontSize: 13,
  },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
};
