// Inhaalschema-generator op basis van RIVM-leidraad inhaalvaccinaties 2024.
// Output: lijst van bezoeken met vaccins, prioriteit en klinische rationale.

window.Scheduler = (function () {
  const PRIORITY = {
    DIRECT: { key: 'direct', label: 'Direct', cssClass: 'pri-direct', offsetMonths: 0 },
    M1: { key: '1m', label: '+ 1 maand', cssClass: 'pri-1m', offsetMonths: 1 },
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

    const items = []; // {code, label, doseNum, totalDoses, priority, rationale, contraIndic?}
    const warnings = [];

    if (input.noDocs) {
      warnings.push('Geen vaccinatiedocumenten — patiënt wordt behandeld als volledig niet-gevaccineerd conform RIVM-leidraad.');
    }
    if (immuno) {
      warnings.push('Immuundeficiëntie/HIV: levende vaccins (BMR, BCG, varicella, rotavirus) zijn relatief of absoluut gecontra-indiceerd. Overleg met kinderarts/infectioloog.');
    }
    if (pregnant) {
      warnings.push('Zwangerschap: levende vaccins gecontra-indiceerd. Geïnactiveerde vaccins (DTP-IPV, HepB, HPV) zo nodig uitstellen tot post partum, behalve dT/kinkhoest indien geïndiceerd in zwangerschap.');
    }

    // ===== DKTP-Hib-HepB / DTP-IPV =====
    const dtpaDoses = +(docs['DKTP-Hib-HepB'] || 0) + +(docs['DTP-IPV'] || 0);
    if (ageY < 4) {
      const target = ageM < 12 ? 3 : 2; // primair + booster volgt later
      const remaining = Math.max(0, target - +(docs['DKTP-Hib-HepB'] || 0));
      for (let i = 0; i < remaining; i++) {
        items.push({
          code: 'DKTP-Hib-HepB',
          label: 'DKTP-Hib-HepB',
          doseNum: (+(docs['DKTP-Hib-HepB'] || 0)) + i + 1,
          totalDoses: target,
          priority: i === 0 ? PRIORITY.DIRECT : (i === 1 ? PRIORITY.M1 : PRIORITY.M3),
          rationale: `Hexavalent vaccin dekt difterie, kinkhoest, tetanus, polio, Hib en hepatitis B. Bij leeftijd ${ageM} mnd is een primaire serie van ${target} doses geïndiceerd, met booster rond 11 maanden indien van toepassing. Minimuminterval tussen doses: 4 weken (RVP).`,
        });
      }
    } else {
      // ≥ 4 jaar: DTP-IPV
      const target = dtpaDoses < 3 ? (3 - dtpaDoses) : 0;
      let bookedDoses = +(docs['DTP-IPV'] || 0);
      for (let i = 0; i < target; i++) {
        items.push({
          code: 'DTP-IPV',
          label: 'DTP-IPV',
          doseNum: bookedDoses + i + 1,
          totalDoses: 3,
          priority: i === 0 ? PRIORITY.DIRECT : (i === 1 ? PRIORITY.M1 : PRIORITY.M6),
          rationale: `Vanaf 4 jaar wordt DTP-IPV gebruikt (zonder Hib, zonder HepB). Inhaal: 3 doses met intervallen 0 — 1 — 6 maanden. Hepatitis B en Hib worden zo nodig apart aangeboden.`,
        });
      }
      // HepB monovalent indien niet eerder gedekt
      const hepbDocs = +(docs['DKTP-Hib-HepB'] || 0) + +(docs['HepB-mono'] || 0);
      if (hepbDocs < 3) {
        const hepBRem = 3 - hepbDocs;
        for (let i = 0; i < hepBRem; i++) {
          items.push({
            code: 'HepB-mono',
            label: 'Hepatitis B (monovalent)',
            doseNum: hepbDocs + i + 1,
            totalDoses: 3,
            priority: i === 0 ? PRIORITY.DIRECT : (i === 1 ? PRIORITY.M1 : PRIORITY.M6),
            rationale: 'Hepatitis B wordt vanaf 4 jaar niet meer routinematig gecombineerd in DTP-IPV; geef monovalent volgens schema 0-1-6 mnd. Bij HepB-positieve moeder: aanvullende immunoglobuline en versneld schema overleggen.',
          });
        }
      }
    }

    // ===== BMR =====
    const bmrDocs = +(docs['BMR'] || 0);
    if (ageM >= 6 && bmrDocs < 2) {
      if (immuno) {
        warnings.push('BMR is een levend vaccin: bij ernstige immuundeficiëntie gecontra-indiceerd; bij milde immunosuppressie individueel afwegen.');
      }
      const remaining = 2 - bmrDocs;
      for (let i = 0; i < remaining; i++) {
        items.push({
          code: 'BMR',
          label: 'BMR (mazelen-bof-rodehond)',
          doseNum: bmrDocs + i + 1,
          totalDoses: 2,
          priority: i === 0 ? PRIORITY.DIRECT : PRIORITY.M1,
          rationale: `Mazelen heeft hoge transmissibiliteit (R0 12-18) en kent regelmatig importgevallen — direct aanbieden geniet voorkeur. Minimuminterval tussen 2 doses: 4 weken. Vroege dosis vanaf 6 mnd geldig bij outbreak/risico, herhaling vanaf 14 mnd alsnog noodzakelijk.${immuno ? ' Levend vaccin — overleg bij immuundeficiëntie.' : ''}`,
        });
      }
    }

    // ===== MenACWY =====
    const menDocs = +(docs['MenACWY'] || 0);
    if (ageM >= 14 && menDocs < 1) {
      items.push({
        code: 'MenACWY',
        label: 'Meningokokken ACWY',
        doseNum: 1, totalDoses: ageY >= 14 ? 1 : 2,
        priority: PRIORITY.M1,
        rationale: 'Meningokokken ACWY bij 14 mnd en 14 jr volgens RVP. Inhaal: één dosis volstaat indien laatste RVP-leeftijd niet bereikt; bij adolescent (≥14 jr) volstaat één dosis.',
      });
    }

    // ===== Pneumokokken =====
    const pcvDocs = +(docs['Pneumokokken'] || 0);
    if (ageM < 60 && pcvDocs < (ageM < 12 ? 3 : 2)) {
      const target = ageM < 7 ? 3 : (ageM < 12 ? 2 : 1);
      const remaining = Math.max(0, target - pcvDocs);
      for (let i = 0; i < remaining; i++) {
        items.push({
          code: 'Pneumokokken',
          label: 'Pneumokokken (PCV)',
          doseNum: pcvDocs + i + 1, totalDoses: target,
          priority: i === 0 ? PRIORITY.DIRECT : PRIORITY.M1,
          rationale: `Inhaal PCV is alleen nuttig tot 5 jaar; aantal doses afhankelijk van leeftijd bij start (${ageM} mnd → ${target} dosis/doses). Bij asplenie levenslang verhoogd risico — voeg PPV23 toe vanaf 2 jr.`,
        });
      }
    }

    // ===== Rotavirus =====
    if (ageW >= 6 && ageW < 24 && !(docs['Rotavirus'] >= 2)) {
      if (immuno) {
        warnings.push('Rotavirus is een levend vaccin en gecontra-indiceerd bij ernstige immuundeficiëntie (SCID).');
      } else {
        items.push({
          code: 'Rotavirus',
          label: 'Rotavirus',
          doseNum: (+(docs['Rotavirus'] || 0)) + 1, totalDoses: 2,
          priority: PRIORITY.DIRECT,
          rationale: `Strikte leeftijdsgrenzen: 1e dosis < 15 wkn, laatste dosis < 24 wkn. Patiënt is ${ageW} weken — venster nog open, snelheid is essentieel.`,
        });
      }
    }

    // ===== HPV =====
    const hpvDocs = +(docs['HPV'] || 0);
    if (ageY >= 9 && hpvDocs < (ageY < 15 ? 2 : 3)) {
      const target = ageY < 15 ? 2 : 3;
      const remaining = target - hpvDocs;
      for (let i = 0; i < remaining; i++) {
        items.push({
          code: 'HPV',
          label: 'HPV (humaan papillomavirus)',
          doseNum: hpvDocs + i + 1, totalDoses: target,
          priority: i === 0 ? PRIORITY.M1 : (target === 2 ? PRIORITY.M6 : (i === 1 ? PRIORITY.M3 : PRIORITY.M6)),
          rationale: `HPV-vaccinatie wordt aangeboden aan alle kinderen vanaf 9 jaar (sekseneutraal sinds 2022). ${ageY < 15 ? 'Onder 15 jaar volstaan 2 doses (0, 6 mnd).' : 'Vanaf 15 jaar 3 doses (0, 1-2, 6 mnd).'}${female ? ' Bescherming tegen cervixcarcinoom blijft belangrijkste indicatie.' : ' Ook bij jongens bescherming tegen orofarynx-, anus- en peniscarcinoom plus vermindering van transmissie.'}`,
        });
      }
    }

    // ===== BCG =====
    if (tbcRisk && !(docs['BCG'] >= 1)) {
      if (immuno) {
        warnings.push('BCG is gecontra-indiceerd bij immuundeficiëntie (HIV met lage CD4, SCID). Niet plaatsen — overleg infectioloog.');
      } else {
        items.push({
          code: 'BCG',
          label: 'BCG (tuberculose)',
          doseNum: 1, totalDoses: 1,
          priority: PRIORITY.M3,
          rationale: `Herkomstland (${input.country}) staat op de WHO/RIVM TBC-incidentielijst (≥ 50/100.000). BCG is geïndiceerd bij kinderen < 12 jaar zonder eerdere BCG. Voor plaatsing: Mantoux/IGRA om actieve/latente TBC uit te sluiten. BCG is een levend verzwakt vaccin — niet bij immuundeficiëntie.`,
        });
      }
    }

    // ===== Varicella (op indicatie) =====
    if (input.aspleen && ageM >= 12 && !(docs['Varicella'] >= 2) && !immuno) {
      items.push({
        code: 'Varicella',
        label: 'Varicella',
        doseNum: 1, totalDoses: 2,
        priority: PRIORITY.M3,
        rationale: 'Bij asplenie verhoogd risico op gecompliceerde infecties; varicella op indicatie. Levend vaccin — niet bij ernstige immuundeficiëntie.',
      });
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
    const order = ['direct', '1m', '3m', '6m'];
    const PRI_BY_KEY = {
      direct: PRIORITY.DIRECT, '1m': PRIORITY.M1, '3m': PRIORITY.M3, '6m': PRIORITY.M6,
    };
    const buckets = { direct: [], '1m': [], '3m': [], '6m': [] };
    for (const it of items) buckets[it.priority.key].push(it);

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
