/**
 * Navegação do sistema, em duas camadas.
 *
 * `NAV` é o menu lateral: o que vale para o sistema todo. `FICHA_TABS` são as
 * seções da empresa aberta, mostradas como abas no topo da página do cliente —
 * ali o contexto é a empresa, e o menu lateral não precisa carregá-lo.
 */

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  /** Tela ainda não implementada: aparece desabilitada. */
  soon?: boolean;
  adminOnly?: boolean;
  /** Casa a rota exata, sem pegar sub-rotas. */
  exact?: boolean;
  /** Abre fora do sistema (outro programa ou site), não é uma tela daqui. */
  externo?: boolean;
};

export type NavGroup = {
  /** Sem label o grupo aparece solto, sem cabeçalho. */
  label?: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    items: [
      { label: "Início", href: "/inicio", icon: "Home" },
      { label: "Agenda", href: "/agenda", icon: "CalendarDays" },
      { label: "Seleção", href: "/selecao", icon: "UserSearch" },
      { label: "Testes", href: "/testes", icon: "ClipboardCheck" },
      { label: "Gestão", href: "/gestao", icon: "Wallet" },
      { label: "Relatórios", href: "/relatorios", icon: "ChartNoAxesColumn" },
      // O cofre do Obsidian desta máquina: abre o aplicativo, não uma tela daqui.
      { label: "Obsidian", href: "obsidian://open?vault=Obsidian%20Vault", icon: "NotebookPen", externo: true },
    ],
  },
  {
    label: "Clientes",
    items: [
      { label: "Empresas", href: "/empresas", icon: "Building2", exact: true },
      { label: "Contratos", href: "/contratos", icon: "FileText", soon: true },
    ],
  },
  {
    label: "Marketing e comercial",
    items: [
      { label: "Roteiros", href: "/roteiros", icon: "ScrollText" },
      // Ainda sem tela: aparecem desabilitados até serem construídos. As ideias
      // de cada um estão guardadas no backup de 2026-09-29.
      { label: "Marketing", href: "/marketing", icon: "TrendingUp", soon: true },
      { label: "Publicações", href: "/publicacoes", icon: "Send", soon: true },
      { label: "Tráfego pago", href: "/trafego", icon: "Megaphone", soon: true },
      { label: "Leads", href: "/leads", icon: "Contact", soon: true },
    ],
  },
  {
    label: "Equipe interna",
    items: [
      { label: "Consultores", href: "/equipe", icon: "Users" },
      {
        label: "Carga de trabalho",
        href: "/carga",
        icon: "GaugeCircle",
        soon: true,
      },
    ],
  },
  {
    items: [
      {
        label: "Usuários",
        href: "/admin/usuarios",
        icon: "UserCog",
        adminOnly: true,
      },
      { label: "Configurações", href: "/configuracoes", icon: "Settings" },
    ],
  },
];

export type FichaTab = {
  label: string;
  /** Trecho depois de /empresas/[id]/. */
  slug: string;
};

/**
 * As seções da ficha do cliente, na ordem do trabalho: o plano prometido vai
 * para a agenda, o compromisso vira reunião, e a Evolução é o relatório do mês
 * com o que as reuniões produziram. Depois, o que é da gestão de pessoas.
 */
export const FICHA_TABS: FichaTab[] = [
  { label: "Dados", slug: "dados" },
  { label: "Planejamento", slug: "planejamento" },
  { label: "Agenda", slug: "agenda" },
  { label: "Reuniões", slug: "reunioes" },
  { label: "Evolução", slug: "evolucao" },
  { label: "Seleção", slug: "selecao" },
  { label: "Equipe", slug: "equipe" },
  { label: "Ponto", slug: "ponto" },
];
