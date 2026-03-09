export type Surface = {
  slug: string;
  name: string;
  description: string;
};

export const surfaces: Surface[] = [
  {
    slug: "auto-detailing",
    name: "Auto Detailing",
    description: "Structured vehicle surface protocols executed by independent operators.",
  },
];

export const surfaceMap: Record<string, Surface> = Object.fromEntries(
  surfaces.map((surface) => [surface.slug, surface])
);

export function getSurfaceBySlug(slug: string): Surface | undefined {
  return surfaceMap[slug];
}
