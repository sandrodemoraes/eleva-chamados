import { ImageResponse } from "next/og";

const SIZES = new Set([96, 180, 192, 512]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: raw } = await context.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#c45c16",
          color: "#f3efe6",
          fontSize: size * 0.56,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        E
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "cache-control": "public, max-age=604800, immutable" },
    },
  );
}
