export type AccessState = "active" | "limited" | "suspended";

export type Operator = {
  slug: string;
  name: string;
  logo: string;

  country: string;
  state: string;
  city: string;

  regionName: string;

  surface: string;
  tagline: string;

  template: "v1";
  bookingHref: string;

  accessState: AccessState;
};

export const operators: Operator[] = [
  {
    slug: "qtm-detailing",
    name: "QTM Detailing",
    logo: "/brand/planck-wordmark.png",

    country: "us",
    state: "fl",
    city: "miami",

    regionName: "Miami Dade County",

    surface: "auto-detailing",
    tagline: "Structured execution for vehicles that deserve precision.",

    template: "v1",
    bookingHref: "#request",
    accessState: "active"
  },
  {
    slug: "qtm-astrology",
    name: "QTM Astrology",
    logo: "/brand/planck-wordmark.png",

    country: "us",
    state: "fl",
    city: "miami",

    regionName: "Miami Dade County",

    surface: "astrology",
    tagline: "Interpretive analysis for timing, patterns, and decision clarity.",

    template: "v1",
    bookingHref: "#request-session",
    accessState: "active"
  },
  {
    slug: "qtm-landscaping",
    name: "QTM Landscaping",
    logo: "/brand/planck-wordmark.png",

    country: "us",
    state: "fl",
    city: "miami",

    regionName: "Miami Dade County",

    surface: "landscaping",
    tagline: "Structured execution for properties that deserve consistent care.",

    template: "v1",
    bookingHref: "#request",
    accessState: "active"
  },
  {
    slug: "sunrise-landscaping",
    name: "Sunrise Landscaping",
    logo: "/brand/planck-wordmark.png",

    country: "us",
    state: "fl",
    city: "fort-lauderdale",

    regionName: "Broward County",

    surface: "landscaping",
    tagline: "Structured property care for Broward County.",

    template: "v1",
    bookingHref: "#request",
    accessState: "active"
  },
  {
    slug: "qtm-events",
    name: "QTM Events",
    logo: "/brand/planck-wordmark.png",

    country: "us",
    state: "fl",
    city: "miami",

    regionName: "Miami Dade County",

    surface: "event-coordination",
    tagline: "Structured execution for events that demand precision.",

    template: "v1",
    bookingHref: "#request",
    accessState: "active"
  }
];

export const operatorMap: Record<string, Operator> = Object.fromEntries(
  operators.map((op) => [op.slug, op])
);

export function getOperatorBySlug(slug: string): Operator | undefined {
  return operatorMap[slug];
}
