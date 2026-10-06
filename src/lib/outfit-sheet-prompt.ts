/* Der Auftragstext fuer das Ghost-Mannequin-Sheet — EINE Fassung fuer die
   Server-Route (bezahlter Anthropic-Schluessel) und fuer Marks Proxy im
   Browser. Zwei Kopien liefen auseinander, ohne dass es jemand merkte. */

export interface OutfitSheetEingabe {
  outfitName: string
  outfitDescription?: string | null
  outfitTags?: string[]
  /** Wie viele Bilder der Analyse beiliegen. */
  bilder: number
}

export function outfitSheetText({ outfitName, outfitDescription, outfitTags = [], bilder }: OutfitSheetEingabe): string {
  const metaParts = [`Outfit name: "${outfitName}"`]
  if (outfitDescription) metaParts.push(`Description: ${outfitDescription}`)
  if (outfitTags.length) metaParts.push(`Tags: ${outfitTags.join(', ')}`)
  const metaText = metaParts.join('. ')
  return bilder > 0
          ? `${metaText}

Analyze every clothing piece and accessory visible in these outfit images. Then generate a single, ready-to-use image generation prompt (for Midjourney, Flux, or Stable Diffusion) that shows the complete outfit as a ghost mannequin / invisible mannequin photo.

Requirements for the prompt:
- Ghost mannequin effect: clothes look worn and 3D-shaped, but NO person, NO model, NO skin, NO face, NO hands, NO feet visible anywhere
- Front view on the LEFT side, back view on the RIGHT side — both on one image side by side
- White or very light neutral background
- Professional fashion product photography style
- Describe every garment precisely (color, fabric texture, cut, details like buttons/zippers/prints)
- Do NOT mention any person, body, or model

Output ONLY the prompt text. No explanation, no intro, no quotes around it.`
          : `${metaText}

Generate a single, ready-to-use image generation prompt (for Midjourney, Flux, or Stable Diffusion) that shows this outfit as a ghost mannequin / invisible mannequin photo.

Requirements:
- Ghost mannequin effect: clothes look worn and 3D-shaped, but NO person, NO model, NO skin visible
- Front view on the LEFT, back view on the RIGHT — both on one image
- White background, professional fashion product photography
- Describe plausible garments based on the outfit name and tags

Output ONLY the prompt text. No explanation, no intro.`
}
