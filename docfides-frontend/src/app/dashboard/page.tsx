'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { User } from '@/types/auth';

import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.get('/auth/me');
        setUser(res.data);
      } catch {
        window.location.href = '/login';
      }
    }

    loadProfile();
  }, []);

  function handleLogout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  if (!user) {
    return <p className="p-8">Loading...</p>;
  }

  return (
    <div className="p-8 space-y-4">

      <p>
        <b>Nama:</b> {user.name}
      </p>

      <p>
        <b>Email:</b> {user.email}
      </p>

      <Button onClick={handleLogout} variant="destructive">
        Logout
      </Button>
    </div>
  );
}
