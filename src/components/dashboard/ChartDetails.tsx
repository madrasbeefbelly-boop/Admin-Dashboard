import { useId, type ReactElement, type ReactNode } from 'react';
import { Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ChartDetails({ title, description, children, trigger }: {
  title: string;
  description?: string;
  children: ReactNode;
  trigger?: ReactElement;
}) {
  const descriptionId = useId();
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" size="icon" variant="outline" className="size-10 shrink-0 max-sm:size-11"
            aria-label={`View ${title} details`} title={`View ${title} details`}>
            <Maximize2 className="size-4" aria-hidden="true" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent aria-describedby={description ? descriptionId : undefined}
        className="max-h-[calc(100dvh-1.5rem)] max-w-2xl overflow-y-auto">
        <DialogHeader className="pr-12">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription id={descriptionId}>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
