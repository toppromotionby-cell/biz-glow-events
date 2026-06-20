// Простая SVG-иконка TikTok в стилистике lucide (тонкая обводка currentColor).
// В lucide-react такой иконки нет — поэтому свой компонент.
import type { SVGProps } from "react";

export function TikTokIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* «Нота» TikTok: вертикальная ось с засечкой и круг-головка */}
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}
