import { useState } from "react";

const PRESETS = [
  { key: "30d", label: "Últimos 30 dias" },
  { key: "month", label: "Este mês" },
  { key: "year", label: "Este ano" },
  { key: "all", label: "Tudo" },
];

function presetRange(key) {
  const today = new Date();
  const toStr = today.toISOString().slice(0, 10);
  if (key === "30d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString().slice(0, 10), to: toStr };
  }
  if (key === "month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: from.toISOString().slice(0, 10), to: toStr };
  }
  if (key === "year") {
    const from = new Date(today.getFullYear(), 0, 1);
    return { from: from.toISOString().slice(0, 10), to: toStr };
  }
  return { from: "", to: "" }; // "all"
}

/**
 * Filtro de período pros relatórios: presets rápidos + intervalo
 * manual. Chama onChange({ from, to }) sempre que o período muda —
 * from/to vazios significam "sem filtro" (todo o histórico).
 */
export default function DateRangeFilter({ onChange }) {
  const [active, setActive] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function applyPreset(key) {
    setActive(key);
    const range = presetRange(key);
    setFrom(range.from);
    setTo(range.to);
    onChange(range);
  }

  function applyManual(newFrom, newTo) {
    setActive("");
    setFrom(newFrom);
    setTo(newTo);
    onChange({ from: newFrom, to: newTo });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.presets}>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            style={{ ...styles.presetBtn, ...(active === p.key ? styles.presetBtnActive : {}) }}
            onClick={() => applyPreset(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div style={styles.manual}>
        <input type="date" style={styles.dateInput} value={from} onChange={(e) => applyManual(e.target.value, to)} />
        <span style={styles.dash}>até</span>
        <input type="date" style={styles.dateInput} value={to} onChange={(e) => applyManual(from, e.target.value)} />
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 20 },
  presets: { display: "flex", gap: 6, flexWrap: "wrap" },
  presetBtn: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "var(--text-dim)", cursor: "pointer",
  },
  presetBtnActive: { background: "var(--amber)", color: "#FFFFFF", borderColor: "var(--amber)" },
  manual: { display: "flex", alignItems: "center", gap: 6 },
  dateInput: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "6px 8px", fontSize: 12, color: "var(--text)",
  },
  dash: { fontSize: 12, color: "var(--text-dim)" },
};
