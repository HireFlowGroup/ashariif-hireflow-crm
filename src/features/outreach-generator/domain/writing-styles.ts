import type { OutreachWritingStyle } from "@/features/outreach-generator/domain/generator.types";

export const WRITING_STYLE_INSTRUCTIONS: Record<OutreachWritingStyle, string> = {
  formal: "Schrijf in formele, zakelijke usted-vorm. Professioneel en respectvol, zonder informele groet.",
  friendly: "Schrijf warm en toegankelijk, maar professioneel. Gebruik 'je' waar passend. Menselijk en oprecht.",
  direct: "Schrijf kort, concreet en to-the-point. Geen omwegen. Maximaal impact in minimale woorden.",
  consultative: "Schrijf als adviseur: stel vragen, toon begrip voor hun hiring-situatie, bied waarde vóór een vraag.",
};

export function getWritingStyleInstruction(style: OutreachWritingStyle): string {
  return WRITING_STYLE_INSTRUCTIONS[style];
}
