// Section help, written per language (same structure enforced by a test).
import type { Lang } from "./i18n";

export type HelpTopic = "overview" | "library" | "editor" | "roles" | "contrast" | "vision" | "previews" | "export";
export interface HelpText { title: string; intro: string; points: string[]; tip?: string }
export const HELP_ORDER: HelpTopic[] = ["overview", "library", "editor", "roles", "contrast", "vision", "previews", "export"];

const EN: Record<HelpTopic, HelpText> = {
  overview: {
    title: "Getting started",
    intro: "Color Lab helps you choose colours, check that text stays readable, see how a palette may look to people with colour vision deficiencies and try it in real designs. Everything runs in this browser. Nothing is uploaded.",
    points: [
      "Pick a palette in the library on the left, or keep the one that is open.",
      "Look at it in the website, editorial and interface previews in the middle.",
      "Edit colours and choose which colour does which job under Colour and Roles on the right.",
      "Check readability under Contrast, then switch the colour vision simulation above the preview.",
      "Save the palette in this browser or export it as CSS, JSON, tokens, swatch sheets or a report.",
    ],
    tip: "Hover over (or long-press) any control to see what it does. Every section has its own ? button.",
  },
  library: {
    title: "Palette library",
    intro: "The library holds about 500 palettes from open sources, grouped so that historical, editorial, interface and data colours are never mixed up.",
    points: [
      "Historical combinations are plates from Sanzo Wada's 1933 A Dictionary of Color Combinations.",
      "Editorial combinations are modern selections by the editors of colorcombinations.org. They are not from the 1933 book.",
      "Interface scales (Radix Colors, Open Color) are step scales for user interfaces. Data visualization schemes come from ColorBrewer and d3.",
      "Search by palette name, colour name or hex value. Filters narrow by hue, number of colours, source, mood or thematic collection.",
      "Star a palette to keep it under Favourites. Palettes you save appear under My palettes.",
    ],
  },
  editor: {
    title: "Editing colours",
    intro: "Select a colour in the strip above the preview to edit it. Changes update every preview immediately and can be undone.",
    points: [
      "Type a hex value, use the system colour picker or adjust lightness, chroma and hue in OKLCH, a space where equal steps look roughly equal.",
      "Some OKLCH colours cannot be shown on an sRGB screen. They are mapped into range by reducing chroma at the same lightness and hue, and the editor says so.",
      "Lock colours you want to keep, then use Variation to move the others a little. Each variation number always gives the same result.",
      "Relationships (complementary, analogous, triadic and others) rotate the hue of the selected colour. They are starting points, not rules.",
      "Drag colours in the strip, or use Alt and the arrow keys, to reorder. Restore original returns to the palette as it was opened.",
    ],
  },
  roles: {
    title: "Semantic roles",
    intro: "Roles decide which colour each part of a design uses: background, text, surfaces, accents, button text and borders.",
    points: [
      "Automatic picks the lightest colour as background, the colour with the best contrast as text and the most colourful ones as accents.",
      "The dark arrangement makes the automatic background the darkest colour instead.",
      "Surfaces and borders are mixed from background and text when you do not assign them. Mixed colours are marked as derived.",
      "The quick contrast check shows the most important pairs at a glance.",
    ],
  },
  contrast: {
    title: "Contrast lab",
    intro: "Contrast is measured with the WCAG 2.2 formula: the relative luminance of the lighter colour plus 0.05, divided by that of the darker colour plus 0.05.",
    points: [
      "Normal text needs 4.5:1 for AA and 7:1 for AAA. Large text (24 px, or 18.66 px bold) needs 3:1 and 4.5:1.",
      "Interface components and meaningful graphics need 3:1 against their surroundings (success criterion 1.4.11).",
      "Results use the exact ratio. The display is truncated, so a ratio shown as 4.49 never passes 4.5.",
      "Translucent colours are composited onto the colour behind them before measuring.",
      "Suggest an adjustment finds the closest lighter or darker version of one colour that meets your target, keeping its hue.",
    ],
    tip: "Passing contrast checks is necessary but not sufficient. Review size, weight, focus states and colour-only information too.",
  },
  vision: {
    title: "Colour vision simulation",
    intro: "The simulator shows how colours may appear with protanopia, deuteranopia or tritanopia, with partial forms through the severity slider, and a lightness-only approximation of achromatopsia.",
    points: [
      "It uses the model by Machado, Oliveira and Fernandes (2009). Colours are converted to linear light, transformed with the published matrices and converted back.",
      "Severity 1 means a cone type is missing. Lower values model shifted cone sensitivity (anomalous trichromacy). Between the published steps the matrices are interpolated.",
      "Compare shows the original and the simulation side by side, or with a before and after slider on small screens.",
      "The Vision tab lists colour pairs that become close in the simulation (CIEDE2000 colour difference) and places where meaning depends on colour alone.",
      "The simulation is an approximation of an average observer. It cannot show a particular person's vision, your display or the room's lighting, and it is not a medical test.",
    ],
  },
  previews: {
    title: "Design previews",
    intro: "Three designs show the palette at work: a studio website, an exhibition poster and an application interface. A contrast view and an image tool sit beside them.",
    points: [
      "The website and interface use the semantic roles. The poster uses every palette colour, from darkest to lightest.",
      "The selected colour vision simulation applies to the whole preview: text, buttons, illustrations, icons and charts.",
      "The interface preview never relies on colour alone: statuses have icons and labels, and the chart can add patterns.",
      "The image tool simulates a PNG or JPEG of your own. The image stays in this browser.",
    ],
  },
  export: {
    title: "Export and saving",
    intro: "Export your colours for code, design tools and reports, or save them in this browser.",
    points: [
      "HEX, CSS custom properties, JSON, design tokens and swatch sheets (SVG and PNG) contain the original colours only.",
      "The comparison sheet shows the palette beside chosen simulations, with simulated rows clearly labelled.",
      "A project file keeps the palette, its roles and the original palette, so you can continue later or on another computer.",
      "Saved palettes and favourites live in this browser's storage. Clearing site data removes them, so keep a backup file.",
    ],
  },
};

const SV: Record<HelpTopic, HelpText> = {
  overview: {
    title: "Kom igång",
    intro: "Color Lab hjälper dig att välja färger, kontrollera att text går att läsa, se hur en palett kan uppfattas av personer med nedsatt färgseende och prova den i riktiga layouter. Allt körs i webbläsaren. Inget laddas upp.",
    points: [
      "Välj en palett i biblioteket till vänster, eller behåll den som är öppen.",
      "Titta på den i förhandsvisningarna av webbplats, affisch och gränssnitt i mitten.",
      "Redigera färger och välj vilken färg som gör vad under Färg och Roller till höger.",
      "Kontrollera läsbarheten under Kontrast och växla sedan färgseendesimuleringen ovanför förhandsvisningen.",
      "Spara paletten i webbläsaren eller exportera den som CSS, JSON, tokens, färgkartor eller en rapport.",
    ],
    tip: "Håll muspekaren över (eller tryck länge på) en kontroll för att se vad den gör. Varje avsnitt har en egen ?-knapp.",
  },
  library: {
    title: "Palettbibliotek",
    intro: "Biblioteket innehåller omkring 500 paletter från öppna källor, grupperade så att historiska, redaktionella, gränssnitts- och diagramfärger aldrig blandas ihop.",
    points: [
      "Historiska kombinationer är plåtar ur Sanzo Wadas A Dictionary of Color Combinations från 1933.",
      "Redaktionella kombinationer är moderna urval av redaktionen på colorcombinations.org. De kommer inte från boken från 1933.",
      "Gränssnittsskalor (Radix Colors, Open Color) är stegskalor för användargränssnitt. Scheman för datavisualisering kommer från ColorBrewer och d3.",
      "Sök på palettnamn, färgnamn eller hexvärde. Filter begränsar efter nyans, antal färger, källa, stämning eller tematisk samling.",
      "Stjärnmärk en palett för att spara den under Favoriter. Paletter du sparar visas under Mina paletter.",
    ],
  },
  editor: {
    title: "Redigera färger",
    intro: "Välj en färg i remsan ovanför förhandsvisningen för att redigera den. Ändringar syns direkt i alla förhandsvisningar och kan ångras.",
    points: [
      "Skriv ett hexvärde, använd systemets färgväljare eller justera ljushet, kroma och nyans i OKLCH, en färgrymd där lika steg ser ungefär lika stora ut.",
      "Vissa OKLCH-färger kan inte visas på en sRGB-skärm. De förs in i omfånget genom att kroman minskas med samma ljushet och nyans, och redigeraren talar om det.",
      "Lås färger du vill behålla och använd sedan Variation för att flytta de andra lite. Varje variationsnummer ger alltid samma resultat.",
      "Relationer (komplementär, analog, triadisk med flera) roterar den valda färgens nyans. De är utgångspunkter, inte regler.",
      "Dra färger i remsan, eller använd Alt och piltangenterna, för att ändra ordning. Återställ original går tillbaka till paletten som den öppnades.",
    ],
  },
  roles: {
    title: "Semantiska roller",
    intro: "Roller bestämmer vilken färg varje del av en layout använder: bakgrund, text, ytor, accenter, knapptext och linjer.",
    points: [
      "Automatiskt väljer den ljusaste färgen som bakgrund, färgen med bäst kontrast som text och de mest färgstarka som accenter.",
      "Mörk uppställning gör i stället den mörkaste färgen till automatisk bakgrund.",
      "Ytor och linjer blandas av bakgrund och text när du inte tilldelar dem. Blandade färger markeras som härledda.",
      "Snabbkontrollen av kontrast visar de viktigaste paren direkt.",
    ],
  },
  contrast: {
    title: "Kontrastlabb",
    intro: "Kontrast mäts med formeln i WCAG 2.2: den ljusare färgens relativa luminans plus 0,05 delat med den mörkare färgens plus 0,05.",
    points: [
      "Normal text behöver 4,5:1 för AA och 7:1 för AAA. Stor text (24 px, eller 18,66 px fet) behöver 3:1 och 4,5:1.",
      "Gränssnittskomponenter och grafik som bär information behöver 3:1 mot omgivningen (framgångskriterium 1.4.11).",
      "Resultaten använder det exakta förhållandet. Visningen trunkeras, så ett förhållande som visas som 4,49 klarar aldrig 4,5.",
      "Genomskinliga färger läggs ihop med färgen bakom innan de mäts.",
      "Föreslå en justering hittar den närmaste ljusare eller mörkare versionen av en färg som når ditt mål, med samma nyans.",
    ],
    tip: "Att klara kontrastkraven är nödvändigt men inte tillräckligt. Granska även storlek, vikt, fokusmarkeringar och information som bara visas med färg.",
  },
  vision: {
    title: "Simulering av färgseende",
    intro: "Simulatorn visar hur färger kan uppfattas vid protanopi, deuteranopi eller tritanopi, med lindrigare former via reglaget för svårighetsgrad, och en ungefärlig bild av akromatopsi där bara ljushet syns.",
    points: [
      "Den använder modellen av Machado, Oliveira och Fernandes (2009). Färgerna omvandlas till linjärt ljus, transformeras med de publicerade matriserna och omvandlas tillbaka.",
      "Svårighetsgrad 1 betyder att en tapptyp saknas. Lägre värden motsvarar förskjuten tappkänslighet (anomal trikromasi). Mellan de publicerade stegen interpoleras matriserna.",
      "Jämför visar originalet och simuleringen sida vid sida, eller med ett före och efter-reglage på små skärmar.",
      "Fliken Seende listar färgpar som kommer nära varandra i simuleringen (färgskillnad enligt CIEDE2000) och ställen där betydelsen bara bärs av färg.",
      "Simuleringen är en uppskattning för en genomsnittlig betraktare. Den kan inte visa en viss persons seende, din skärm eller rummets ljus, och den är inget medicinskt test.",
    ],
  },
  previews: {
    title: "Förhandsvisningar",
    intro: "Tre layouter visar paletten i arbete: en webbplats för en ateljé, en utställningsaffisch och ett programgränssnitt. Bredvid finns en kontrastvy och ett bildverktyg.",
    points: [
      "Webbplatsen och gränssnittet använder de semantiska rollerna. Affischen använder alla palettens färger, från mörkast till ljusast.",
      "Den valda simuleringen av färgseende gäller hela förhandsvisningen: text, knappar, illustrationer, ikoner och diagram.",
      "Gränssnittet förlitar sig aldrig enbart på färg: statusar har ikoner och etiketter, och diagrammet kan få mönster.",
      "Bildverktyget simulerar en egen PNG- eller JPEG-bild. Bilden stannar i webbläsaren.",
    ],
  },
  export: {
    title: "Export och sparande",
    intro: "Exportera färgerna för kod, designverktyg och rapporter, eller spara dem i webbläsaren.",
    points: [
      "HEX, CSS-variabler, JSON, designtokens och färgkartor (SVG och PNG) innehåller bara originalfärgerna.",
      "Jämförelsebladet visar paletten bredvid valda simuleringar, med simulerade rader tydligt märkta.",
      "En projektfil behåller paletten, dess roller och originalpaletten, så att du kan fortsätta senare eller på en annan dator.",
      "Sparade paletter och favoriter ligger i webbläsarens lagring. Rensad webbplatsdata tar bort dem, så spara en säkerhetskopia.",
    ],
  },
};

export const HELP: Record<Lang, Record<HelpTopic, HelpText>> = { en: EN, sv: SV };
