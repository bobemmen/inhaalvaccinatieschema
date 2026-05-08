// Inhaalschema-generator op basis van RIVM-leidraad inhaalvaccinaties 2024
// en RVP uitvoeringsrichtlijnen (rijksvaccinatieprogramma.nl/professionals/richtlijnen/uitvoering).
// Output: lijst van bezoeken met vaccins, prioriteit en klinische rationale.

window.Scheduler = (function () {
  const PRIORITY = {
    DIRECT: { key: 'direct', label: 'Direct', cssClass: 'pri-direct', offsetMonths: 0 },
    M1: { key: '1m', label: '+ 1 maand', cssClass: 'pri-1m', offsetMonths: 1 },
    M2: { key: '2m', label: '+ 2 maanden', cssClass: 'pri-3m', offsetMonths: 2 },
    M3: { key: '3m', label: '+ 3 maanden', cssClass: 'pri-3m', offsetMonths: 3 },
    M6: { key: '6m', label: '+ 6 maanden', cssClass: 'pri-6m', offsetMonths: 6 },
  };

  // RIVM-leidraad: praktische bovengrens 3 prikken per consult.
  // Standaardadvies: 2 prikken per bezoek (verlaagt belasting/pijn).
  // Minimum: 1 (bv. bij angst, eerder vasovagale reactie).
  const DEFAULT_MAX_PER_VISIT = 2;

  function ageInMonths(dob, ref) {
    const a = new Date(dob), b = new Date(ref);
    let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (b.getDate() < a.getDate()) m -= 1;
    return Math.max(0, m);
  }
  function ageInYears(dob, ref) { return Math.floor(ageInMonths(dob, ref) / 12); }
  function ageInWeeks(dob, ref) {
    return Math.floor((new Date(ref) - new Date(dob)) / (7 * 24 * 3600 * 1000));
  }

  function generate(input) {
    const visitDate = input.visitDate || new Date().toISOString().slice(0, 10);
    const ageM = ageInMonths(input.dob, visitDate);
    const ageY = ageInYears(input.dob, visitDate);
    const ageW = ageInWeeks(input.dob, visitDate);

    const docs = input.noDocs
      ? {} // alle reeds-gedocumenteerde aantallen vervallen
      : (input.documented || {});

    const tbcRisk = window.RIVM_DATA.TBC_RISK_COUNTRIES.has(input.country);
    const female = input.sex === 'F';
    const immuno = !!input.immuun || !!input.hivContact;
    const pregnant = !!input.zwanger;
    const prematuur = !!input.prematuur;

    const items = []; // {code, label, doseNum, totalDoses, priority, rationale, contraIndic?}
    const warnings = [];

    if (input.noDocs) {
      warnings.push('Geen vaccinatiedocumenten — patiënt wordt behandeld als volledig niet-gevaccineerd conform RIVM-leidraad inhaalvaccinaties 2024.');
    }
    if (prematuur) {
      warnings.push('Prematuriteit (< 37 weken): vaccineer op kalenderleeftijd (postnatale leeftijd, niet gecorrigeerde leeftijd) conform RVP-richtlijn. Rotavirus-eerste dosis mag niet eerder dan 6 weken kalenderleeftijd.');
    }
    if (immuno) {
      warnings.push('Immuundeficiëntie/HIV: levende vaccins (BMR, BCG, varicella, rotavirus) zijn relatief of absoluut gecontra-indiceerd. Overleg met kinderarts/infectioloog vóór toediening.');
    }
    if (pregnant) {
      warnings.push('Zwangerschap: levende vaccins (BMR, BCG, varicella, rotavirus) gecontra-indiceerd. Geïnactiveerde vaccins (DKTP, HepB, HPV) bij voorkeur uitstellen tot post partum, tenzij klinisch geïndiceerd (bijv. dKT/Boostrix in 3e trimester voor maternale kinkhoestvaccinatie).');
    }
    if (input.hepBmoeder) {
      warnings.push('HepB-positieve moeder: kind moet binnen 24 uur na geboorte HBIg én HepB-vaccin ontvangen hebben (versneld schema 0-1-2-12 mnd). Controleer HBsAg, anti-HBs en HBeAg bij kind op 9-12 maanden. Overleg infectioloog/kinderarts.');
    }

    // ===== DKTP-Hib-HepB (< 4 jr) / DKTP (≥ 4 jr) =====
    // RIVM leidraad 2024: hexavalent t/m leeftijd < 4 jaar (48 mnd).
    // Doeldoses afhankelijk van leeftijd bij start inhaalschema:
    //   < 6 mnd  → 3 primaire doses + 1 booster op ~11 mnd = 4 doses
    //   6-11 mnd → 2 primaire doses + 1 booster = 3 doses
    //  12-23 mnd → 2 doses (interval ≥ 8 weken)
    //  24-47 mnd → 1 dosis volstaat
    //   ≥ 48 mnd → DKTP (Boostrix-Polio; zie hieronder)
    // Minimuminterval primaire doses: 4 weken. Booster: ≥ 6 mnd na laatste primaire dosis.
    const hexDocs = +(docs['DKTP-Hib-HepB'] || 0);
    if (ageM < 48) {
      let hexTarget;
      if (ageM < 6)        hexTarget = 4; // 3 primair + 1 booster
      else if (ageM < 12)  hexTarget = 3; // 2 primair + 1 booster
      else if (ageM < 24)  hexTarget = 2;
      else                 hexTarget = 1;

      const hexRem = Math.max(0, hexTarget - hexDocs);
      for (let i = 0; i < hexRem; i++) {
        // Prioriteitsreeks: D → M1 → M3 → M6 (booster)
        const pri = i === 0 ? PRIORITY.DIRECT
                  : i === 1 ? PRIORITY.M1
                  : i === 2 ? PRIORITY.M3
                  :           PRIORITY.M6;
        items.push({
          code: 'DKTP-Hib-HepB',
          label: 'DKTP-Hib-HepB',
          doseNum: hexDocs + i + 1,
          totalDoses: hexTarget,
          priority: pri,
          rationale: `Hexavalent vaccin (difterie, kinkhoest, tetanus, polio, Hib, hepatitis B). Inhaalschema voor leeftijd ${ageM} maanden: ${hexTarget} dose(s) nodig.
Doelintervallen (RVP-leidraad 2024):
• < 6 mnd start: 3 primaire doses (0, 1, 3 mnd) + booster ≥ 6 mnd na laatste primaire dosis (streefdatum ca. 11 maanden leeftijd)
• 6-11 mnd start: 2 primaire doses (0, 1 mnd) + booster ≥ 6 mnd later
• 12-23 mnd start: 2 doses (interval ≥ 8 weken)
• 24-47 mnd start: 1 dosis
Minimuminterval primaire doses: 4 weken. Toediening: i.m. anterolateraal bovenbeen (< 12 mnd) of deltoid.`,
        });
      }
    } else {
      // ≥ 4 jaar: DKTP (Boostrix-Polio = dTpa-IPV; tetravalent, zonder Hib/HepB)
      // Tel alle eerder ontvangen DKTP-houdende doses mee (hexavalent + DKTP).
      const dtpTotal = hexDocs + +(docs['DKTP'] || 0);
      const dktpDocs = +(docs['DKTP'] || 0);
      // Inhaal: completeer tot 3 doses als primaire serie niet voltooid.
      // Daarna booster op 10-jarige intervallen (standaard RVP/volwassenen).
      if (dtpTotal < 3) {
        const dtpTarget = 3;
        const dtpRem = Math.max(0, dtpTarget - dtpTotal);
        for (let i = 0; i < dtpRem; i++) {
          items.push({
            code: 'DKTP',
            label: 'DKTP (Boostrix-Polio)',
            doseNum: dktpDocs + i + 1,
            totalDoses: dtpTarget,
            priority: i === 0 ? PRIORITY.DIRECT : (i === 1 ? PRIORITY.M1 : PRIORITY.M6),
            rationale: `Vanaf 4 jaar DKTP (Boostrix-Polio = dTpa-IPV; lager-gedoseerde difterie/tetanus + acellulaire kinkhoest + IPV). Inhaalschema bij < 3 eerdere DKTP-houdende doses: schema 0 – 1 – 6 maanden. Minimuminterval tussen dosis 1 en 2: 4 weken; tussen dosis 2 en 3: 5 maanden.
Na voltooide primaire serie (3 doses): booster aanbevolen na 10 jaar (standaard RVP en KNMG-richtlijn volwassenenvaccinatie). RVP-boostermomenten: 4 jaar en 9 jaar. Hepatitis B en Hib worden zo nodig apart aangeboden (zie hieronder). Toediening: i.m. deltoid.`,
          });
        }
      }

      // HepB monovalent indien niet eerder gedekt door hexavalent
      const hepbTotal = hexDocs + +(docs['HepB-mono'] || 0);
      if (hepbTotal < 3) {
        const hepBTarget = 3;
        const hepBRem = Math.max(0, hepBTarget - hepbTotal);
        const hepBDocs = +(docs['HepB-mono'] || 0);
        for (let i = 0; i < hepBRem; i++) {
          items.push({
            code: 'HepB-mono',
            label: 'Hepatitis B (monovalent)',
            doseNum: hepBDocs + i + 1,
            totalDoses: hepBTarget,
            priority: i === 0 ? PRIORITY.DIRECT : (i === 1 ? PRIORITY.M1 : PRIORITY.M6),
            rationale: `Hepatitis B monovalent voor kinderen ≥ 4 jaar die niet via hexavalent volledig gevaccineerd zijn. Schema: 0 – 1 – 6 maanden (Engerix-B of Fendrix). Versneld schema mogelijk: 0 – 1 – 2 – 12 mnd (bijv. bij HepB-positieve moeder, reiziger). Anti-HBs-titer ≥ 10 IE/l = beschermd. Bij HepB-positieve moeder: bespreek HBIg en versneld schema met infectioloog. Toediening: i.m. deltoid.`,
          });
        }
      }

      // Hib monovalent indien niet gedekt (voor kinderen 4-5 jaar)
      // Hib-indicatie vervalt na de 5e verjaardag.
      if (ageM < 60) {
        const hibDocs = hexDocs + +(docs['Hib-mono'] || 0);
        if (hibDocs < 1) {
          items.push({
            code: 'Hib-mono',
            label: 'Haemophilus influenzae type b (Hib)',
            doseNum: 1,
            totalDoses: 1,
            priority: PRIORITY.M1,
            rationale: `Hib-indicatie geldt t/m de 5e verjaardag. Kinderen van 4-5 jaar die nooit Hib-vaccin ontvingen (niet via hexavalent), krijgen eenmalig monovalent Hib-vaccin. Na de 5e verjaardag is Hib niet meer geïndiceerd vanwege de afnemende incidentie op deze leeftijd. Toediening: i.m. deltoid.`,
          });
        }
      }
    }

    // ===== MenB =====
    // MenB (Bexsero) toegevoegd aan het Nederlandse RVP in 2022 voor kinderen
    // geboren vanaf 1 januari 2021. Inhaalschema conform RVP-richtlijn:
    //   3-5 mnd: 3 doses (0, 2, 4 mnd) + booster bij 12-15 mnd = 4 doses
    //   6-11 mnd: 2 doses (0, 2 mnd) + booster bij 12-15 mnd = 3 doses
    //  12-23 mnd: 2 doses (0, 2 mnd)
    //  ≥ 24 mnd: niet standaard RVP (overweeg bij risicogroepen)
    // Minimuminterval: 4-8 weken tussen doses; booster ≥ 2 mnd na laatste primaire.
    const menBDocs = +(docs['MenB'] || 0);
    const dobYear = new Date(input.dob).getFullYear();
    if (dobYear >= 2021 && ageM >= 3 && ageM < 24 && !immuno) {
      let menBTarget;
      if (ageM < 6)       menBTarget = 4; // 3 primair + 1 booster
      else if (ageM < 12) menBTarget = 3; // 2 primair + 1 booster
      else                menBTarget = 2; // 12-23 mnd: 2 doses

      const menBRem = Math.max(0, menBTarget - menBDocs);
      for (let i = 0; i < menBRem; i++) {
        const pri = i === 0 ? PRIORITY.DIRECT
                  : i === 1 ? PRIORITY.M2
                  : i === 2 ? PRIORITY.M3
                  :           PRIORITY.M6;
        items.push({
          code: 'MenB',
          label: 'Meningokokken B (MenB)',
          doseNum: menBDocs + i + 1,
          totalDoses: menBTarget,
          priority: pri,
          rationale: `MenB (Bexsero) is in 2022 toegevoegd aan het Nederlandse RVP voor kinderen geboren vanaf 1 januari 2021. Inhaalschema leeftijd ${ageM} mnd: ${menBTarget} dose(s).
• 3-5 mnd: 3 primaire doses (0, 2, 4 mnd) + booster op 12-15 mnd
• 6-11 mnd: 2 primaire doses (0, 2 mnd) + booster op 12-15 mnd
• 12-23 mnd: 2 doses (interval ≥ 2 mnd)
Minimuminterval tussen doses: 4 weken. MenB kan gelijktijdig met andere RVP-vaccins worden gegeven, maar paracetamol profylactisch aanbieden (verhoogd koortsrisico). Toediening: i.m. deltoid of anterolateraal bovenbeen.`,
        });
      }
    } else if (dobYear >= 2021 && immuno && ageM >= 3 && ageM < 24) {
      warnings.push('MenB (Bexsero): bij immuundeficiëntie is vaccinatie juist extra geïndiceerd (meningokokken zijn geïnactiveerde vaccins). Overleg kinderarts/infectioloog voor aangepast schema.');
    }

    // ===== BMR =====
    // Doelgroep: alle kinderen ≥ 6 mnd (bij risico/uitbraak) of ≥ 14 mnd (standaard).
    // 2 doses, minimuminterval 4 weken.
    // Eerste dosis vóór 12 mnd is niet geldig voor het RVP-schema; herhaal ≥ 14 mnd.
    const bmrDocs = +(docs['BMR'] || 0);
    if (ageM >= 6 && bmrDocs < 2) {
      if (immuno) {
        warnings.push('BMR is een levend attenuated vaccin: absoluut gecontra-indiceerd bij ernstige immuundeficiëntie (SCID, CD4 < 200/μl). Bij milde immunosuppressie (bijv. lage-dosis prednison): individueel afwegen met kinderarts/infectioloog.');
      } else if (pregnant) {
        warnings.push('BMR is gecontra-indiceerd tijdens zwangerschap. Plan na bevalling; vrouwen mogen 4 weken na BMR niet zwanger worden.');
      } else {
        const bmrRem = 2 - bmrDocs;
        for (let i = 0; i < bmrRem; i++) {
          items.push({
            code: 'BMR',
            label: 'BMR (mazelen-bof-rodehond)',
            doseNum: bmrDocs + i + 1,
            totalDoses: 2,
            priority: i === 0 ? PRIORITY.DIRECT : PRIORITY.M1,
            rationale: `Levend attenuated vaccin (mazelen, bof, rodehond). Twee doses noodzakelijk voor >97% seroconversie.
Leeftijdsregels (RIVM):
• Eerste dosis ≥ 14 maanden (standaard RVP). Bij uitbraak of risico: eerste dosis ≥ 6 maanden — dosis vóór 12 mnd telt NIET voor RVP-schema (herhaal ≥ 14 mnd).
• Minimuminterval tussen 2 doses: 4 weken.
Mazelen: hoge transmissibiliteit (R₀ 12-18), regelmatig importgevallen — directe vaccinatie prioriteit. Rodehond: teratogeen effect — belangrijk bij fertiliteitsleeftijd. Levend vaccin: 4 weken karenstijd voor zwangerschap; niet bij ernstige immuundeficiëntie. Toediening: s.c. bovenarm.`,
          });
        }
      }
    }

    // ===== MenACWY =====
    // RVP: 14 maanden + 14 jaar (2 doses life-time voor meeste kinderen).
    // Inhaalschema voor niet-gevaccineerden:
    //  14-23 mnd: 1 dosis nu; 14 jaar via regulier RVP (total = 2 life-time)
    //  2-13 jr  : 1 dosis nu; 14 jaar via regulier RVP
    //  ≥ 14 jr  : 1 dosis (de adolescenten-RVP dosis)
    // Bij risicogroepen (asplenie, complement-deficiëntie, HIV): afwijkend schema.
    const menDocs = +(docs['MenACWY'] || 0);
    if (ageM >= 14 && menDocs < 1) {
      const lifeTimeDoses = ageY >= 14 ? 1 : 2; // 2 life-time doses (14mnd + 14jr)
      items.push({
        code: 'MenACWY',
        label: 'Meningokokken ACWY',
        doseNum: 1,
        totalDoses: lifeTimeDoses,
        priority: PRIORITY.M1,
        rationale: `Geconjugeerd vaccin tegen meningokokken serogroep A, C, W, Y (Nimenrix of Menveo). RVP-momenten: 14 maanden + 14 jaar.
Inhaalschema (RIVM 2024):
• 14 mnd – 14 jr: geef 1 dosis nu; de 14-jaarsdosis loopt via het reguliere RVP
• ≥ 14 jaar: 1 dosis volstaat (adolescenten-RVP)
• Risicogroepen (asplenie, complement-deficiëntie, HIV, thalassemie): overleg voor extra doses / aangepast schema
MenACWY beschermt NIET tegen serogroep B → zie MenB hierboven. Toediening: i.m. deltoid.`,
      });
    }

    // ===== Pneumokokken (PCV15 / PCV20) =====
    // RIVM leidraad 2024 inhaalschema (PCV15 = Vaxneuvance, PCV20 = Apexxnar):
    //   Start < 7 mnd  (0 doses): 3 primair + 1 booster = 4 doses
    //                             primaire interval: ≥ 4 weken; booster ≥ 8 weken na serie
    //   Start 7-11 mnd (0 doses): 2 primair + 1 booster = 3 doses
    //  Start 12-23 mnd (0 doses): 2 doses (interval ≥ 8 weken)
    //  Start 24-59 mnd (0 doses): 1 dosis
    //  ≥ 5 jaar: niet meer standaard (tenzij risicogroep: asplenie, HIV, nefrotisch syndroom)
    const pcvDocs = +(docs['Pneumokokken'] || 0);
    if (ageM < 60 && pcvDocs < (ageM < 7 ? 4 : ageM < 12 ? 3 : ageM < 24 ? 2 : 1)) {
      let pcvTarget;
      if (ageM < 7)        pcvTarget = 4;
      else if (ageM < 12)  pcvTarget = 3;
      else if (ageM < 24)  pcvTarget = 2;
      else                 pcvTarget = 1;

      const pcvRem = Math.max(0, pcvTarget - pcvDocs);
      for (let i = 0; i < pcvRem; i++) {
        let pri;
        if (pcvTarget === 4) {
          pri = i === 0 ? PRIORITY.DIRECT : i === 1 ? PRIORITY.M1 : i === 2 ? PRIORITY.M3 : PRIORITY.M6;
        } else if (pcvTarget === 3) {
          pri = i === 0 ? PRIORITY.DIRECT : i === 1 ? PRIORITY.M1 : PRIORITY.M6;
        } else if (pcvTarget === 2) {
          pri = i === 0 ? PRIORITY.DIRECT : PRIORITY.M3;
        } else {
          pri = PRIORITY.DIRECT;
        }
        items.push({
          code: 'Pneumokokken',
          label: 'Pneumokokken (PCV)',
          doseNum: pcvDocs + i + 1,
          totalDoses: pcvTarget,
          priority: pri,
          rationale: `Geconjugeerd pneumokokkenvaccin (PCV15 = Vaxneuvance of PCV20 = Apexxnar). Inhaalschema leeftijd ${ageM} mnd: ${pcvTarget} dose(s).
• Start < 7 mnd: 3 primaire doses + 1 booster (0, 1, 3, 6 mnd)
• Start 7-11 mnd: 2 primaire doses + 1 booster (0, 1, 6 mnd)
• Start 12-23 mnd: 2 doses (interval ≥ 8 weken)
• Start 24-59 mnd: 1 dosis
• ≥ 5 jaar: niet standaard; overweeg bij asplenie, HIV, nefrotisch syndroom, cochleair implantaat
Minimuminterval primaire doses: 4 weken; booster ≥ 8 weken na laatste primaire dosis. Toediening: i.m. anterolateraal bovenbeen (< 12 mnd) of deltoid.`,
        });
      }
    }

    // ===== Rotavirus =====
    // RIVM: strikte leeftijdsgrenzen! Eerste dosis: 6-15 weken (max 14w+6d).
    // Alle doses vóór 24 weken (max 23w+6d). 2-dosisschema (Rotarix).
    // Minimuminterval tussen doses: 4 weken.
    // Let op: beide doses worden hier gepland indien nog niet gegeven.
    const rotaDocs = +(docs['Rotavirus'] || 0);
    if (ageW >= 6 && ageW < 24 && rotaDocs < 2) {
      if (immuno) {
        warnings.push('Rotavirus is een levend vaccin: absoluut gecontra-indiceerd bij ernstige immuundeficiëntie (SCID). Niet geven bij kinderen met immuundeficiëntie of die mogelijk SCID hebben. Eerst immuunstatus bepalen.');
      } else {
        // Bepaal of beide doses nog passen in het tijdvenster.
        // Eerste dosis mag alleen vóór 15 weken (leeftijdsgrens eerste dosis = < 15 wkn).
        const firstDoseOk = ageW < 15; // dosis 1 kan nog
        const secondDoseOk = ageW < 20; // dosis 2 kan ≥ 4wkn later nog voor 24wkn voltooid zijn

        if (rotaDocs === 0 && firstDoseOk) {
          items.push({
            code: 'Rotavirus',
            label: 'Rotavirus (dosis 1)',
            doseNum: 1, totalDoses: 2,
            priority: PRIORITY.DIRECT,
            rationale: `Oraal levend vaccin (Rotarix). STRIKTE LEEFTIJDSGRENZEN (RIVM): eerste dosis UITSLUITEND tussen 6 en 15 weken (14w+6d). Patiënt is ${ageW} weken — venster ${ageW < 15 ? 'nog open' : 'GESLOTEN'}.
Schema: dosis 1 zo snel mogelijk; dosis 2 minimaal 4 weken later, uiterlijk vóór 24 weken leeftijd.
Geef NIET als kind al 15 weken of ouder is (invaginatierisico). Tijdige planning is essentieel. Toediening: oraal (niet injectie).`,
          });
        }
        if (rotaDocs <= 1 && secondDoseOk) {
          items.push({
            code: 'Rotavirus',
            label: 'Rotavirus (dosis 2)',
            doseNum: Math.max(rotaDocs + 1, 2), totalDoses: 2,
            priority: rotaDocs === 0 ? PRIORITY.M1 : PRIORITY.DIRECT,
            rationale: `Rotavirus dosis 2 (Rotarix). Toedienen minimaal 4 weken na dosis 1, uiterlijk vóór de 24e levensweek. Patiënt is ${ageW} weken — tijdvenster voor afronden: ${23 - ageW} week(nen). Na het 2-dosisschema is geen aanvullende dosis nodig. Toediening: oraal.`,
          });
        }
        if (rotaDocs === 0 && !firstDoseOk) {
          warnings.push(`Rotavirus: eerste dosis kan niet meer worden gegeven (kind is ${ageW} weken; grens is < 15 weken). Vaccinatie niet meer geïndiceerd.`);
        }
      }
    }

    // ===== HPV =====
    // RVP: alle kinderen vanaf 9 jaar (sekseneutraal sinds 2022; Gardasil 9).
    // < 15 jaar bij eerste dosis: 2 doses (0, 6 mnd).
    // ≥ 15 jaar bij eerste dosis: 3 doses (0, 1-2, 6 mnd).
    // Bij immuundeficiëntie: altijd 3 doses.
    const hpvDocs = +(docs['HPV'] || 0);
    if (ageY >= 9) {
      const hpvTarget = (ageY < 15 && !immuno) ? 2 : 3;
      if (hpvDocs < hpvTarget) {
        const hpvRem = hpvTarget - hpvDocs;
        for (let i = 0; i < hpvRem; i++) {
          let pri;
          if (hpvTarget === 2) {
            pri = i === 0 ? PRIORITY.M1 : PRIORITY.M6;
          } else {
            pri = i === 0 ? PRIORITY.M1 : i === 1 ? PRIORITY.M3 : PRIORITY.M6;
          }
          items.push({
            code: 'HPV',
            label: 'HPV (humaan papillomavirus)',
            doseNum: hpvDocs + i + 1, totalDoses: hpvTarget,
            priority: pri,
            rationale: `HPV-vaccin (Gardasil 9, 9-valent). RVP-doelgroep: alle kinderen vanaf 9 jaar (sekseneutraal sinds 2022).
Schema (RVP-richtlijn):
• Start < 15 jaar + geen immuundeficiëntie: 2 doses (0, 6 mnd) — minimuminterval 5 mnd
• Start ≥ 15 jaar of immuundeficiëntie: 3 doses (0, 1-2, 6 mnd) — minimuminterval dose 1-2: 4 wkn; dose 2-3: 12 wkn; dose 1-3: 24 wkn
${female ? 'Vrouwen: bescherming tegen baarmoederhalscarcinoom (HPV 16/18), vulva- en vaginacarcinoom. Bevolkingsonderzoek baarmoederhalskanker blijft van belang.' : 'Jongens: bescherming tegen orofarynx-, anus- en peniscarcinoom; vermindert transmissie naar partners.'}
${immuno ? '⚠ Immuundeficiëntie: altijd 3-dosisschema, ongeacht leeftijd.' : ''}
Toediening: i.m. deltoid.`,
          });
        }
      }
    }

    // ===== BCG =====
    // Indicatie: kinderen < 12 jaar uit TBC-hoog-incidentielanden (≥ 50/100.000, WHO-lijst).
    // Eenmalig. Vóór toediening: Mantoux (≥ 6 mnd) of IGRA (≥ 2 jr) om actieve/latente TBC
    // uit te sluiten (positief = geen BCG meer geven, verwijzen voor latente TBC-behandeling).
    // BCG is een levend vaccin — absoluut CI bij immuundeficiëntie.
    if (tbcRisk && ageY < 12 && !(docs['BCG'] >= 1)) {
      if (immuno) {
        warnings.push('BCG is absoluut gecontra-indiceerd bij immuundeficiëntie (HIV met lage CD4, SCID, primaire immuundeficiënties). BCG NIET toedienen — overleg infectioloog voor alternatieven (profylaxe, monitoring).');
      } else {
        items.push({
          code: 'BCG',
          label: 'BCG (tuberculose)',
          doseNum: 1, totalDoses: 1,
          priority: PRIORITY.M3,
          rationale: `BCG (Bacille Calmette-Guérin) — levend vaccin. Herkomstland (${input.country}) staat op de WHO/RIVM TBC-incidentielijst (≥ 50/100.000/jr).
Indicatie (RIVM): kinderen < 12 jaar die niet eerder gevaccineerd zijn met BCG.
Verplichte screening vóór BCG:
• ≥ 6 mnd: Mantoux-test (tuberculine huidtest); positief → BCG NIET geven, verwijzen naar longarts/infectioloog
• ≥ 2 jr: IGRA (QuantiFERON of T-SPOT.TB) als alternatief
BCG-vaccinatie beschermt voor 80% tegen ernstige kindertuberculose (meningitis, miliaire TBC).
Na BCG: verwacht lokale reactie (pustule, wondgenezing 2-4 mnd). Toediening: intradermaal (i.d.) in linker bovenarm.`,
        });
      }
    } else if (tbcRisk && ageY >= 12 && !(docs['BCG'] >= 1)) {
      warnings.push(`BCG: kind is ${ageY} jaar. BCG-vaccinatie is niet meer geïndiceerd boven de 12 jaar. Overweeg IGRA/Mantoux om latente TBC uit te sluiten; bij positieve test: verwijzing longarts voor latente TBC-behandeling (isoniazide profylaxe).`);
    }

    // ===== Varicella (op indicatie) =====
    // Indicaties in RVP-kader: asplenie, HIV (stabiel), ernstige huidaandoening, etc.
    // 2 doses, minimuminterval 4-12 weken (afhankelijk van preparaat: Varilrix ≥ 4 wkn).
    // Levend vaccin — niet bij ernstige immuundeficiëntie.
    if (input.aspleen && ageM >= 12 && !immuno) {
      const varicDocs = +(docs['Varicella'] || 0);
      if (varicDocs < 2) {
        if (pregnant) {
          warnings.push('Varicella (Varilrix) is gecontra-indiceerd tijdens zwangerschap. Plan na bevalling; vrouwen mogen 4 weken na vaccinatie niet zwanger worden.');
        } else {
          const varicRem = 2 - varicDocs;
          for (let i = 0; i < varicRem; i++) {
            items.push({
              code: 'Varicella',
              label: 'Varicella (waterpokken)',
              doseNum: varicDocs + i + 1, totalDoses: 2,
              priority: i === 0 ? PRIORITY.M3 : PRIORITY.M6,
              rationale: `Levend attenuated vaccin (Varilrix). Indicatie: functionele of anatomische asplenie (verhoogd risico op ernstige infecties inclusief varicella-pneumonitis en bacteriëmie).
Schema: 2 doses, minimuminterval 4 weken (Varilrix). Bij volwassenen: zelfde 2-dosisschema.
Serologie vóór vaccinatie: overweeg VZV-IgG bepaling — bij aantoonbare immuniteit is vaccinatie niet noodzakelijk.
Levend vaccin: absoluut gecontra-indiceerd bij ernstige immuundeficiëntie, zwangerschap. Na vaccinatie: 4 weken karenstijd voor zwangerschap. Indien seropositieve huisgenoten: melding niet vereist. Toediening: s.c. bovenarm.`,
            });
          }
        }
      }
    }

    // ===== Inplannen in bezoeken =====
    const maxPerVisit = Math.max(1, Math.min(3, parseInt(input.maxPerVisit, 10) || DEFAULT_MAX_PER_VISIT));
    const visits = scheduleVisits(items, maxPerVisit);

    return {
      patient: {
        ageMonths: ageM, ageYears: ageY, ageWeeks: ageW,
        tbcRisk, country: input.country, visitDate,
      },
      visits, warnings, items,
    };
  }

  // Verdeel items per prioriteits-bucket over bezoeken.
  // Overflow boven `maxPerVisit` schuift door naar de volgende bucket
  // (klinisch veiliger dan twee bezoeken op dezelfde datum).
  // De laatste bucket (+6m) wordt zo nodig opgesplitst in extra maanden.
  function scheduleVisits(items, maxPerVisit) {
    const order = ['direct', '1m', '2m', '3m', '6m'];
    const PRI_BY_KEY = {
      direct: PRIORITY.DIRECT,
      '1m': PRIORITY.M1,
      '2m': PRIORITY.M2,
      '3m': PRIORITY.M3,
      '6m': PRIORITY.M6,
    };
    const buckets = { direct: [], '1m': [], '2m': [], '3m': [], '6m': [] };
    for (const it of items) {
      const k = it.priority.key;
      if (buckets[k]) buckets[k].push(it);
      else buckets['6m'].push(it); // fallback voor custom keys
    }

    // Cascade overflow van lagere offset → hogere offset
    for (let i = 0; i < order.length - 1; i++) {
      const k = order[i], next = order[i + 1];
      while (buckets[k].length > maxPerVisit) {
        const moved = buckets[k].pop();
        moved.priority = PRI_BY_KEY[next];
        buckets[next].unshift(moved);
      }
    }

    const visits = [];
    for (const k of order) {
      const arr = buckets[k];
      if (!arr.length) continue;
      // 6m: bij overflow extra maanden toevoegen (+6, +7, +8 …)
      if (k === '6m' && arr.length > maxPerVisit) {
        for (let i = 0; i < arr.length; i += maxPerVisit) {
          const extra = Math.floor(i / maxPerVisit);
          const pri = extra === 0 ? PRIORITY.M6 : {
            key: `${6 + extra}m`,
            label: `+ ${6 + extra} maanden`,
            cssClass: 'pri-6m',
            offsetMonths: 6 + extra,
          };
          const slice = arr.slice(i, i + maxPerVisit);
          slice.forEach((s) => (s.priority = pri));
          visits.push({ priority: pri, items: slice });
        }
      } else {
        visits.push({ priority: PRI_BY_KEY[k], items: arr });
      }
    }
    return visits;
  }

  return { generate, PRIORITY };
})();
