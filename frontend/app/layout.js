export const metadata = {
  title: 'FoodConnect',
  description: 'Sprint 1 foundation for FoodConnect capstone project',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
