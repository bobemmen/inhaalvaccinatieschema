# Inhaalvaccinatie Adviseur

Klinisch beslissingsondersteunende webapp die werkt als een **Jeugdarts KNMG**
en op basis van patiëntgegevens een inhaalvaccinatieschema genereert volgens de
**RIVM-leidraad inhaalvaccinaties 2024**.

## Functionaliteit

- **Invullen** van patiëntgegevens: naam, geboortedatum, herkomstland en aankomstdatum.
- Aanvinken welke vaccinaties al **gedocumenteerd** zijn, of "documenten ontbreken".
- **Medische bijzonderheden**: prematuriteit, immuundeficiëntie, zwangerschap, HIV-contact, asplenie, HepB+ moeder.
- **Output**: schema per vaccin met dosis, timing en prioriteit
  (Direct / +1 maand / +3 maanden / +6 maanden), gegroepeerd in bezoeken
  (max 2-3 vaccins per visite).
- **Uitleg & advies**-knop per vaccin: deterministische klinische toelichting,
  optioneel uitgebreid met AI-toelichting via een eigen Anthropic API-sleutel.

## Klinische grondslagen

- Ontbrekende documenten → behandeld als volledig niet-gevaccineerd.
- Minimuminterval tussen primaire doses: 4 weken (RVP).
- Leeftijds-/geslachtsspecifieke overwegingen (HPV, BCG bij TBC-risicolanden).
- Levende vaccins (BMR, BCG, Varicella, Rotavirus): contra-indicatie of voorzichtigheid bij immuundeficiëntie/zwangerschap.
- Strikte leeftijdsgrenzen voor Rotavirus (< 15 wkn / < 24 wkn).
- HPV: 2 doses < 15 jaar, 3 doses ≥ 15 jaar.
- BCG: bij kinderen uit WHO/RIVM TBC-incidentielanden (≥ 50/100.000), na uitsluiting actieve/latente TBC.

## Gebruik

Open `index.html` in de browser. Geen build-stap nodig (vanille HTML/CSS/JS).
Voor lokale ontwikkeling:

```sh
python3 -m http.server 8080
```

en navigeer naar `http://localhost:8080`.

## Disclaimer

Dit hulpmiddel is **beslissingsondersteunend** en vervangt geen klinisch oordeel.
Eindverantwoordelijkheid berust bij de behandelend arts.
Raadpleeg altijd de actuele RIVM-leidraad voor definitief beleid.
