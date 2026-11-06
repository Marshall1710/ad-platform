import "./globals.css";

export const metadata = {
  title: "Тестовый Аукцион",
  description: "Локальный каркас тестового Аукциона",
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
