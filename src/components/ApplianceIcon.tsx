import type { SVGProps } from "react";

export default function ApplianceIcon({
  kind,
  ...props
}: SVGProps<SVGSVGElement> & { kind: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {kind === "fridge" ? (
        <>
          <rect x="10" y="4" width="20" height="31" rx="2" />
          <path d="M10 15h20M14 9v3m0 8v6M13 35v2m14-2v2" />
        </>
      ) : kind === "chest-freezer" ? (
        <>
          <rect x="4" y="12" width="32" height="22" rx="2" />
          <path d="M4 17h32M17 21h6M8 34v3m24-3v3" />
        </>
      ) : kind === "tv" ? (
        <>
          <rect x="3" y="7" width="34" height="24" rx="2" />
          <path d="m13 36 4-5m10 5-4-5M8 12h24" />
        </>
      ) : kind === "aircon" ? (
        <>
          <rect x="3" y="8" width="34" height="15" rx="3" />
          <path d="M7 18h26M9 13h5m2 0h2m-7 15c-4 4 4 5 0 9m9-9c-4 4 4 5 0 9m9-9c-4 4 4 5 0 9" />
        </>
      ) : kind === "pool-pump" ? (
        <>
          <rect x="12" y="9" width="17" height="21" rx="3" />
          <path d="M12 16H6v12H3m26-6h7v10M16 5h9M15 34h11M16 14h9m-9 5h9m-9 5h9" />
        </>
      ) : kind === "dishwasher" ? (
        <>
          <rect x="7" y="4" width="26" height="32" rx="2" />
          <path d="M7 12h26M12 8h4m10 0h1M14 17v13m6-13v13m6-13v13M11 30h18" />
        </>
      ) : (
        <>
          <rect x="7" y="4" width="26" height="32" rx="2" />
          <path d="M7 12h26M11 8h7m9 0h1" />
          <circle cx="20" cy="23" r="8" />
          {kind === "dryer" ? (
            <path d="M16 20c-3 4 4 3 1 7m6-8c-3 4 4 3 1 7" />
          ) : (
            <path d="M13 24c3-4 5 4 8 0s5-2 7 0" />
          )}
        </>
      )}
    </svg>
  );
}
