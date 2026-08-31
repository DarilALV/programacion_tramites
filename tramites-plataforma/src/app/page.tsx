import Link from "next/link";
import { AppShell } from "@/components/app-shell";

const modules = [
  {
    href: "/ingreso",
    title: "Ingreso y perfil",
    description: "Selecciona el usuario activo y valida la sesión simulada para las pruebas.",
  },
  {
    href: "/tramites/nuevo",
    title: "Nuevo trámite",
    description: "Registra un trámite desde el perfil activo con expediente, fecha y prioridad.",
  },
  {
    href: "/tramites/mis-tramites",
    title: "Mis trámites",
    description: "Revisa, publica o devuelve a borrador lo que generó cada usuario.",
  },
  {
    href: "/reportes",
    title: "Reportes",
    description: "Evalúa la producción por usuario y por técnico asignado.",
  },
  {
    href: "/supervision",
    title: "Supervisión",
    description: "Visualiza el consolidado global con filtros y acciones de revisión.",
  },
];

export default function Home() {
  return (
    <AppShell
      title="Plataforma de trámites "
      description=""
      eyebrow="Mi Casa Segura"
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="group rounded-[1.6rem] border border-black/10 bg-white/80 p-5 shadow-[0_14px_40px_rgba(17,17,17,0.07)] transition hover:-translate-y-1 hover:border-black/20"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">
              Módulo
            </div>
            <h2 className="mt-3 text-xl font-semibold text-[#16110c]">{module.title}</h2>
            <p className="mt-3 text-sm leading-6 text-black/68">{module.description}</p>
            <div className="mt-5 text-sm font-semibold text-[#151515]">
              Abrir módulo <span className="transition group-hover:translate-x-1 inline-block">→</span>
            </div>
          </Link>
        ))}
      </section>

    </AppShell>
  );
}