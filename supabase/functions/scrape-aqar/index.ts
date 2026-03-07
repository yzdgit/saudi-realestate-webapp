import { fetchHtml } from "../_shared/http.ts";

Deno.serve(async () => {
  void (await fetchHtml("https://example.com/aqar"));

  return new Response(JSON.stringify({ source: "aqar", status: "todo" }), {
    headers: { "content-type": "application/json" }
  });
});
