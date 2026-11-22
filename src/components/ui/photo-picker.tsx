import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];

async function preparePhoto(file: File) {
  if (!supportedTypes.includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a photo smaller than 20 MB.');

  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    const size = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * size));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * size));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not prepare this photo.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.72, 0.55, 0.38, 0.2]) {
      const photo = canvas.toDataURL('image/jpeg', quality);
      if (photo.length <= 341355) return photo;
    }
    throw new Error('Choose a smaller photo.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface PhotoPickerProps {
  label: string;
  source?: string | null;
  disabled?: boolean;
  onChange: (photo: string | null) => void;
  onPendingChange: (pending: boolean) => void;
}

export function PhotoPicker({ label, source, disabled, onChange, onPendingChange }: PhotoPickerProps) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const work = useRef<AbortController | null>(null);

  useEffect(() => () => work.current?.abort(), []);

  async function choose(file?: File) {
    if (!file) return;
    const task = new AbortController();
    work.current?.abort();
    work.current = task;
    setPending(true);
    onPendingChange(true);
    setError('');
    try {
      const photo = await preparePhoto(file);
      if (!task.signal.aborted) onChange(photo);
    } catch (error) {
      if (!task.signal.aborted) {
        setError(error instanceof DOMException ? 'Could not open this photo. Choose another file.' : (error as Error).message);
      }
    } finally {
      if (!task.signal.aborted) {
        setPending(false);
        onPendingChange(false);
      }
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="flex items-start gap-3 rounded-md border border-input bg-background p-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
          {source ? <img src={source} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Input
            id={id}
            type="file"
            accept={supportedTypes.join(',')}
            disabled={disabled || pending}
            aria-describedby={`${id}-hint`}
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              event.target.value = '';
            }}
            className="h-auto min-h-9 bg-background text-xs"
          />
          <p id={`${id}-hint`} className="text-xs text-muted-foreground" aria-live="polite">
            {pending ? 'Preparing photo…' : 'JPG, PNG, or WebP · Up to 20 MB'}
          </p>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          {source && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || pending}
              className="h-9 px-2 text-xs text-destructive"
              onClick={() => { setError(''); onChange(null); }}
            >
              <Trash2 className="mr-1.5 size-3.5" /> Remove photo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
