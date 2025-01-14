import { Suspense } from 'react';
import LoginPage from '@/components/pages/login';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}