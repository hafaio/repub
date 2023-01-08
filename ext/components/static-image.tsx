import Image, { ImageLoaderProps, ImageProps } from "next/image";
import { ReactElement } from "react";

function staticLoader({ src }: ImageLoaderProps): string {
  return src;
}

interface StaticImageProps extends ImageProps {
  alt: string;
  loader?: never;
  unoptimized?: never;
}

export default function StaticImage({
  alt,
  ...props
}: StaticImageProps): ReactElement {
  return <Image alt={alt} {...props} loader={staticLoader} unoptimized />;
}
