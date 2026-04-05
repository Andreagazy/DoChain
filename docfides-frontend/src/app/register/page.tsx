'use client';

import { useState } from 'react';
import api from '@/lib/axios';
import { RegisterDto } from '@/types/auth';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import axios from 'axios';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleRegister() {
    const data: RegisterDto = {
      name,
      email,
      password,
    };

    try {
      await api.post('/auth/register', data);

      alert('Register berhasil!');
      window.location.href = '/login';
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.message || 'Register gagal');
      }
    }
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="w-96 space-y-4">
        <h1 className="text-2xl font-bold">Register</h1>

        <Input
          placeholder="Nama"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

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

        <Button onClick={handleRegister} className="w-full">
          Register
        </Button>

        <p className="text-sm text-center">
          Sudah punya akun?{' '}
          <a href="/login" className="text-blue-500">
            Login
          </a>
        </p>
      </div>
    </div>
  );
}
