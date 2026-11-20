import type { ReactNode } from 'react';
import { businessName, businessTagline, menuPosterUrl } from '@/brand';

interface AuthLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <main className="auth-layout">
      <div className="auth-art">
        <img src={menuPosterUrl} alt="Madras Beef Belly restaurant menu poster" width={1254} height={1254} />
      </div>
      <div className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-brand">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <strong>{businessName}</strong>
              <p>{businessTagline}</p>
            </div>
          </div>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
