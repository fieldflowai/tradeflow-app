"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function HeaderNav() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Fetch initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth updates
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    setDropdownOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-3">
        <div className="h-8 w-16 bg-slate-800 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center space-x-3">
        <Link
          href="/login"
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 font-medium transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  const userInitial = user.email ? user.email.charAt(0).toUpperCase() : "U";

  return (
    <div className="flex items-center space-x-3">
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors focus:outline-none"
        >
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
            {userInitial}
          </div>
          <span className="max-w-[120px] truncate">{user.email}</span>
          <svg
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
              dropdownOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 text-slate-800">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                Signed in as
              </p>
              <p className="text-xs font-medium text-slate-900 truncate">
                {user.email}
              </p>
            </div>

            <Link
              href="/dashboard"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4 mr-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="4" width="6" height="6" rx="1" strokeWidth="2" />
                <rect x="14" y="4" width="6" height="6" rx="1" strokeWidth="2" />
                <rect x="4" y="14" width="6" height="6" rx="1" strokeWidth="2" />
                <rect x="14" y="14" width="6" height="6" rx="1" strokeWidth="2" />
              </svg>
              Estimates dashboard
            </Link>

            <Link
              href="/profile"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <svg
                className="w-4 h-4 mr-2 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Profile & Preferences
            </Link>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100"
            >
              <svg
                className="w-4 h-4 mr-2 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
