import Dashboard, { DashPage } from '@/components/pages/dash';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const showTransfer = params.showTransfer === 'true';
  const address = params.address as string | undefined;
  
  return <Dashboard page={DashPage.WALLET} defaultShowTransfer={showTransfer} defaultAddress={address} />;
}