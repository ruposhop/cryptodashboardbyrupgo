import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Icono para "Añadir a pantalla de inicio" en iPhone.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0b0d",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64">
          <polyline
            points="12,44 24,32 32,38 52,18"
            fill="none"
            stroke="#e8eaed"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
