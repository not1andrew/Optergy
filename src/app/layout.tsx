import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Optergy | Understand your appliance's energy cost",
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
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=chillax@500,600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
