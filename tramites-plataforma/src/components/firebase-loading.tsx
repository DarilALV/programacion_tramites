"use client";

import { useTramitesStore } from "@/lib/tramites-store";
import type { ReactNode } from "react";

export function FirebaseLoading({ children }: { children: ReactNode }) {
  const { hydrated } = useTramitesStore();

  if (!hydrated) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-pink-100" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-pink-600 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">Conectando con Firebase…</p>
            <p className="text-xs text-gray-400 mt-1">Cargando registros del sistema</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
