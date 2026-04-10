'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import InvestorDashboard from '@/components/InvestorDashboard';

export default function InvestorPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const slug = params.slug as string;

      // Fetch investor data from API
      const res = await fetch(`/api/investor-data?slug=${slug}`, {
        headers: { 'x-user-id': session.user.id }
      });

      if (!res.ok) {
        router.push('/login');
        return;
      }

      const result = await res.json();
      setData(result);
      setLoading(false);
    }

    load();
  }, []);

  if (loading) return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#070a12',
      color: '#a6b4d0',
      fontFamily: 'sans-serif',
      fontSize: 14
    }}>
      Loading your dashboard...
    </div>
  );

  return (
    <InvestorDashboard
      investor={data.investor}
      navRecords={data.navRecords}
      latestStatement={data.latestStatement}
    />
  );
}
