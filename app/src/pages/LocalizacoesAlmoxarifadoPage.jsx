import { useEffect, useState } from "react";
import ModulePage from "../components/ModulePage";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

/**
 * Endereçamento logístico: cada local físico dentro de um
 * almoxarifado (corredor/prateleira/nível), pra saber exatamente
 * onde cada item está guardado, não só em qual almoxarifado.
 */
export default function LocalizacoesAlmoxarifadoPage() {
  const { company } = useAuth();
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    if (company?.id) {
      supabase.from("warehouses").select("id, name").order("name").then(({ data }) => setWarehouses(data ?? []));
    }
  }, [company?.id]);

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));

  return (
    <ModulePage
      table="warehouse_locations"
      title="Localizações"
      subtitle="Endereço dentro de cada almoxarifado — corredor, prateleira e nível. Opcional, mas ajuda a achar o item rápido."
      emptyLabel="Nenhuma localização cadastrada ainda."
      fields={[
        { key: "warehouse_id", label: "Almoxarifado", type: "select", required: true, options: warehouseOptions },
        { key: "code", label: "Código", placeholder: "Ex: A-01-03", required: true },
        { key: "aisle", label: "Corredor (Rua)", placeholder: "Ex: A" },
        { key: "shelf", label: "Estante/Prateleira", placeholder: "Ex: 01" },
        { key: "level", label: "Nível/Gaveta", placeholder: "Ex: 03" },
      ]}
    />
  );
}
