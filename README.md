# ProdOS — ERP Industrial SaaS

ERP multi-tenant focado em gestão empresarial, produção, MRP e custos.

## Posicionamento

O ProdOS conecta Comercial, Compras, Estoque, PCP/MRP, Produção, Qualidade, Custos e Financeiro em um único fluxo.

### Diferencial: Custos

O ProdOS transforma planejamento e produção em informação de rentabilidade:

**BOM → MRP → Compras → Produção → Apontamento → Custo → Margem → Financeiro**

O módulo de Custos trabalha com custo de materiais pela BOM, custo de processo por roteiro e centro de trabalho, custo padrão, preço de venda e margem, preparando a evolução para custo real e análise de desvios.

## Escopo comercial

- Comercial e CRM
- Compras
- Estoque e Almoxarifado
- PCP e MRP
- Produção e Apontamentos
- Qualidade
- Logística operacional
- Custos e Rentabilidade
- Financeiro
- Fiscal conforme funcionalidades efetivamente implementadas
- Bens e Ativos

Gestão de pessoas, folha, 13º, rescisão, benefícios, jornadas e férias não fazem parte do escopo comercial do ProdOS. Essas necessidades pertencem ao ProdPersonal.

## Ecossistema Prod

- **ProdOS:** ERP, operação, produção, MRP e custos
- **ProdLog:** WMS e logística especializada
- **ProdPersonal:** Gestão de Pessoas
- **ProdCore:** núcleo de empresas, usuários, permissões e integrações

Cada solução pode ser comercializada separadamente e o cliente pode evoluir para o ecossistema.

## Multi-tenant

Cada empresa cliente possui seus dados isolados por `company_id` e Row Level Security do Supabase.

## Desenvolvimento

A aplicação é construída de forma modular, permitindo liberar funcionalidades por plano sem obrigar cada cliente a contratar todos os módulos.