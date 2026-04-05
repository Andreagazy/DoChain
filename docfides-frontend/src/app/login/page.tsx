'use client';

import { useState } from 'react';
import api from '@/lib/axios';
import { LoginDto } from '@/types/auth';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import axios from 'axios';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin() {
    const data: LoginDto = {
      email,
      password,
    };

    try {
      const res = await api.post('/auth/login', data);

      localStorage.setItem('token', res.data.access_token);

      window.location.href = '/dashboard';
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.message || 'Login gagal');
      }
    }
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="w-96 space-y-4">
        <h1 className="text-2xl font-bold">Login</h1>

        <Input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button onClick={handleLogin} className="w-full">
          Login
        </Button>

        <p className="text-sm text-center">
          Belum punya akun?{' '}
          <a href="/register" className="text-blue-500">
            Register
          </a>
        </p>
      </div>
    </div>
  );
}
