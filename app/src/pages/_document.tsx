import { Head, Html, Main, NextScript } from "next/document";

const RTL_SCRIPT = `(function(){try{var p=location.pathname;if(/^\\/ar(\\/|$)/.test(p)){var d=document.documentElement;d.lang='ar';d.dir='rtl';}}catch(_){}})();`;

export default function Document() {
  return (
    <Html lang="en" dir="ltr" className="dark">
      <Head>
        <meta name="theme-color" content="#0d1b2a" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <script dangerouslySetInnerHTML={{ __html: RTL_SCRIPT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
