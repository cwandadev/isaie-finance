import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Calculator({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");

  const push = (v: string) => setExpr((e) => e + v);
  const clear = () => { setExpr(""); setResult(""); };
  const back = () => setExpr((e) => e.slice(0, -1));
  const equals = () => {
    try {
      // Sanitize: only digits, operators, parens, dot, spaces
      if (!/^[\d+\-*/().\s]+$/.test(expr)) throw new Error("bad");
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${expr})`)();
      setResult(String(Number.isFinite(v) ? v : ""));
    } catch { setResult("Error"); }
  };

  const keys = [
    ["7", "8", "9", "/"],
    ["4", "5", "6", "*"],
    ["1", "2", "3", "-"],
    ["0", ".", "(", ")"],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs gold-card gold-card-hover">
        <DialogHeader>
          <DialogTitle>Calculator</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg bg-muted/60 p-3 text-right font-mono">
          <div className="text-xs text-muted-foreground min-h-4 truncate">{expr || "0"}</div>
          <div className="text-2xl font-bold text-gold min-h-9">{result}</div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Button variant="outline" onClick={clear} className="col-span-2">AC</Button>
          <Button variant="outline" onClick={back}>⌫</Button>
          <Button variant="outline" onClick={() => push("+")}>+</Button>
          {keys.flat().map((k) => (
            <Button key={k} variant={/[\d.()]/.test(k) ? "secondary" : "outline"} onClick={() => push(k)}>
              {k}
            </Button>
          ))}
          <Button onClick={equals} className={cn("col-span-4 metal-btn")}>=</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}