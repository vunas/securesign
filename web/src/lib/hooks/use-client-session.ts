"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchUserProfile, type UserProfile } from "@/lib/api";

export function useClientSession(requiredRole?: string) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    void fetchUserProfile().then((profile) => {
      if (!active) return;
      if (!profile) {
        router.replace("/login");
        return;
      }
      if (requiredRole && profile.role !== requiredRole) {
        router.replace("/dashboard");
        return;
      }

      setUser(profile);
      setIsReady(true);
    });

    return () => {
      active = false;
    };
  }, [requiredRole, router]);

  return { user, isReady };
}
