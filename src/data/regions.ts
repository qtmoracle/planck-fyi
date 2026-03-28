export type Region = {
  slug: string;
  name: string;
  country: string;
  state: string;
  city: string;
};

export const regions: Region[] = [
  {
    slug: "miami",
    name: "Miami",
    country: "us",
    state: "fl",
    city: "miami",
  },
];

export const regionMap: Record<string, Region> = Object.fromEntries(
  regions.map((region) => [region.slug, region])
);

export function getRegionBySlug(slug: string): Region | undefined {
  return regionMap[slug  {
    slug: "fort-lauderdale",
    name: "Broward County",
    country: "us",
    state: "fl",
    city: "fort-lauderdale",
  },
];
}
