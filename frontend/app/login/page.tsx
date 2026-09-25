'use client';

import { Alert, Button, Card, Input, Label, TextField } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { LocaleToggle } from '@/components/locale-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { ApiError, authApi } from '@/lib/api';
import { isAuthenticated, storeSession } from '@/lib/auth';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) router.replace('/chat');
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === 'login'
          ? await authApi.login(email.trim(), password)
          : await authApi.register(email.trim(), password, name.trim() || undefined);
      storeSession(result.token, result.user);
      router.replace('/chat');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-end gap-1 p-3">
        <LocaleToggle />
        <ThemeToggle />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-sm">
          <Card.Header className="flex flex-col gap-1">
            <Card.Title className="text-xl">{t('app.name')}</Card.Title>
            <Card.Description>{t('auth.subtitle')}</Card.Description>
          </Card.Header>
          <Card.Content>
            <form onSubmit={submit} className="flex flex-col gap-4">
              {mode === 'register' && (
                <TextField value={name} onChange={setName} fullWidth>
                  <Label>{t('auth.name')}</Label>
                  <Input placeholder={t('auth.nameHint')} autoComplete="name" />
                </TextField>
              )}
              <TextField value={email} onChange={setEmail} type="email" isRequired fullWidth>
                <Label>{t('auth.email')}</Label>
                <Input autoComplete="email" placeholder="name@must.edu.mn" />
              </TextField>
              <TextField value={password} onChange={setPassword} type="password" isRequired minLength={8} fullWidth>
                <Label>{t('auth.password')}</Label>
                <Input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'register' ? t('auth.passwordHint') : ''} />
              </TextField>
              {error && (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
              <Button type="submit" variant="primary" fullWidth isDisabled={busy}>
                {mode === 'login' ? t('auth.signIn') : t('auth.register')}
              </Button>
            </form>
          </Card.Content>
          <Card.Footer className="justify-center text-sm text-muted">
            <span className="mr-1">{mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}</span>
            <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
              {mode === 'login' ? t('auth.register') : t('auth.signIn')}
            </button>
          </Card.Footer>
        </Card>
      </div>
    </main>
  );
}
