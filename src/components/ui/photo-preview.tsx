import { useState, type ReactNode } from 'react';
import { Maximize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PhotoPreviewProps {
  name: string;
  src: string;
  children: ReactNode;
  className?: string;
  showExpandIcon?: boolean;
}

export function PhotoPreview({ name, src, children, className, showExpandIcon }: PhotoPreviewProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  return (
    <Dialog onOpenChange={(open) => { if (open) setFailedSource(null); }}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`View photo of ${name}`}
          className={cn(
            'relative block cursor-zoom-in overflow-hidden rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
            className,
          )}
        >
          {children}
          {showExpandIcon && (
            <span className="pointer-events-none absolute bottom-2 right-2 grid size-7 place-items-center rounded-md bg-black/75 text-white" aria-hidden="true">
              <Maximize2 className="size-3.5" />
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="w-[calc(100%-1.5rem)] max-w-4xl gap-3 rounded-xl p-3 max-md:p-3 sm:p-4"
      >
        <DialogTitle className="flex min-h-9 items-center pr-12 text-base leading-snug wrap-anywhere">
          {name}
        </DialogTitle>
        <div className="overflow-hidden rounded-md bg-slate-950">
          {failedSource === src ? (
            <p role="status" className="p-6 text-center text-sm text-white">Couldn’t load this photo.</p>
          ) : (
            <img
              src={src}
              alt={name}
              className="mx-auto block max-h-[calc(100dvh-7rem)] w-full object-contain"
              onError={() => setFailedSource(src)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
