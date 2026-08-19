import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const CARDS = [
  { table: "customers", label: "Clientes cadastrados", icon: "◎" },
  { table: "suppliers", label: "Fornecedores cadastrados", icon: "◇" },
  { table: "products", label: "Produtos cadastrados", icon: "◆" },
  { table: "production_orders", label: "Ordens de produção", icon: "⚙" },
  { table: "inventory_items", label: "Itens em estoque", icon: "▤" },
  { table: "sales_orders", label: "Pedidos de venda", icon: "◈" },
  { table: "financial_entries", label: "Lançamentos financeiros", icon: "$" },
];

export default function DashboardPage() {
  const { company, profile } = useAuth();
  const [counts, setCounts] = useState({});

  useEffect(() => {
    if (!company?.id) return;
    (async () => {
      const results = await Promise.all(
        CARDS.map((c) => supabase.from(c.table).select("id", { count: "exact", head: true }))
      );
      const next = {};
      results.forEach((res, i) => { next[CARDS[i].table] = res.count ?? 0; });
      setCounts(next);
    })();
  }, [company?.id]);

  return (
    <div>
      <header style={{ marginBottom: 28 }}>
        <h1 style={styles.title}>Painel — {company?.name ?? "sua empresa"}</h1>
        <p style={styles.subtitle}>Olá{profile?.full_name ? `, ${profile.full_name}` : ""}. Visão geral da operação.</p>
      </header>

      <div style={styles.grid}>
        {CARDS.map((c) => (
          <div key={c.table} style={styles.card}>
            <div style={styles.cardIcon}>{c.icon}</div>
            <div style={styles.cardValue}>{counts[c.table] ?? "—"}</div>
            <div style={styles.cardLabel}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
  },
  card: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "20px 18px",
  },
  cardIcon: { color: "var(--amber)", fontSize: 18, marginBottom: 10 },
  cardValue: { fontFamily: "var(--font-display)", fontSize: 28 },
  cardLabel: { color: "var(--text-dim)", fontSize: 12.5, marginTop: 4 },
};
