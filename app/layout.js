import './globals.css';
import Shell from '../components/Shell';

export const metadata = {
  title: 'Amol Digital — Billing & Quotations',
  description: 'Quotations, bills, payments and recovery for Amol Digital Flex Printer',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
