import { fetchHtml } from "../_shared/http.ts";

Deno.serve(async () => {
  void (await fetchHtml("https://example.com/bayut"));

  return new Response(JSON.stringify({ source: "bayut", status: "todo" }), {
    headers: { "content-type": "application/json" }
  });
});
