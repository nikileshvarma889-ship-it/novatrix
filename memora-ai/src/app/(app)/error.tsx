"use client";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger/10 text-danger"><AlertTriangle className="h-6 w-6" /></div>
        <h2 className="mt-4 text-lg font-semibold">Something went wrong</h2>
        <p className="mt-1 text-sm text-muted">This section couldn&apos;t load. Your saved data is safe. Check your connection and try again.</p>
        <Button className="mt-5" onClick={reset}><RotateCcw className="h-4 w-4" />Try again</Button>
      </div>
    </div>
  );
}
