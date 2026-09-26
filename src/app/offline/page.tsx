import type { Metadata } from "next";
import Link from "next/link";
import RetryButton from "./RetryButton";

export const metadata: Metadata = {
  title: "You are offline | Succulent Sphere",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f7f2e7_0%,#efe9df_50%,#ebe6dc_100%)] px-4 py-20">
      <div className="pointer-events-none absolute -left-28 top-24 h-64 w-64 rounded-full bg-[#dbe8d7]/35 blur-3xl" />
      <div className="relative container mx-auto">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-[#ddd2c2] bg-[linear-gradient(140deg,#fff8ec_0%,#f2ede3_62%,#ecf2ea_100%)] p-8 text-center shadow-[0_35px_70px_-42px_rgba(57,69,60,0.72)]">
          <div className="mx-auto mb-5 h-1.5 w-24 rounded-full bg-[linear-gradient(90deg,#4e6a58,#b98e66)]" />
          <h1 className="font-serif text-3xl text-[#1f2b24]">You are offline</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#43534a]">
            It looks like there is no internet connection right now. Pages you have already visited still work,
            but anything new needs a connection.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <RetryButton />
            <Link
              href="/"
              className="rounded-xl border border-[#ccbba4] bg-white/80 px-5 py-2.5 text-sm font-semibold text-[#304338] transition hover:bg-white"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
