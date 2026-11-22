import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deep Link Doctor",
  description: "Diagnose iOS Universal Link and Android App Link configuration, and learn how to fix it.",
};

// Dark is the default; only switch to light if the user explicitly chose it.
const themeScript = `try{if(localStorage.getItem("theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        suppressHydrationWarning
        className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100"
      >{children}</body>
    </html>
  );
}
