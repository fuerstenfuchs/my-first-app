// Standard-Stile und -Gradings für PROJ-29 (Look & Grading System).
// Fest im Code hinterlegt (wie Tageszeit/Wetter im Scene Builder) — keine Datenbankzeilen,
// kein Coverbild. Eigene Stile/Gradings werden dagegen als visual_assets-Zeilen gespeichert
// und im useLookGrading-Hook mit dieser Liste zusammengeführt.

export interface LookGradingPreset {
  key:         string
  name:        string
  description: string
  prompt:      string
  tags:        string[]
}

export const STANDARD_STYLES: LookGradingPreset[] = [
  {
    key: 'dokumentarisch',
    name: 'Dokumentarisch',
    description: 'Reportagehafter, unaufdringlicher Bildstil mit natürlicher Atmosphäre.',
    prompt: 'Documentary photography style, candid and unposed, natural authentic moments, realistic available light, journalistic aesthetic.',
    tags: ['documentary', 'candid', 'photojournalism'],
  },
  {
    key: 'fashion_editorial',
    name: 'Fashion Editorial',
    description: 'Hochwertige Modefotografie wie in einem Premium-Magazin.',
    prompt: 'High-end fashion editorial aesthetic, luxury magazine photography, premium styling, professional commercial quality.',
    tags: ['fashion', 'editorial', 'luxury'],
  },
  {
    key: 'netflix_drama',
    name: 'Netflix Drama',
    description: 'Dunkler, atmosphärischer Serien-Look mit kinoreifer Beleuchtung.',
    prompt: 'Netflix-style drama cinematography, moody desaturated color grading, cinematic depth, high production value, atmospheric tension.',
    tags: ['cinematic', 'drama', 'moody'],
  },
  {
    key: 'filmstill',
    name: 'Filmstill',
    description: 'Wirkt wie ein eingefrorener Moment aus einem Spielfilm.',
    prompt: 'Cinematic film still aesthetic, anamorphic lens characteristics, narrative composition, movie-quality color science, dramatic framing.',
    tags: ['film', 'cinematic', 'still'],
  },
  {
    key: 'musikvideo',
    name: 'Musikvideo',
    description: 'Energiegeladene, stilisierte Bildsprache wie in einem Musikvideo.',
    prompt: 'Music video aesthetic, bold stylized visuals, dynamic energy, vibrant color treatment, fashion-forward art direction.',
    tags: ['musicvideo', 'stylized', 'bold'],
  },
  {
    key: 'werbekampagne',
    name: 'Werbekampagne',
    description: 'Glatter, makelloser Look wie in einer professionellen Werbekampagne.',
    prompt: 'Advertising campaign aesthetic, polished commercial photography, flawless studio-grade finish, aspirational brand styling.',
    tags: ['advertising', 'commercial', 'polished'],
  },
  {
    key: 'instagram_lifestyle',
    name: 'Instagram Lifestyle',
    description: 'Lockerer, authentischer Social-Media-Lifestyle-Look.',
    prompt: 'Instagram lifestyle aesthetic, bright natural light, casual authentic feel, lifestyle influencer photography, soft warm tones.',
    tags: ['lifestyle', 'social', 'casual'],
  },
  {
    key: 'street_photography',
    name: 'Street Photography',
    description: 'Rohe, urbane Straßenfotografie mit dokumentarischem Charakter.',
    prompt: 'Street photography aesthetic, candid urban moments, raw unfiltered realism, natural city light, spontaneous composition.',
    tags: ['street', 'urban', 'candid'],
  },
  {
    key: 'fantasy_epic',
    name: 'Fantasy Epic',
    description: 'Episches, fantasievolles Bildgefühl wie in großen Abenteuerfilmen.',
    prompt: 'Epic fantasy cinematography, mythical grandeur, dramatic atmospheric lighting, legendary adventure aesthetic, painterly cinematic scale.',
    tags: ['fantasy', 'epic', 'cinematic'],
  },
  {
    key: 'scifi_cinematic',
    name: 'Sci-Fi Cinematic',
    description: 'Futuristische, kinoreife Science-Fiction-Ästhetik.',
    prompt: 'Sci-fi cinematic aesthetic, futuristic atmosphere, cool sterile lighting, advanced technology mood, sleek high-contrast visuals.',
    tags: ['scifi', 'futuristic', 'cinematic'],
  },
  {
    key: 'noir',
    name: 'Noir',
    description: 'Klassischer Film-Noir-Look mit starken Schatten und Kontrasten.',
    prompt: 'Classic film noir aesthetic, high-contrast black and white mood, dramatic hard shadows, mysterious atmosphere, vintage detective-story feel.',
    tags: ['noir', 'contrast', 'vintage'],
  },
  {
    key: 'luxury_portrait',
    name: 'Luxury Portrait',
    description: 'Edles, hochwertiges Porträt im Premium-Studio-Stil.',
    prompt: 'Luxury portrait aesthetic, refined elegant styling, premium studio quality, sophisticated soft lighting, high-end editorial polish.',
    tags: ['luxury', 'portrait', 'elegant'],
  },
]

export const STANDARD_GRADINGS: LookGradingPreset[] = [
  {
    key: 'natuerlich',
    name: 'Natürlich',
    description: 'Unverändertes, realistisches Farbbild ohne starke Eingriffe.',
    prompt: 'Natural color grading, true-to-life tones, balanced realistic colors, no artificial color cast.',
    tags: ['natural', 'realistic', 'balanced'],
  },
  {
    key: 'kodak_gold',
    name: 'Kodak Gold',
    description: 'Warmer, nostalgischer Analogfilm-Look.',
    prompt: 'Warm Kodak Gold film aesthetic, golden highlights, soft nostalgic tones, analog photography look.',
    tags: ['film', 'warm', 'nostalgic'],
  },
  {
    key: 'kodak_portra',
    name: 'Kodak Portra',
    description: 'Sanfter, hautfreundlicher Analogfilm-Look mit gedämpften Farben.',
    prompt: 'Kodak Portra film aesthetic, soft natural skin tones, gentle muted colors, fine analog grain, flattering warm light.',
    tags: ['film', 'portra', 'skin-tones'],
  },
  {
    key: 'schwarzweiss',
    name: 'Schwarzweiß',
    description: 'Klassisches monochromes Bild ohne Farbinformation.',
    prompt: 'Black and white grading, monochrome tonal range, rich contrast, classic timeless photography look.',
    tags: ['blackandwhite', 'monochrome', 'classic'],
  },
  {
    key: 'sepia',
    name: 'Sepia',
    description: 'Warmtoniges Vintage-Bild im klassischen Sepia-Look.',
    prompt: 'Sepia tone grading, warm brown vintage tint, aged historic photograph aesthetic, soft nostalgic atmosphere.',
    tags: ['sepia', 'vintage', 'warm'],
  },
  {
    key: 'teal_orange',
    name: 'Teal & Orange',
    description: 'Beliebter Kino-Look mit kühlen Blautönen und warmen Hautfarben.',
    prompt: 'Teal and orange color grading, cinematic blockbuster look, cool teal shadows, warm orange skin tones, strong color contrast.',
    tags: ['cinematic', 'tealorange', 'contrast'],
  },
  {
    key: 'high_contrast',
    name: 'High Contrast',
    description: 'Starker Kontrast zwischen Licht und Schatten.',
    prompt: 'High contrast color grading, deep blacks, bright punchy highlights, bold dramatic tonal range.',
    tags: ['contrast', 'bold', 'dramatic'],
  },
  {
    key: 'muted_colors',
    name: 'Muted Colors',
    description: 'Zurückhaltende, gedämpfte Farbpalette.',
    prompt: 'Muted color grading, desaturated subtle tones, soft restrained palette, understated cinematic mood.',
    tags: ['muted', 'desaturated', 'subtle'],
  },
  {
    key: 'pastel_colors',
    name: 'Pastel Colors',
    description: 'Sanfte, helle Pastellfarben mit luftiger Wirkung.',
    prompt: 'Pastel color grading, soft light airy tones, gentle dreamy palette, delicate low-saturation colors.',
    tags: ['pastel', 'soft', 'dreamy'],
  },
  {
    key: 'bleach_bypass',
    name: 'Bleach Bypass',
    description: 'Hochkontrastiger, entsättigter Filmlook mit silbrigem Glanz.',
    prompt: 'Bleach bypass color grading, desaturated high-contrast look, silvery sheen, gritty cinematic texture.',
    tags: ['bleachbypass', 'gritty', 'cinematic'],
  },
  {
    key: 'cinematic_warm',
    name: 'Cinematic Warm',
    description: 'Warmer, einladender Kino-Look.',
    prompt: 'Cinematic warm color grading, golden amber tones, inviting warm atmosphere, soft filmic glow.',
    tags: ['cinematic', 'warm', 'golden'],
  },
  {
    key: 'cinematic_cool',
    name: 'Cinematic Cool',
    description: 'Kühler, distanzierter Kino-Look mit blauen Tönen.',
    prompt: 'Cinematic cool color grading, blue-tinted shadows, crisp cool atmosphere, modern filmic tone.',
    tags: ['cinematic', 'cool', 'blue'],
  },
]
