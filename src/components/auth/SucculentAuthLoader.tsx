"use client";

import { useId } from "react";

type SucculentAuthLoaderProps = {
  show: boolean;
  title: string;
  message: string;
};

export default function SucculentAuthLoader({ show, title, message }: SucculentAuthLoaderProps) {
  const clipId = `succulent-loader-${useId().replace(/:/g, "")}`;

  if (!show) return null;

  const leaves = (
    <>
      <path d="M64 19C54 30 54 43 64 55C74 43 74 30 64 19Z" />
      <path d="M64 73C54 85 54 98 64 109C74 98 74 85 64 73Z" />
      <path d="M19 64C30 54 43 54 55 64C43 74 30 74 19 64Z" />
      <path d="M73 64C85 54 98 54 109 64C98 74 85 74 73 64Z" />
      <path d="M33 33C47 34 56 42 58 57C43 55 34 47 33 33Z" />
      <path d="M95 33C94 47 86 56 71 58C73 43 81 34 95 33Z" />
      <path d="M33 95C34 81 42 72 57 70C55 85 47 94 33 95Z" />
      <path d="M95 95C81 94 72 86 70 71C85 73 94 81 95 95Z" />
      <path d="M64 42C56 51 56 61 64 70C72 61 72 51 64 42Z" />
      <path d="M42 64C51 56 61 56 70 64C61 72 51 72 42 64Z" />
      <circle cx="64" cy="64" r="8" />
    </>
  );

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-[#f5f3ef]/[0.88] px-4 backdrop-blur-xl dark:bg-[#071018]/[0.88]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-sm rounded-[1.75rem] border border-[var(--auth-border)] bg-[var(--auth-surface-strong)] p-6 text-center shadow-[0_28px_90px_rgba(18,31,24,0.24)]">
        <div className="mx-auto grid h-36 w-36 place-items-center rounded-full border border-[var(--auth-border)] bg-white/[0.72] shadow-inner dark:bg-white/5">
          <div className="relative h-28 w-28">
            <div className="absolute inset-0 rounded-full border border-[#d7e3d6] bg-[#f7faf5]" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 128 128" aria-hidden="true">
              <g fill="#dbe8d4" stroke="#55705f" strokeWidth="2.4" strokeLinejoin="round">
                {leaves}
              </g>
            </svg>
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 128 128" aria-hidden="true">
              <defs>
                <linearGradient id={`${clipId}-gradient`} x1="0" x2="1" y1="1" y2="0">
                  <stop offset="0%" stopColor="#344E41" />
                  <stop offset="54%" stopColor="#8FBF94" />
                  <stop offset="100%" stopColor="#CB997E" />
                </linearGradient>
                <clipPath id={clipId}>
                  <rect className="succulent-fill-rect" x="0" y="128" width="128" height="0" />
                </clipPath>
              </defs>
              <g clipPath={`url(#${clipId})`} fill={`url(#${clipId}-gradient)`} stroke="#294337" strokeWidth="2.4" strokeLinejoin="round">
                {leaves}
              </g>
            </svg>
            <span className="succulent-loader-sheen absolute inset-0 rounded-full" />
          </div>
        </div>

        <h2 className="mt-5 font-serif text-2xl text-[var(--color-text)]">{title}</h2>
        <p className="mt-2 text-sm text-[var(--auth-muted)]">{message}</p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[rgb(var(--ss-secondary-rgb)/0.2)]">
          <div className="succulent-progress-bar h-full rounded-full bg-[linear-gradient(90deg,#344E41,#8FBF94,#CB997E)]" />
        </div>
      </div>
    </div>
  );
}
