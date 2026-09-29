import { ImageResponse } from "next/og";
import { IconTile } from "@/lib/brand/app-icon";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

// iOS rounds the corners itself, so the tile is square.
export default function AppleIcon() {
  return new ImageResponse(<IconTile size={180} radius={0} />, { ...size });
}
