import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Proveedor from "@/components/Proveedor";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Bitácora ITO",
  description: "Registro en terreno y reporte diario de inspección técnica de obras",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f6f8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" className={inter.variable}>
      <body>
        <Proveedor>{children}</Proveedor>
      </body>
    </html>
  );
}
