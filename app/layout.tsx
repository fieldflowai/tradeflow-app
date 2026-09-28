import type { Metadata } from "next";
import React from "react";
import HeaderNav from "@/app/components/HeaderNav";
import Footer from "@/app/components/Footer";
import Logo from "@/app/components/Logo";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeFlow | Service Estimates & Invoicing",
  description: "TradeFlow helps tradespeople create clear estimates, communicate with customers, and spend less time on admin.",
  icons: { icon: "/tradeflow-mark.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return React.createElement(
    "html",
    { lang: "en" },
    React.createElement(
      "body",
      {
        className: "bg-slate-50 min-h-screen flex flex-col font-sans text-slate-900 antialiased",
        style: { overflowX: "hidden", overflowY: "auto" },
        suppressHydrationWarning: true,
      },
      React.createElement(
        "header",
        { className: "print:hidden relative z-20 bg-slate-900 text-white px-4 md:px-8 py-3.5 border-b border-slate-800 flex items-center justify-between shadow-sm" },
        React.createElement(Logo, null),
        React.createElement(HeaderNav, null)
      ),
      React.createElement("main", { className: "flex-1" }, children),
      React.createElement(Footer, null)
    )
  );
}
