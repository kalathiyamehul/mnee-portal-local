import Dashboard, { DashPage } from '@/components/pages/dash';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = params.tab || 'activity';
  
  return <Dashboard page={DashPage.ADMIN} defaultTab={tab as string} />;
}