import { fetchHtml } from "../_shared/http.ts";

Deno.serve(async () => {
  void (await fetchHtml("https://example.com/dealapp"));

  return new Response(JSON.stringify({ source: "dealapp", status: "todo" }), {
    headers: { "content-type": "application/json" }
  });
});
