import { ImageResponse } from "next/og";
import { IconTile } from "@/lib/brand/app-icon";

export const runtime = "edge";

// Square: the manifest marks this icon maskable, so the OS applies the shape.
export async function GET() {
  return new ImageResponse(<IconTile size={192} radius={0} />, { width: 192, height: 192 });
}
