import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#6CFF75",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          viewBox="0 0 512 512"
          xmlns="http://www.w3.org/2000/svg"
          fill="#2B2B2B"
          style={{ width: 24, height: 24 }}
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M257.727 96.0098C345.297 96.936 416 168.211 416 256C416 296.813 400.717 334.056 375.564 362.321C372.959 365.25 373.591 369.885 376.985 371.845L445.001 411.113V416H254.283C254.28 416 254.278 415.997 254.278 415.994C254.278 415.991 254.275 415.989 254.272 415.989C166.702 415.063 95.9995 343.789 95.9995 256C95.9995 215.187 111.281 177.943 136.434 149.678C139.04 146.749 138.409 142.114 135.014 140.154L67.0005 100.887V96H257.717L257.727 96.0098ZM256 142C193.039 142 142 193.04 142 256C142 318.96 193.039 370 256 370C318.96 370 370 318.96 370 256C370 193.04 318.96 142 256 142Z"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
