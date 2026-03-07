import { useEffect } from "react";
import { useRouter } from "next/router";
import { defaultLocale } from "@/lib/i18n";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    void router.replace(`/${defaultLocale}/listings?mode=browse`);
  }, [router]);

  return null;
}
