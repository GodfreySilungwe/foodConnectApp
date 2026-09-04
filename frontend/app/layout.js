import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import './globals.css';

export const metadata = {
  title: 'FoodConnect',
  description: 'A trusted marketplace for local food providers and communities',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NotificationProvider>
          <AuthProvider>{children}</AuthProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}
