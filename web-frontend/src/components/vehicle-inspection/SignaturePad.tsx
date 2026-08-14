"use client";

import { useEffect, useRef } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

type SignaturePadProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 240;

export function SignaturePad({ value, onChange, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const drawingContext = canvas?.getContext("2d");
    if (!canvas || !drawingContext) return;
    drawingContext.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (!value) return;

    const signature = new Image();
    signature.onload = () => drawingContext.drawImage(signature, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    signature.src = value;
  }, [value]);

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH,
      y: ((event.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT,
    };
  };

  const context = () => {
    const drawingContext = canvasRef.current?.getContext("2d");
    if (!drawingContext) return null;
    drawingContext.strokeStyle = "#17315F";
    drawingContext.lineWidth = 4;
    drawingContext.lineCap = "round";
    drawingContext.lineJoin = "round";
    return drawingContext;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    onChange("");
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <canvas
        ref={canvasRef}
        aria-label="Personnel signature pad"
        className="aspect-[10/3] w-full touch-none cursor-crosshair bg-surface"
        height={CANVAS_HEIGHT}
        width={CANVAS_WIDTH}
        onPointerDown={(event) => {
          if (disabled) return;
          const drawingContext = context();
          if (!drawingContext) return;
          drawingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = canvasPoint(event);
          drawingContext.beginPath();
          drawingContext.moveTo(point.x, point.y);
          drawingContext.lineTo(point.x + 0.01, point.y + 0.01);
          drawingContext.stroke();
        }}
        onPointerMove={(event) => {
          if (!drawingRef.current || disabled) return;
          const drawingContext = context();
          if (!drawingContext) return;
          const point = canvasPoint(event);
          drawingContext.lineTo(point.x, point.y);
          drawingContext.stroke();
        }}
        onPointerUp={(event) => {
          if (!drawingRef.current) return;
          drawingRef.current = false;
          context()?.closePath();
          onChange(event.currentTarget.toDataURL("image/png"));
        }}
        onPointerCancel={() => {
          drawingRef.current = false;
        }}
      />
      <div className="flex items-center justify-between border-t border-border bg-background px-3 py-2">
        <p className="text-xs text-muted-foreground">
          {value ? "Signature captured" : "Sign using a mouse, finger, or stylus."}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !value}
          onClick={clear}
        >
          <Eraser /> Clear
        </Button>
      </div>
    </div>
  );
}
