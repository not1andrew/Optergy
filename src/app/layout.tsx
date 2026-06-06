import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Optergy — understand your appliance's energy cost",
  description:
    "Read Australian energy labels, estimate running costs with sourced electricity benchmarks, and compare efficient appliances.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
