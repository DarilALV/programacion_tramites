"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/", label: "Inicio" },
  { href: "/ingreso", label: "Ingreso" },
  { href: "/tramites/nuevo", label: "Nuevo trámite" },
  { href: "/tramites/mis-tramites", label: "Mis trámites" },
  { href: "/reportes", label: "Reportes" },
  { href: "/supervision", label: "Supervisión" },
];

type AppShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
};

export function AppShell({ title, description, eyebrow, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-4xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(244,233,211,0.96))] p-6 shadow-[0_18px_50px_rgba(28,24,15,0.1)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex w-fit items-center rounded-full border border-black/10 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-black/70">
              {eyebrow ?? "GAMC Trámites"}
            </span>
            <div className="space-y-2">
              <h1 className="font-serif text-3xl text-[#17120b] sm:text-4xl">{title}</h1>
              <p className="max-w-3xl text-sm leading-6 text-black/70 sm:text-base">{description}</p>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            {navigation.map((item) => {
              const active = item.href === pathname;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    active
                      ? "bg-[#151515] text-white"
                      : "border border-black/10 bg-white/70 text-[#151515]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {children}
    </main>
  );
}
