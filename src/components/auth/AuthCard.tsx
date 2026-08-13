import { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div
      className="mx-auto w-full max-w-md rounded-3xl border p-8 shadow-[0_28px_72px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
      style={{
        background:
          "linear-gradient(160deg, var(--auth-surface-strong) 0%, var(--auth-surface) 56%, rgba(143,191,148,0.08) 100%)",
        borderColor: "var(--auth-border)",
      }}
    >
      <p className="mb-2 text-xs uppercase tracking-[0.24em] text-[var(--color-secondary)]">SucculentSphere</p>
      <h1 className="font-serif text-4xl leading-tight text-[var(--color-text)]">{title}</h1>
      <p className="mt-3 text-sm text-[var(--auth-muted)]">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
