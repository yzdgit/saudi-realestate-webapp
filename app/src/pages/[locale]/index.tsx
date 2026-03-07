import { useEffect } from "react";
import { useRouter } from "next/router";
import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from "next";
import { localeStaticPaths, localeStaticProps, type LocalePageProps } from "@/lib/locale-static";

export const getStaticPaths: GetStaticPaths = localeStaticPaths;

export const getStaticProps: GetStaticProps<LocalePageProps> = async (context) => localeStaticProps(context);

export default function LocaleEntryRedirect({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  const router = useRouter();

  useEffect(() => {
    void router.replace({
      pathname: "/[locale]/listings",
      query: {
        ...router.query,
        locale,
        mode: "browse"
      }
    });
  }, [locale, router]);

  return null;
}
