import config from '@/config';

export function catalogPhotoSource(src: string) {
  return src.startsWith('/api/catalog-photos/') ? config.apiUrl + src : src;
}
