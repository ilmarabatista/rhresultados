"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  ClipboardCheck,
  Contact,
  ChevronRight,
  FileText,
  GaugeCircle,
  Home,
  Megaphone,
  Menu,
  NotebookPen,
  Plus,
  ScrollText,
  Send,
  Settings,
  TrendingUp,
  UserCog,
  UserSearch,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { NAV, type NavItem } from "@/lib/nav";
import { logout } from "@/app/login/actions";
import { iniciais } from "@/lib/text";

const ICONS: Record<string, LucideIcon> = {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  ClipboardCheck,
  Contact,
  FileText,
  GaugeCircle,
  Home,
  Megaphone,
  NotebookPen,
  ScrollText,
  Send,
  Settings,
  TrendingUp,
  UserCog,
  UserSearch,
  Users,
  Wallet,
};

export type SidebarUser = {
  name: string;
  role: "ADMIN" | "MEMBRO";
};

export type SidebarCompany = {
  id: string;
  name: string;
  industry: string | null;
  contractStatus: string;
};

/** Extrai o id da empresa da URL, quando existe uma selecionada. */
function companyFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/empresas\/([^/]+)/);
  return m && m[1] !== "nova" ? m[1] : null;
}

/**
 * Ao trocar de empresa, mantém a mesma seção: de /empresas/A/equipe o destino
 * é /empresas/B/equipe. Fora de uma ficha, vai direto aos dados — a raiz da
 * ficha só redireciona, e passar por ela é uma ida ao servidor a mais.
 */
function switchCompanyHref(pathname: string, destinoId: string): string {
  const m = pathname.match(/^\/empresas\/[^/]+\/([^/]+)/);
  // Uma sub-rota com id (a ficha de uma pessoa, uma reunião) não existe na
  // outra empresa: fica só a seção.
  const secao = m?.[1] ?? "dados";
  return `/empresas/${destinoId}/${secao}`;
}

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

function Row({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const Icon = ICONS[item.icon] ?? Home;
  const bloqueado = Boolean(item.soon);

  const conteudo = (
    <>
      <Icon size={16} strokeWidth={1.75} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.soon ? (
        <span className="shrink-0 rounded bg-white/5 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-zinc-500">
          em breve
        </span>
      ) : null}
    </>
  );

  const base =
    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] leading-tight transition";

  if (bloqueado) {
    return (
      <span
        className={`${base} cursor-not-allowed text-zinc-600`}
        title="Ainda não implementado"
      >
        {conteudo}
      </span>
    );
  }

  if (item.externo) {
    return (
      <a
        href={item.href}
        onClick={onNavigate}
        className={`${base} border border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100`}
      >
        {conteudo}
      </a>
    );
  }

  const ativo = isActive(pathname, item.href, item.exact);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={ativo ? "page" : undefined}
      className={`${base} ${
        ativo
          ? "border border-white/12 bg-white/8 text-zinc-50"
          : "border border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
      }`}
    >
      {conteudo}
    </Link>
  );
}

export default function Sidebar({
  user,
  companies,
}: {
  user: SidebarUser;
  companies: SidebarCompany[];
}) {
  const pathname = usePathname();
  const companyId = companyFromPath(pathname);
  const empresaAtual = companies.find((c) => c.id === companyId) ?? null;
  const companyName = empresaAtual?.name ?? null;
  const [aberto, setAberto] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  const [seletorEmpresa, setSeletorEmpresa] = useState(false);

  const fechar = () => setAberto(false);

  const conteudo = (
    <div className="flex h-full flex-col bg-[#0d1b2a]">
      <div className="flex items-center gap-2.5 px-3 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-[11px] font-bold text-white">
          RH
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-100">
          RH Resultados
        </p>

        {/* Conta do usuário: saiu do rodapé para dar lugar à troca de empresa */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setMenuUsuario((v) => !v);
              setSeletorEmpresa(false);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-zinc-300 transition hover:bg-white/20 hover:text-zinc-100"
            aria-label={`Conta de ${user.name}`}
            aria-expanded={menuUsuario}
          >
            {iniciais(user.name)}
          </button>

          {menuUsuario ? (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuUsuario(false)}
                aria-hidden
              />
              <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#14293f] py-1 shadow-xl">
                <div className="border-b border-white/8 px-3 py-2">
                  <p className="truncate text-[13px] text-zinc-100">
                    {user.name}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                    {user.role === "ADMIN" ? "Administrador" : "Membro"}
                  </p>
                </div>
                <form action={logout}>
                  <button
                    type="submit"
                    className="w-full px-3 py-2 text-left text-[13px] text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
                  >
                    Sair da conta
                  </button>
                </form>
              </div>
            </>
          ) : null}
        </div>

        <button
          type="button"
          onClick={fechar}
          className="shrink-0 text-zinc-500 transition hover:text-zinc-200 lg:hidden"
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-2.5 pb-3">
        {NAV.map((grupo, i) => {
          const itens = grupo.items.filter(
            (item) => !item.adminOnly || user.role === "ADMIN",
          );
          if (!itens.length) return null;

          return (
            <div key={grupo.label ?? `grupo-${i}`} className="mb-1">
              {grupo.label ? (
                <p className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-300/80">
                  {grupo.label}
                </p>
              ) : (
                <div className="pt-2" />
              )}
              <div className="space-y-0.5">
                {itens.map((item) => (
                  <Row
                    key={item.label}
                    item={item}
                    pathname={pathname}
                    onNavigate={fechar}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Rodapé: empresa em que se está trabalhando agora */}
      <div className="relative border-t border-white/8 p-3">
        {seletorEmpresa ? (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setSeletorEmpresa(false)}
              aria-hidden
            />
            <div className="absolute bottom-full left-3 right-3 z-20 mb-1 overflow-hidden rounded-xl border border-white/10 bg-[#14293f] shadow-xl">
              <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-300/80">
                Trabalhar em
              </p>

              <div className="scroll-thin max-h-64 overflow-y-auto pb-1">
                {companies.length === 0 ? (
                  <p className="px-3 py-3 text-[12px] text-zinc-500">
                    Nenhuma empresa cadastrada.
                  </p>
                ) : (
                  companies.map((c) => {
                    const atual = c.id === companyId;
                    return (
                      <Link
                        key={c.id}
                        href={switchCompanyHref(pathname, c.id)}
                        onClick={() => {
                          setSeletorEmpresa(false);
                          fechar();
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2 transition ${
                          atual
                            ? "bg-white/8 text-zinc-100"
                            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                        }`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] font-semibold text-zinc-300">
                          {iniciais(c.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] leading-tight">
                            {c.name}
                          </span>
                          <span className="block truncate text-[10px] leading-tight text-zinc-500">
                            {c.industry || "Ramo não informado"}
                          </span>
                        </span>
                        {atual ? (
                          <Check size={14} className="shrink-0 text-brand-300" />
                        ) : null}
                      </Link>
                    );
                  })
                )}
              </div>

              {/* Sem atalho para a lista: o item "Empresas" já está fixo no menu. */}
              <div className="border-t border-white/8">
                <Link
                  href="/empresas/nova"
                  onClick={() => {
                    setSeletorEmpresa(false);
                    fechar();
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
                >
                  <Plus size={14} className="shrink-0" />
                  Cadastrar nova empresa
                </Link>
              </div>
            </div>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setSeletorEmpresa((v) => !v);
            setMenuUsuario(false);
          }}
          aria-expanded={seletorEmpresa}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-white/5"
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ${
              companyName
                ? "bg-brand-600/20 text-brand-300 ring-1 ring-inset ring-brand-500/30"
                : "bg-white/10 text-zinc-400"
            }`}
          >
            {companyName ? iniciais(companyName) : "—"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] leading-tight text-zinc-100">
              {companyName ?? "Selecionar empresa"}
            </span>
            <span className="block truncate text-[10px] uppercase tracking-wide leading-tight text-zinc-500">
              {companyName
                ? (empresaAtual?.industry ?? "Empresa cliente")
                : `${companies.length} cadastrada${companies.length === 1 ? "" : "s"}`}
            </span>
          </span>
          <ChevronRight
            size={15}
            className={`shrink-0 text-zinc-500 transition ${
              seletorEmpresa ? "-rotate-90" : ""
            }`}
          />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Barra superior apenas em telas pequenas */}
      <div className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="text-slate-600 transition hover:text-slate-900"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>
        {/* O nome da empresa já aparece no cabeçalho da própria página. */}
        <span className="truncate text-sm font-medium text-slate-800">
          RH Resultados
        </span>
      </div>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[212px] border-r border-black/40 lg:block">
        {conteudo}
      </aside>

      {aberto ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={fechar}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-[260px] shadow-xl">
            {conteudo}
          </div>
        </div>
      ) : null}
    </>
  );
}
