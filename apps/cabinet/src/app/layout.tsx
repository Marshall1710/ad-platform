import "./globals.css";

export const metadata = {
  title: "Кабинет рекламодателя",
  description: "Локальный каркас рекламного кабинета",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
