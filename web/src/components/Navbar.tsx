import { Suspense } from "react";
import Link from "next/link";
import { getServerSession } from "@/lib/server/session";
import NavbarClient from "./NavbarClient";

function NavbarControlsFallback() {
  return (
    <div className="flex flex-1 items-center justify-end">
      <div
        aria-label="Đang tải thông tin tài khoản"
        aria-busy="true"
        className="h-8 w-24 animate-pulse rounded-lg bg-slate-100"
      />
    </div>
  );
}

async function NavbarSessionLoader() {
  const { profile, hasSession } = await getServerSession();
  return <NavbarClient initialProfile={profile} hasSession={hasSession} />;
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
      <div className="relative flex h-14 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* 1. LEFT: Brand Logo (100% Server HTML, không bị lặp lại ở Fallback hay Client) */}
        <div className="flex flex-1 items-center justify-start">
          <Link
            href="/"
            className="group inline-flex shrink-0 items-center gap-2.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-tr from-blue-600 to-indigo-600 text-white shadow-xs transition group-hover:shadow-indigo-500/30">
              <i
                className="fa-solid fa-file-signature text-xs"
                aria-hidden="true"
              />
            </div>
            <span className="text-base font-extrabold tracking-tight text-slate-900">
              Secure<span className="text-blue-600">Sign</span>
            </span>
          </Link>
        </div>

        {/* 2. CENTER & RIGHT: Stream dữ liệu session từ Server */}
        <Suspense fallback={<NavbarControlsFallback />}>
          <NavbarSessionLoader />
        </Suspense>
      </div>
    </header>
  );
}
