export type Surface = {
  slug: string;
  name: string;
  description: string;
  status: "live" | "planned";
  image: string;
};

export const surfaces: Surface[] = [
  {
    slug: "auto-detailing",
    name: "Auto Detailing",
    description: "Structured vehicle surface protocols executed by independent operators.",
    status: "live",
    image: "/images/surfaces/auto-detailing.svg",
  },
  {
    slug: "astrology",
    name: "Astrology",
    description: "Interpretive analysis surfaces for personal and decision intelligence.",
    status: "live",
    image: "/images/surfaces/astrology.svg",
  },
  {
    slug: "landscaping",
    name: "Landscaping",
    description: "On-site property maintenance execution with structured job tracking and evidence capture.",
    status: "live",
    image: "/images/surfaces/landscaping.svg",
  },
  {
    slug: "pressure-cleaning",
    name: "Pressure Cleaning",
    description: "Exterior surface cleaning and property care for residential and commercial properties.",
    status: "planned",
    image: "/images/surfaces/pressure-cleaning.svg",
  },
];

export const surfaceMap: Record<string, Surface> = Object.fromEntries(
  surfaces.map((surface) => [surface.slug, surface])
);

export function getSurfaceBySlug(slug: string): Surface | undefined {
  return surfaceMap[slug];
}
