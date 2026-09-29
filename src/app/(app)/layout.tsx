import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  // O menu identifica a empresa aberta pela URL e usa esta lista para trocar.
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, industry: true, contractStatus: true },
  });

  return (
    <div className="print-full min-h-screen lg:pl-[212px]">
      <Sidebar
        user={{ name: session.name, role: session.role }}
        companies={companies}
      />
      <div className="min-h-screen bg-[#f4f7fa]">{children}</div>
    </div>
  );
}
