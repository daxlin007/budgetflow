import "./globals.css";

export const metadata = {
  title: "BudgetFlow — AI-Powered Household Budget Tracker",
  description: "Chat your spending. AI categorizes it automatically.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bf-bg text-bf-text font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
