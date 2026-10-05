'use client';

import { Spinner } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { registrationApi } from '@/lib/api';

/** Class-time selection while it is open, otherwise the graduation plan. */
export default function RegistrationIndex() {
  const router = useRouter();
  useEffect(() => {
    registrationApi
      .current()
      .then(({ term }) => router.replace(term.phase === 'schedule' ? '/registration/schedule' : '/registration/plan'))
      .catch(() => router.replace('/registration/plan'));
  }, [router]);
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  );
}
