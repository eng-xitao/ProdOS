import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import ResetSenhaPage from "./pages/ResetSenhaPage";
import DashboardPage from "./pages/DashboardPage";
import ClientesPage from "./pages/ClientesPage";
import FornecedoresPage from "./pages/FornecedoresPage";
import ContatosPage from "./pages/ContatosPage";
import ProdutosPage from "./pages/ProdutosPage";
import EtapasPage from "./pages/EtapasPage";
import CentrosTrabalhoPage from "./pages/CentrosTrabalhoPage";
import AlmoxarifadosPage from "./pages/AlmoxarifadosPage";
import UnidadesMedidaPage from "./pages/UnidadesMedidaPage";
import CondicoesPagamentoPage from "./pages/CondicoesPagamentoPage";
import CentrosCustoPage from "./pages/CentrosCustoPage";
import TransportadorasPage from "./pages/TransportadorasPage";
import ProducaoPage from "./pages/ProducaoPage";
import ApontamentoProducaoPage from "./pages/ApontamentoProducaoPage";
import NecessidadeMateriaisPage from "./pages/NecessidadeMateriaisPage";
import CapacidadePage from "./pages/CapacidadePage";
import EstoquePage from "./pages/EstoquePage";
import RecebimentoProducaoPage from "./pages/RecebimentoProducaoPage";
import ExpedicaoPage from "./pages/ExpedicaoPage";
import TransferenciasPage from "./pages/TransferenciasPage";
import HistoricoMovimentacoesPage from "./pages/HistoricoMovimentacoesPage";
import ContasReceberPage from "./pages/ContasReceberPage";
import CustosPage from "./pages/CustosPage";
import ColaboradoresPage from "./pages/ColaboradoresPage";
import JornadasTrabalhoPage from "./pages/JornadasTrabalhoPage";
import FeriasPage from "./pages/FeriasPage";
import FolhaPagamentoPage from "./pages/FolhaPagamentoPage";
import DecimoTerceiroPage from "./pages/DecimoTerceiroPage";
import RescisaoPage from "./pages/RescisaoPage";
import BeneficiosPage from "./pages/BeneficiosPage";
import EmpresaPage from "./pages/EmpresaPage";
import UsuariosPage from "./pages/UsuariosPage";
import PlanosAdminPage from "./pages/PlanosAdminPage";
import AprovacoesPage from "./pages/AprovacoesPage";
import AdminEmpresasPage from "./pages/AdminEmpresasPage";
import AdminUsuariosPage from "./pages/AdminUsuariosPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import AssinaturaPage from "./pages/AssinaturaPage";
import PlanoContasPage from "./pages/PlanoContasPage";
import SACPage from "./pages/SACPage";
import FrotasPage from "./pages/FrotasPage";
import RelatorioVendasPage from "./pages/RelatorioVendasPage";
import RelatorioComprasPage from "./pages/RelatorioComprasPage";
import RelatorioEstoqueAcabadoPage from "./pages/RelatorioEstoqueAcabadoPage";
import RelatorioEstoqueMateriaisPage from "./pages/RelatorioEstoqueMateriaisPage";
import RelatorioAlmoxarifadoPage from "./pages/RelatorioAlmoxarifadoPage";
import RelatorioProducaoPage from "./pages/RelatorioProducaoPage";
import CurvaABCPage from "./pages/CurvaABCPage";
import ContasPagarPage from "./pages/ContasPagarPage";
import LancamentosPage from "./pages/LancamentosPage";
import FluxoCaixaPage from "./pages/FluxoCaixaPage";
import TesourariaPage from "./pages/TesourariaPage";
import CreditoCobrancaPage from "./pages/CreditoCobrancaPage";
import AnaliseCentroCustoPage from "./pages/AnaliseCentroCustoPage";
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
  const { session, profile, company, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 40, color: "var(--text-dim)" }}>Carregando...</div>;
  }

  if (!session) return <Navigate to="/login" replace />;

  // Trava o sistema inteiro pra empresas que ainda não foram
  // aprovadas pelo comercial — exceto o admin da plataforma, que
  // precisa conseguir entrar pra revisar e aprovar os cadastros.
  if (profile && !profile.is_platform_admin && company && company.approval_status !== "approved") {
    return <PendingApprovalPage status={company.approval_status} />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/fornecedores" element={<FornecedoresPage />} />
        <Route path="/contatos" element={<ContatosPage />} />
        <Route path="/produtos" element={<ProdutosPage />} />
        <Route path="/etapas" element={<EtapasPage />} />
        <Route path="/centros-trabalho" element={<CentrosTrabalhoPage />} />
        <Route path="/almoxarifados" element={<AlmoxarifadosPage />} />
        <Route path="/unidades-medida" element={<UnidadesMedidaPage />} />
        <Route path="/condicoes-pagamento" element={<CondicoesPagamentoPage />} />
        <Route path="/centros-custo" element={<CentrosCustoPage />} />
        <Route path="/transportadoras" element={<TransportadorasPage />} />
        <Route path="/producao" element={<ProducaoPage />} />
        <Route path="/apontamento-producao" element={<ApontamentoProducaoPage />} />
        <Route path="/mrp/materiais" element={<NecessidadeMateriaisPage />} />
        <Route path="/mrp/capacidade" element={<CapacidadePage />} />
        <Route path="/estoque" element={<EstoquePage />} />
        <Route path="/recebimento-producao" element={<RecebimentoProducaoPage />} />
        <Route path="/expedicao" element={<ExpedicaoPage />} />
        <Route path="/transferencias" element={<TransferenciasPage />} />
        <Route path="/historico-movimentacoes" element={<HistoricoMovimentacoesPage />} />
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
        <Route path="/jornadas-trabalho" element={<JornadasTrabalhoPage />} />
        <Route path="/ferias" element={<FeriasPage />} />
        <Route path="/folha-pagamento" element={<FolhaPagamentoPage />} />
        <Route path="/decimo-terceiro" element={<DecimoTerceiroPage />} />
        <Route path="/rescisao" element={<RescisaoPage />} />
        <Route path="/beneficios" element={<BeneficiosPage />} />
        <Route path="/empresa" element={<EmpresaPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/admin/empresas" element={<AdminEmpresasPage />} />
        <Route path="/admin/administradores" element={<AdminUsuariosPage />} />
        <Route path="/admin/planos" element={<PlanosAdminPage />} />
        <Route path="/admin/aprovacoes" element={<AprovacoesPage />} />
        <Route path="/assinatura" element={<AssinaturaPage />} />
        <Route path="/plano-contas" element={<PlanoContasPage />} />
        <Route path="/sac" element={<SACPage />} />
        <Route path="/frotas" element={<FrotasPage />} />
        <Route path="/relatorio-vendas" element={<RelatorioVendasPage />} />
        <Route path="/relatorio-compras" element={<RelatorioComprasPage />} />
        <Route path="/relatorio-estoque-acabado" element={<RelatorioEstoqueAcabadoPage />} />
        <Route path="/relatorio-estoque-materiais" element={<RelatorioEstoqueMateriaisPage />} />
        <Route path="/relatorio-almoxarifado" element={<RelatorioAlmoxarifadoPage />} />
        <Route path="/relatorio-producao" element={<RelatorioProducaoPage />} />
        <Route path="/curva-abc" element={<CurvaABCPage />} />
        <Route path="/contas-pagar" element={<ContasPagarPage />} />
        <Route path="/lancamentos" element={<LancamentosPage />} />
        <Route path="/fluxo-caixa" element={<FluxoCaixaPage />} />
        <Route path="/tesouraria" element={<TesourariaPage />} />
        <Route path="/credito-cobranca" element={<CreditoCobrancaPage />} />
        <Route path="/analise-centro-custo" element={<AnaliseCentroCustoPage />} />
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
      <Route path="/reset-senha" element={<ResetSenhaPage />} />
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
