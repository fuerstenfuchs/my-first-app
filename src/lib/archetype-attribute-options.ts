interface AttributeOptionConfig {
  options:     string[]
  allowCustom: boolean
  multi?:      boolean
}

export const CHARACTER_ATTRIBUTE_OPTIONS: Record<string, AttributeOptionConfig> = {
  geschlecht:      { options: ['weiblich', 'männlich', 'divers'], allowCustom: false },
  alter:           { options: ['Kind', 'Teenager', '20er', '30er', '40er', '50er', '60er', 'Senior'], allowCustom: false },
  koerperbau:      { options: ['schlank', 'durchschnittlich', 'athletisch', 'muskulös', 'kräftig', 'kurvig'], allowCustom: false },
  groesse:         { options: ['klein', 'durchschnittlich', 'groß'], allowCustom: false },
  haarfarbe:       { options: ['blond', 'braun', 'schwarz', 'rot', 'grau', 'weiß', 'bunt'], allowCustom: false },
  haarstil:        { options: ['kurz', 'lang', 'lockig', 'glatt', 'wellig', 'Glatze', 'Pferdeschwanz', 'Bob'], allowCustom: false },
  augenfarbe:      { options: ['blau', 'braun', 'grün', 'grau', 'haselnuss'], allowCustom: false },
  bart:            { options: ['keiner', 'Stoppelbart', 'Vollbart', 'Schnurrbart', 'Ziegenbart'], allowCustom: false },
  hauttyp:         { options: ['hell', 'mittel', 'dunkel', 'oliv', 'gebräunt'], allowCustom: false },
  nationalitaet:   { options: ['deutsch', 'österreichisch', 'schweizerisch', 'US-amerikanisch', 'britisch', 'französisch', 'italienisch', 'spanisch', 'türkisch', 'asiatisch', 'afrikanisch', 'lateinamerikanisch'], allowCustom: true },
  beruf:           { options: ['Sängerin/Sänger', 'Schauspielerin/Schauspieler', 'Polizistin/Polizist', 'Ärztin/Arzt', 'Anwältin/Anwalt', 'Lehrerin/Lehrer', 'Model', 'Influencer', 'Musiker', 'Sportlerin/Sportler'], allowCustom: true },
  persoenlichkeit: { options: ['selbstbewusst', 'schüchtern', 'extrovertiert', 'introvertiert', 'freundlich', 'ernst', 'humorvoll', 'dominant', 'sanft', 'rebellisch'], allowCustom: true },
  ausstrahlung:    { options: ['charismatisch', 'geheimnisvoll', 'warmherzig', 'kühl', 'autoritär', 'verspielt', 'elegant', 'bodenständig', 'exzentrisch'], allowCustom: true },
  stimmung:        { options: ['fröhlich', 'ernst', 'nachdenklich', 'energisch', 'entspannt', 'melancholisch', 'leidenschaftlich'], allowCustom: true },
  besonderheiten:  { options: ['Tattoos', 'Narbe', 'Brille', 'Sommersprossen', 'Piercing', 'Muttermal'], allowCustom: true },
}

export const OUTFIT_ATTRIBUTE_OPTIONS: Record<string, AttributeOptionConfig> = {
  kategorie:    { options: ['Bühnenoutfit', 'Business', 'Freizeit', 'Abendkleidung', 'Sportbekleidung', 'Tracht', 'Uniform', 'Festival'], allowCustom: false },
  farben:       { options: ['Rot', 'Blau', 'Grün', 'Gelb', 'Schwarz', 'Weiß', 'Grau', 'Braun', 'Beige', 'Gold', 'Silber', 'Pink', 'Lila', 'Orange'], allowCustom: true, multi: true },
  material:     { options: ['Baumwolle', 'Leder', 'Seide', 'Denim', 'Wolle', 'Samt', 'Pailletten', 'Leinen', 'Synthetik'], allowCustom: false },
  muster:       { options: ['einfarbig', 'gestreift', 'geblümt', 'kariert', 'gepunktet', 'Camouflage', 'Animal Print'], allowCustom: false },
  accessoires:  { options: ['Gürtel', 'Schmuck', 'Hut', 'Sonnenbrille', 'Schal', 'Handtasche', 'Krawatte', 'Handschuhe'], allowCustom: true, multi: true },
  schuhe:       { options: ['Stiefel', 'High Heels', 'Sneaker', 'Sandalen', 'Lederschuhe', 'Turnschuhe', 'Barfuß'], allowCustom: true },
  saison:       { options: ['Frühling', 'Sommer', 'Herbst', 'Winter', 'Ganzjährig'], allowCustom: false },
  formalitaet:  { options: ['leger', 'business', 'festlich', 'elegant', 'sportlich'], allowCustom: false },
  land:         { options: ['Deutschland', 'Österreich', 'Schweiz', 'USA', 'Frankreich', 'Italien', 'Spanien', 'Großbritannien'], allowCustom: true },
  region:       { options: ['Bayern', 'Norddeutschland', 'Süddeutschland', 'Alpenregion', 'Mittelmeerraum'], allowCustom: true },
  epoche:       { options: ['heutig', '1980er', '1990er', '2000er', 'mittelalterlich', 'viktorianisch', 'futuristisch', 'retro'], allowCustom: false },
}
