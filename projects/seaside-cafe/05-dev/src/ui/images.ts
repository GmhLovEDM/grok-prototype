export type DecodedImage = Pick<HTMLImageElement, "src">;
type ImageLoader = (src: string) => Promise<DecodedImage>;

export async function decodeImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  await image.decode();
  return image;
}

export class ImageCache {
  private readonly entries = new Map<string, Promise<DecodedImage>>();

  constructor(private readonly decode: ImageLoader, private readonly limit = 4) {}

  load(src: string): Promise<DecodedImage> {
    const cached = this.entries.get(src);
    if (cached) {
      this.entries.delete(src);
      this.entries.set(src, cached);
      return cached;
    }
    const pending = this.decode(src).catch((error: unknown) => {
      if (this.entries.get(src) === pending) this.entries.delete(src);
      throw error;
    });
    this.entries.set(src, pending);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return pending;
  }
}

export class ImagePresenter {
  private revision = 0;
  private shown: string | null = null;

  constructor(private readonly cache: ImageCache, private readonly paint: (image: DecodedImage | null) => void) {}

  async show(src: string | null): Promise<boolean> {
    const revision = ++this.revision;
    if (src === null) {
      this.shown = null;
      this.paint(null);
      return true;
    }
    if (src === this.shown) return true;
    let image: DecodedImage;
    try {
      image = await this.cache.load(src);
    } catch {
      // Keep the last decoded frame; a later request may retry the image.
      return false;
    }
    if (revision !== this.revision) return false;
    this.paint(image);
    this.shown = src;
    return true;
  }
}
