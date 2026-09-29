import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import UsersPanel from "@/components/users-panel";
import LoginAttempts from "@/components/login-attempts";
import { recentFailures } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usuários — RH Resultados" };

export default async function UsuariosPage() {
  const admin = await requireAdmin();

  const [tentativas, users] = await Promise.all([
    recentFailures(),
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Usuários do sistema
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Somente o administrador cria acessos. Não existe cadastro público.
        </p>
      </div>

      <div className="mb-4">
        <LoginAttempts
          tentativas={tentativas.map((t) => ({
            ...t,
            ultima: t.ultima.toISOString(),
          }))}
        />
      </div>

      <UsersPanel
        currentUserId={admin.userId}
        users={users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
