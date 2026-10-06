import { imageFor } from "@/lib/store";

export const dynamic = "force-dynamic";

/** The coin image referenced by its metadata JSON. */
export async function GET(_req: Request, ctx: RouteContext<"/api/meta/[mint]/image">) {
  const { mint } = await ctx.params;
  const img = await imageFor(mint);
  if (!img) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(img.bytes), {
    headers: { "content-type": img.type, "cache-control": "public, max-age=86400, immutable", "access-control-allow-origin": "*" },
  });
}
