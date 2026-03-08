import type { AppProps } from "next/app";
import Script from "next/script";
import "@/styles/globals.css";
import "leaflet/dist/leaflet.css";

export default function App({ Component, pageProps }: AppProps) {
  const adsenseClient =
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-7743605693493615";

  return (
    <>
      {adsenseClient ? (
        <Script
          id="adsense-script"
          async
          strategy="afterInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
          crossOrigin="anonymous"
        />
      ) : null}
      <Component {...pageProps} />
    </>
  );
}
