import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";

const TYPE_LABEL = {
  acabado: "Produto acabado",
  componente: "Componente",
  materia_prima: "Matéria-prima",
  insumo: "Insumo",
  maquina: "Máquina",
};

const TYPE_OPTIONS = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }));

export default function ProdutosPage() {
  const { company } = useAuth();
  const [units, setUnits] = useState([]);

  useEffect(() => {
    if (!company?.id) return;
    supabase
      .from("units_of_measure")
      .select("code, name")
      .order("code")
      .then(({ data }) => setUnits(data ?? []));
  }, [company?.id]);

  const unitOptions = units.map((u) => ({ value: u.code, label: `${u.code} — ${u.name}` }));

  return (
    <div>
      <ModulePage
        table="products"
        title="Produtos"
        subtitle="Cadastro de produtos acabados, componentes, matérias-primas, insumos e máquinas"
        emptyLabel="Nenhum produto cadastrado ainda."
        fields={[
          { key: "sku", label: "SKU", placeholder: "Ex: PRD-001", required: true },
          { key: "name", label: "Nome", placeholder: "Ex: Portão basculante 3x2m", required: true },
          {
            key: "type",
            label: "Classe",
            type: "select",
            required: true,
            options: TYPE_OPTIONS,
          },
          unitOptions.length > 0
            ? { key: "unit", label: "Unidade", type: "select", options: unitOptions, required: true }
            : { key: "unit", label: "Unidade", placeholder: "Cadastre em Cadastro → Unidades de Medida" },
          { key: "stock_quantity", label: "Estoque atual", type: "number" },
          { key: "min_stock", label: "Estoque mínimo", type: "number" },
          { key: "reorder_point", label: "Ponto de pedido", type: "number", placeholder: "Se vazio, usa o estoque mínimo" },
          { key: "max_stock", label: "Estoque máximo", type: "number", placeholder: "Usado pra calcular quanto sugerir comprar" },
          { key: "ncm", label: "NCM (fiscal)", placeholder: "Ex: 73181500 — necessário pra emitir NF-e" },
          { key: "cfop_padrao", label: "CFOP padrão (venda)", placeholder: "5102" },
          { key: "cost", label: "Custo", type: "currency" },
          { key: "sale_price", label: "Preço de venda", type: "currency" },
          { key: "lead_time_days", label: "Lead time (dias)", type: "number" },
        ]}
      />
    </div>
  );
}

