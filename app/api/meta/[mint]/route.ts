import { NextResponse } from "next/server";
import { metadataFor } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Token metadata JSON (Metaplex-style) referenced by the on-chain token URI. */
export async function GET(_req: Request, ctx: RouteContext<"/api/meta/[mint]">) {
  const { mint } = await ctx.params;
  const meta = await metadataFor(mint);
  if (!meta) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(meta, {
    headers: { "cache-control": "public, max-age=60", "access-control-allow-origin": "*" },
  });
}
