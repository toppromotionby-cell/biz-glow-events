// Браузерный исполнитель одного примитива холста.
//
// Исполняет ровно тот же `DrawOp`, что уходит в PDF, поэтому превью и файл
// не могут разойтись по геометрии: отличается только способ рисования.
import type { CSSProperties } from "react";
import type { DrawOp } from "@/lib/canvas/ops";

const boxStyle = (op: Extract<DrawOp, { x: number }>): CSSProperties => ({
  position: "absolute",
  left: op.x,
  top: op.y,
  width: op.w,
  height: op.h,
});

export function CanvasElementView({ op }: { op: DrawOp }) {
  if (op.kind === "rect") {
    return (
      <div
        style={{
          ...boxStyle(op),
          background: op.fill,
          borderRadius: op.radius,
          opacity: op.opacity,
        }}
      />
    );
  }

  if (op.kind === "image") {
    return (
      <div style={{ ...boxStyle(op), borderRadius: op.radius, overflow: "hidden" }}>
        <img
          src={op.src}
          alt=""
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: op.fit, display: "block" }}
        />
      </div>
    );
  }

  const justify =
    op.valign === "middle" ? "center" : op.valign === "bottom" ? "flex-end" : "flex-start";
  const lines = op.lines ?? op.text.split("\n");

  return (
    <div
      style={{
        ...boxStyle(op),
        display: "flex",
        flexDirection: "column",
        justifyContent: justify,
        color: op.color,
        fontSize: op.fontSize,
        lineHeight: op.lineHeight,
        fontWeight: op.weight,
        textAlign: op.align,
        letterSpacing: op.letterSpacing || undefined,
        textTransform: op.uppercase ? "uppercase" : undefined,
        fontFamily: op.font === "display" ? "var(--font-display, inherit)" : "inherit",
        whiteSpace: "pre-wrap",
        overflow: "hidden",
      }}
    >
      {lines.map((line, i) => (
        <span key={`${i}-${line}`}>{line || "\u00A0"}</span>
      ))}
    </div>
  );
}
