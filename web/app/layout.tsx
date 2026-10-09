import type { Metadata } from "next";
import "./globals.css";
import "./design-system.css";
import Providers from "./providers";
import ApplicationShell from '../components/ApplicationShell';

export const metadata: Metadata = {
  title: "TriggerTerminal",
  icons: { icon: "/trigger-icon.png", apple: "/trigger-icon.png" },
  description: "Bloomberg-style financial terminal on free data sources",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers><ApplicationShell>{children}</ApplicationShell></Providers>
      </body>
    </html>
  );
}
