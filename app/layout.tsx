import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mapa de Inseguridad — Conurbano Bonaerense",
  description:
    "Dashboard de estadísticas criminales (SNIC) para los 24 partidos del Gran Buenos Aires.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
