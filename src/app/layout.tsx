import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CarDekho Car Finder — from confused to confident",
  description:
    "Answer a few questions and get a personalized, ranked car shortlist with reasons that fit how you actually drive.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="wrap">
            <div className="brand">
              Car<b>Dekho</b>
              <span className="tag">Finder</span>
            </div>
            <div className="tag">AI-assisted picks</div>
          </div>
        </header>
        {children}
        <footer>
          Built for the CarDekho take-home · deterministic scoring + Claude explanations
        </footer>
      </body>
    </html>
  );
}
