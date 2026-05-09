// PDF-export voor het inhaalvaccinatieschema.
// Gebruikt jsPDF (UMD) van CDN.

window.PDFExport = (function () {
  const A4 = { w: 210, h: 297 }; // mm
  const M = 15; // marge

  const PRIORITY_COLOR = {
    direct: [192, 50, 43],
    '1m':   [179, 92, 0],
    '2m':   [31, 111, 235],
    '3m':   [31, 111, 235],
    '6m':   [23, 138, 78],
  };

  function generate(result, input, countries) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const country = countries.find((c) => c.code === input.country);

    // ===== Header =====
    doc.setFillColor(26, 34, 56);
    doc.rect(0, 0, A4.w, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('Inhaalvaccinatieschema', M, 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('RIVM-leidraad inhaalvaccinaties 2024 · Beslissingsondersteuning Jeugdarts KNMG', M, 16);

    // ===== Patiëntblok =====
    doc.setTextColor(26, 34, 56);
    let y = 30;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Patiëntgegevens', M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    const ageStr = `${result.patient.ageYears} jr (${result.patient.ageMonths} mnd)`;
    const lines = [
      `Naam: ${input.name || '—'}`,
      `Geboortedatum: ${input.dob || '—'}    Leeftijd: ${ageStr}    Geslacht: ${input.sex || '—'}`,
      `Herkomstland: ${country?.name || input.country || '—'}${result.patient.tbcRisk ? '   (TBC-risicoland)' : ''}`,
      `Aankomstdatum: ${input.arrival || '—'}    Datum eerste consult: ${input.visitDate || '—'}`,
    ];
    const bijz = [
      input.noDocs && 'documenten ontbreken',
      input.prematuur && 'prematuur',
      input.immuun && 'immuundeficiëntie',
      input.zwanger && 'zwanger',
      input.aspleen && 'asplenie',
      input.hepBmoeder && 'HepB+ moeder',
      input.hivContact && 'HIV-positief/contact',
    ].filter(Boolean);
    if (bijz.length) lines.push(`Bijzonderheden: ${bijz.join(', ')}`);
    for (const ln of lines) { doc.text(ln, M, y); y += 4.5; }

    // ===== Waarschuwingen =====
    if (result.warnings.length) {
      y += 2;
      doc.setFillColor(255, 247, 230);
      doc.setDrawColor(179, 92, 0);
      const warnH = 6 + result.warnings.length * 5;
      doc.rect(M, y, A4.w - 2 * M, warnH, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.setTextColor(179, 92, 0);
      doc.text('Klinische aandachtspunten', M + 2, y + 4.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.setTextColor(26, 34, 56);
      let wy = y + 9;
      for (const w of result.warnings) {
        const wrapped = doc.splitTextToSize('• ' + w, A4.w - 2 * M - 4);
        doc.text(wrapped, M + 2, wy);
        wy += wrapped.length * 4;
      }
      y += warnH + 4;
    } else {
      y += 4;
    }

    // ===== Tabel met bezoeken =====
    y = drawVisitsTable(doc, y, result);

    // ===== Voetnoot =====
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5);
    doc.setTextColor(91, 100, 120);
    doc.text(
      'Beslissingsondersteunend hulpmiddel. Eindverantwoordelijkheid berust bij de behandelend arts. ' +
        'Bron: RIVM Leidraad inhaalvaccinaties 2024 · RVP · WHO TBC-risicolanden.',
      M, A4.h - 8, { maxWidth: A4.w - 2 * M }
    );
    doc.text(`Gegenereerd: ${new Date().toLocaleString('nl-NL')}`, M, A4.h - 4);

    // ===== Pagina 2: rationale per vaccin =====
    if (result.items.length) {
      doc.addPage();
      drawRationalePage(doc, result);
    }

    const safe = (input.name || 'patient').replace(/[^a-z0-9]/gi, '_');
    const datestamp = new Date().toISOString().slice(0, 10);
    doc.save(`inhaalschema_${safe}_${datestamp}.pdf`);
  }

  function drawVisitsTable(doc, yStart, result) {
    let y = yStart + 2;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.setTextColor(26, 34, 56);
    doc.text('Schema per bezoek', M, y); y += 6;

    let visitNum = 0;
    for (const visit of result.visits) {
      visitNum++;
      // Pagina-overflow check
      if (y > A4.h - 30) { doc.addPage(); y = M + 5; }

      const color = PRIORITY_COLOR[visit.priority.key] || [31, 111, 235];

      // Headerbalk
      doc.setFillColor(...color);
      doc.rect(M, y, A4.w - 2 * M, 6.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text(`Bezoek ${visitNum} — ${visit.priority.label}`, M + 2, y + 4.6);
      doc.text(`${visit.items.length} vaccin${visit.items.length === 1 ? '' : 's'}`, A4.w - M - 2, y + 4.6, { align: 'right' });
      y += 6.5;

      doc.setTextColor(26, 34, 56);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      for (const it of visit.items) {
        if (y > A4.h - 20) { doc.addPage(); y = M + 5; }
        doc.setFillColor(247, 249, 252);
        doc.rect(M, y, A4.w - 2 * M, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text(it.label, M + 2, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`Dosis ${it.doseNum} van ${it.totalDoses}`, A4.w - M - 2, y + 4, { align: 'right' });
        y += 6.5;
      }
      y += 3;
    }
    return y;
  }

  function drawRationalePage(doc, result) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.setTextColor(26, 34, 56);
    doc.text('Klinische rationale per vaccin', M, M + 4);
    let y = M + 12;

    for (const it of result.items) {
      if (y > A4.h - 30) { doc.addPage(); y = M + 5; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.setTextColor(26, 34, 56);
      doc.text(`${it.label} — dosis ${it.doseNum}/${it.totalDoses} (${it.priority.label})`, M, y);
      y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.setTextColor(60, 70, 90);
      const wrapped = doc.splitTextToSize(it.rationale, A4.w - 2 * M);
      doc.text(wrapped, M, y);
      y += wrapped.length * 4 + 5;
    }
  }

  return { generate };
})();
