import type { AstroComponentFactory } from "astro/runtime/server";
import V1AstrologyOperatorTemplate from "../templates/operator/v1/astrology.astro";
import V1DetailingOperatorTemplate from "../templates/operator/v1/detailing.astro";

export type OperatorTemplateKey = {
  template: string;
  surface: string;
};

const operatorTemplateRegistry: Record<string, AstroComponentFactory> = {
  "v1:auto-detailing": V1DetailingOperatorTemplate,
  "v1:astrology": V1AstrologyOperatorTemplate,
};

export function getOperatorTemplate(
  template: string,
  surface: string
): AstroComponentFactory | undefined {
  const key = `${String(template).trim()}:${String(surface).trim()}`;
  return operatorTemplateRegistry[key];
}
