export type Region = {
  slug: string;
  name: string;
};

export const regions: Region[] = [
  {
    slug: "miami",
    name: "Miami",
  },
];

export const regionMap: Record<string, Region> = Object.fromEntries(
  regions.map((region) => [region.slug, region])
);

export function getRegionBySlug(slug: string): Region | undefined {
  return regionMap[slug];
}
