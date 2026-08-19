import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ClientesPage from "./pages/ClientesPage";
import FornecedoresPage from "./pages/FornecedoresPage";
import ProdutosPage from "./pages/ProdutosPage";
import EtapasPage from "./pages/EtapasPage";
import CentrosTrabalhoPage from "./pages/CentrosTrabalhoPage";
import AlmoxarifadosPage from "./pages/AlmoxarifadosPage";
import UnidadesMedidaPage from "./pages/UnidadesMedidaPage";
import CondicoesPagamentoPage from "./pages/CondicoesPagamentoPage";
import CentrosCustoPage from "./pages/CentrosCustoPage";
import TransportadorasPage from "./pages/TransportadorasPage";
import ProducaoPage from "./pages/ProducaoPage";
import NecessidadeMateriaisPage from "./pages/NecessidadeMateriaisPage";
import CapacidadePage from "./pages/CapacidadePage";
import EstoquePage from "./pages/EstoquePage";
import RecebimentoProducaoPage from "./pages/RecebimentoProducaoPage";
import ExpedicaoPage from "./pages/ExpedicaoPage";
import TransferenciasPage from "./pages/TransferenciasPage";
import ContasReceberPage from "./pages/ContasReceberPage";
import CustosPage from "./pages/CustosPage";
import ColaboradoresPage from "./pages/ColaboradoresPage";
import FeriasPage from "./pages/FeriasPage";
import FolhaPagamentoPage from "./pages/FolhaPagamentoPage";
import DecimoTerceiroPage from "./pages/DecimoTerceiroPage";
import RescisaoPage from "./pages/RescisaoPage";
import BeneficiosPage from "./pages/BeneficiosPage";
import EmpresaPage from "./pages/EmpresaPage";
import ContasPagarPage from "./pages/ContasPagarPage";
import LancamentosPage from "./pages/LancamentosPage";
import FluxoCaixaPage from "./pages/FluxoCaixaPage";
import DREPage from "./pages/DREPage";
import CotacoesPage from "./pages/CotacoesPage";
import PedidosCompraPage from "./pages/PedidosCompraPage";
import AlmoxarifadoPage from "./pages/AlmoxarifadoPage";
import OportunidadesPage from "./pages/OportunidadesPage";
import EtapasComercialPage from "./pages/EtapasComercialPage";
import OrcamentosPage from "./pages/OrcamentosPage";
import PedidosVendaPage from "./pages/PedidosVendaPage";
import "./theme.css";

function PrivateArea() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 40, color: "var(--text-dim)" }}>Carregando...</div>;
  }

  if (!session) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/fornecedores" element={<FornecedoresPage />} />
        <Route path="/produtos" element={<ProdutosPage />} />
        <Route path="/etapas" element={<EtapasPage />} />
        <Route path="/centros-trabalho" element={<CentrosTrabalhoPage />} />
        <Route path="/almoxarifados" element={<AlmoxarifadosPage />} />
        <Route path="/unidades-medida" element={<UnidadesMedidaPage />} />
        <Route path="/condicoes-pagamento" element={<CondicoesPagamentoPage />} />
        <Route path="/centros-custo" element={<CentrosCustoPage />} />
        <Route path="/transportadoras" element={<TransportadorasPage />} />
        <Route path="/producao" element={<ProducaoPage />} />
        <Route path="/mrp/materiais" element={<NecessidadeMateriaisPage />} />
        <Route path="/mrp/capacidade" element={<CapacidadePage />} />
        <Route path="/estoque" element={<EstoquePage />} />
        <Route path="/recebimento-producao" element={<RecebimentoProducaoPage />} />
        <Route path="/expedicao" element={<ExpedicaoPage />} />
        <Route path="/transferencias" element={<TransferenciasPage />} />
        <Route path="/cotacoes" element={<CotacoesPage />} />
        <Route path="/pedidos-compra" element={<PedidosCompraPage />} />
        <Route path="/almoxarifado" element={<AlmoxarifadoPage />} />
        <Route path="/oportunidades" element={<OportunidadesPage />} />
        <Route path="/etapas-comercial" element={<EtapasComercialPage />} />
        <Route path="/orcamentos" element={<OrcamentosPage />} />
        <Route path="/pedidos-venda" element={<PedidosVendaPage />} />
        <Route path="/contas-receber" element={<ContasReceberPage />} />
        <Route path="/custos-margem" element={<CustosPage />} />
        <Route path="/colaboradores" element={<ColaboradoresPage />} />
        <Route path="/ferias" element={<FeriasPage />} />
        <Route path="/folha-pagamento" element={<FolhaPagamentoPage />} />
        <Route path="/decimo-terceiro" element={<DecimoTerceiroPage />} />
        <Route path="/rescisao" element={<RescisaoPage />} />
        <Route path="/beneficios" element={<BeneficiosPage />} />
        <Route path="/empresa" element={<EmpresaPage />} />
        <Route path="/contas-pagar" element={<ContasPagarPage />} />
        <Route path="/lancamentos" element={<LancamentosPage />} />
        <Route path="/fluxo-caixa" element={<FluxoCaixaPage />} />
        <Route path="/dre" element={<DREPage />} />
      </Route>
    </Routes>
  );
}

function RootRoutes() {
  const { session, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={!loading && session ? <Navigate to="/" replace /> : <AuthPage />}
      />
      <Route path="/*" element={<PrivateArea />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RootRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
