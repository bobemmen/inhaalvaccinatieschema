// Inhaalvaccinatie Adviseur — UI, tabel-renderer, Flatpickr, PDF.

(function () {
  const { VACCINES, COUNTRIES } = window.RIVM_DATA;
  const $ = (id) => document.getElementById(id);

  let lastResult = null;
  let lastInput  = null;
  let openRowId  = null; // id van de momenteel open adviesrij

  // ── Landen dropdown ───────────────────────────────────────────────────
  const countrySel = $('country-select');
  for (const c of COUNTRIES) {
    const o = document.createElement('option');
    o.value = c.code; o.textContent = c.name;
    countrySel.appendChild(o);
  }

  // ── Vaccinatie-checklist ──────────────────────────────────────────────
  const checklist = $('vaccine-checklist');
  for (const v of VACCINES) {
    const label = document.createElement('label');
    label.className = 'md3-check';
    label.innerHTML = `
      <input type="checkbox" data-vacc="${escHtml(v.code)}" />
      <div>
        <div class="md3-check-label">${escHtml(v.label)}</div>
        <div class="md3-check-sub">
          <input type="number" min="0" max="6" value="0" data-vacc-doses="${escHtml(v.code)}"
                 style="width:38px;padding:1px 4px;font-size:.8rem;border:1px solid var(--md-outline-variant);border-radius:4px;background:var(--md-surface)"
                 title="Gedocumenteerde doses" />
          doses
        </div>
      </div>
    `;
    checklist.appendChild(label);
  }

  $('noDocs').addEventListener('change', function () {
    checklist.querySelectorAll('input').forEach((el) => {
      el.disabled = this.checked;
      el.closest('.md3-check').style.opacity = this.checked ? '.45' : '1';
    });
  });

  // ── Datumhulpers ──────────────────────────────────────────────────────
  function dutchDateToIso(val) {
    if (!val) return '';
    const m = val.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  function isoToDutch(iso) {
    if (!iso) return '';
    const [y, mo, d] = iso.split('-');
    return `${d}-${mo}-${y}`;
  }
  function addMonthsToDate(isoDate, months) {
    const d = new Date(isoDate);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  }
  function ageLabel(dobIso, refIso) {
    const dob = new Date(dobIso), ref = new Date(refIso);
    let y = ref.getFullYear() - dob.getFullYear();
    let m = ref.getMonth() - dob.getMonth();
    if (ref.getDate() < dob.getDate()) m -= 1;
    if (m < 0) { y -= 1; m += 12; }
    if (y === 0) return `${m} mnd`;
    if (m === 0) return `${y} jr`;
    return `${y} jr ${m} mnd`;
  }

  // Auto-masker: 01012001 → 01-01-2001 direct tijdens typen.
  // Controle op e.isTrusted: Flatpickr vuurt synthetische input-events (isTrusted=false)
  // die we overslaan om te voorkomen dat het masker een al-geformatteerde waarde sloopt.
  function initDateMask(el) {
    el.addEventListener('input', (e) => {
      if (!e.isTrusted) return;
      const raw = el.value.replace(/\D/g, '').slice(0, 8);
      let v;
      if (raw.length > 4) v = `${raw.slice(0,2)}-${raw.slice(2,4)}-${raw.slice(4)}`;
      else if (raw.length > 2) v = `${raw.slice(0,2)}-${raw.slice(2)}`;
      else v = raw;
      el.value = v;
      try { el.setSelectionRange(v.length, v.length); } catch(_) {}
    });
  }

  document.querySelectorAll('.date-input').forEach((el) => {
    initDateMask(el);
    if (window.flatpickr) {
      window.flatpickr(el, {
        dateFormat: 'd-m-Y',
        allowInput: true,
        locale: (window.flatpickr.l10ns && window.flatpickr.l10ns.nl) || 'default',
        maxDate: el.name === 'dob' ? 'today' : undefined,
        disableMobile: false,
      });
    }
  });

  // ── Formulier submit ──────────────────────────────────────────────────
  $('patient-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const documented = {};
    checklist.querySelectorAll('input[data-vacc]').forEach((cb) => {
      const code = cb.dataset.vacc;
      const dosesEl = checklist.querySelector(`[data-vacc-doses="${code}"]`);
      const n = cb.checked ? Math.max(1, parseInt(dosesEl.value || '1', 10))
                           : parseInt(dosesEl.value || '0', 10);
      if (n > 0) documented[code] = n;
    });

    lastInput = {
      name:      fd.get('name') || '',
      dob:       dutchDateToIso(fd.get('dob')),
      sex:       fd.get('sex') || 'X',
      country:   fd.get('country'),
      arrival:   dutchDateToIso(fd.get('arrival')),
      visitDate: dutchDateToIso(fd.get('visitDate')) || new Date().toISOString().slice(0, 10),
      noDocs:    !!$('noDocs').checked,
      documented,
      prematuur: !!fd.get('prematuur'),
      immuun:    !!fd.get('immuun'),
      zwanger:   !!fd.get('zwanger'),
      hivContact:!!fd.get('hivContact'),
      aspleen:   !!fd.get('aspleen'),
      hepBmoeder:!!fd.get('hepBmoeder'),
      notes:     fd.get('notes') || '',
      maxPerVisit: parseInt(fd.get('maxPerVisit') || '2', 10),
    };

    lastResult = window.Scheduler.generate(lastInput);
    renderSchedule(lastResult, lastInput);
  });

  // Bij wijziging van max prikken/consult: schema direct herberekenen
  document.querySelectorAll('input[name="maxPerVisit"]').forEach((r) => {
    r.addEventListener('change', () => {
      if (!lastInput) return;
      lastInput.maxPerVisit = parseInt(r.value, 10);
      lastResult = window.Scheduler.generate(lastInput);
      renderSchedule(lastResult, lastInput);
    });
  });

  // Reset: verberg schema
  $('patient-form').addEventListener('reset', () => {
    lastResult = null; lastInput = null; openRowId = null;
    $('schedule-empty').style.display = '';
    $('schedule-ready').style.display = 'none';
    $('patient-strip').classList.remove('visible');
    $('download-pdf').style.display = 'none';
  });

  // ── Toedieningsweg per vaccin ─────────────────────────────────────────
  // Bronnen:
  //   • RIVM LCI Uitvoeringsregels Rijksvaccinatieprogramma
  //     (https://lci.rivm.nl/richtlijnen/rijksvaccinatieprogramma)
  //   • Actuele bijsluiterteksten (CBG/EMA SmPC) per vaccin
  //   • WHO Best Practices for Injections and Related Procedures (2010)
  // Algemene principes:
  //   • Zuigelingen (< 12 mnd): i.m. in vastus lateralis (anterolateraal bovenbeen)
  //   • Peuter/kind/volwassene: i.m. in deltoid
  //   • Levende vaccins BMR en varicella: traditioneel s.c.; BCG strikt i.d.
  // Eindverantwoordelijkheid: raadpleeg altijd de actuele bijsluiter en RIVM-richtlijn.
  const ADMIN_ROUTE = {
    'DKTP-Hib-HepB': 'i.m. · vastus lateralis (anterolateraal bovenbeen) bij zuigelingen; deltoid vanaf ca. 12 mnd',
    'DKTP':           'i.m. · deltoid',
    'HepB-mono':      'i.m. · deltoid',
    'MenB':           'i.m. · vastus lateralis (anterolateraal bovenbeen)',
    'BMR':            's.c. · bovenarm',
    'MenACWY':        'i.m. · deltoid (≥ 12 mnd) of vastus lateralis',
    'Pneumokokken':   'i.m. · vastus lateralis (anterolateraal bovenbeen) bij zuigelingen; deltoid vanaf ca. 12 mnd',
    'HPV':            'i.m. · deltoid',
    'BCG':            'i.d. · linker bovenarm (insertie m. deltoideus)',
    'Hib-mono':       'i.m. · deltoid',
    'Varicella':      's.c. · bovenarm',
    'Rotavirus':      'oraal (niet injecteren)',
  };

  // ── Prioriteit → chip class ───────────────────────────────────────────
  const PRI_CHIP = { direct: 'chip-direct', '1m': 'chip-1m', '3m': 'chip-3m', '6m': 'chip-6m' };

  // ── Render schedule ───────────────────────────────────────────────────
  function renderSchedule(res, input) {
    // Schakel zichtbaarheid
    $('schedule-empty').style.display = 'none';
    const ready = $('schedule-ready');
    ready.style.display = 'flex';

    // Patient strip
    const strip = $('patient-strip');
    strip.classList.add('visible');
    const country = COUNTRIES.find((c) => c.code === input.country);
    const sexLabel = { F: '♀', M: '♂', X: '⚲' }[input.sex] || '';
    $('ps-name').textContent = input.name || '—';
    $('ps-meta').textContent = [
      input.dob ? `geb. ${isoToDutch(input.dob)}` : '',
      sexLabel,
      country ? country.name : '',
      res.patient.tbcRisk ? 'TBC-risicoland' : '',
    ].filter(Boolean).join(' · ');
    $('download-pdf').style.display = 'inline-flex';

    // KPI strip
    const nVisits = res.visits.length;
    const nItems  = res.items.length;
    const distinctAntigens = [...new Set(res.items.map((it) => it.code))].length;
    const lastVisit = res.visits.length
      ? addMonthsToDate(input.visitDate, res.visits[res.visits.length - 1].priority.offsetMonths)
      : input.visitDate;

    $('kpi-visits').textContent     = nVisits;
    $('kpi-visits-sub').textContent = `verspreid over ${res.visits[res.visits.length-1]?.priority.offsetMonths || 0} mnd`;
    $('kpi-doses').textContent      = nItems;
    $('kpi-doses-sub').textContent  = `${distinctAntigens} antigeen${distinctAntigens===1?'':'en'}`;
    $('kpi-start').textContent      = isoToDutch(input.visitDate);
    $('kpi-start-sub').textContent  = 'eerste consult';
    $('kpi-end').textContent        = isoToDutch(lastVisit);
    $('kpi-end-sub').textContent    = input.dob ? `leeftijd: ${ageLabel(input.dob, lastVisit)}` : '';

    // Waarschuwingen
    const warnEl = $('schedule-warnings');
    if (res.warnings.length) {
      warnEl.style.display = 'block';
      warnEl.innerHTML = `<strong style="font-size:12px;color:var(--md-on-warn-container)">Klinische aandachtspunten</strong><ul>${res.warnings.map((w) => `<li>${escHtml(w)}</li>`).join('')}</ul>`;
    } else {
      warnEl.style.display = 'none';
    }

    // Tabel body
    const tbody = $('schedule-tbody');
    tbody.innerHTML = '';
    openRowId = null;

    let rowIdx = 0;
    let visitNum = 0;
    for (const visit of res.visits) {
      visitNum++;
      const visitDate = addMonthsToDate(input.visitDate, visit.priority.offsetMonths);
      const visitAge  = input.dob ? ageLabel(input.dob, visitDate) : '—';

      // Consult-scheidingsrij
      const consultTr = document.createElement('tr');
      consultTr.className = 'row-consult';
      consultTr.innerHTML = `<td colspan="7">Bezoek ${visitNum} — ${visit.priority.label} &nbsp;·&nbsp; ${isoToDutch(visitDate)} &nbsp;·&nbsp; leeftijd ${visitAge}</td>`;
      tbody.appendChild(consultTr);

      let itemNum = 0;
      for (const it of visit.items) {
        itemNum++;
        rowIdx++;
        const rowId = `${visitNum}.${itemNum}`;
        const route = ADMIN_ROUTE[it.code] || 'i.m.';

        // Vaccine rij
        const tr = document.createElement('tr');
        tr.className = 'row-vaccine';
        tr.dataset.rowId = rowId;
        tr.innerHTML = `
          <td class="td-num">${escHtml(rowId)}</td>
          <td class="td-when">${isoToDutch(visitDate)}</td>
          <td class="td-age">${escHtml(visitAge)}</td>
          <td class="td-vac">
            <div class="vac-name">${escHtml(it.label)}</div>
            <div class="vac-meta">${escHtml(route)}</div>
          </td>
          <td class="td-dose">${it.doseNum} / ${it.totalDoses}</td>
          <td class="td-status"><span class="md3-chip ${PRI_CHIP[visit.priority.key] || ''}">${escHtml(visit.priority.label)}</span></td>
          <td class="td-chevron"><span class="chevron" id="chev-${escHtml(rowId)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </span></td>
        `;
        tr.addEventListener('click', () => toggleAdvice(rowId, it, input, res, visitDate, visitAge));

        // Advies-rij (verborgen)
        const advTr = document.createElement('tr');
        advTr.className = 'row-advice';
        advTr.id = `adv-${rowId}`;
        advTr.style.display = 'none';
        advTr.innerHTML = `<td colspan="7"><div class="advice-inner" id="adv-inner-${escHtml(rowId)}"></div></td>`;

        tbody.appendChild(tr);
        tbody.appendChild(advTr);
      }
    }

    // Interval-banner (indien meerdere doses)
    const banner = $('interval-banner');
    const multiDose = res.items.filter((it) => it.totalDoses > 1);
    if (multiDose.length) {
      banner.classList.add('visible');
      $('interval-banner-text').textContent =
        'Minimumintervallen (RIVM-leidraad 2024): primaire doses ≥ 4 weken; DKTP-booster ≥ 6 mnd na laatste primaire dosis; PCV-booster ≥ 8 wkn na serie; HPV (2-dose) minimaal 5 mnd interval; Rotavirus: alle doses vóór 24 levensweken (strikte grens). Controleer altijd de actuele RIVM-leidraad per antigen.';
    } else {
      banner.classList.remove('visible');
    }
  }

  // ── Toggle advice rij ─────────────────────────────────────────────────
  function toggleAdvice(rowId, item, input, res, visitDate, visitAge) {
    const advTr   = document.getElementById(`adv-${rowId}`);
    const chevEl  = document.getElementById(`chev-${rowId}`);
    const vaccRow = advTr.previousElementSibling;
    const isOpen  = openRowId === rowId;

    // Sluit huidige open rij
    if (openRowId) {
      const prevAdv  = document.getElementById(`adv-${openRowId}`);
      const prevChev = document.getElementById(`chev-${openRowId}`);
      const prevRow  = prevAdv?.previousElementSibling;
      if (prevAdv)  prevAdv.style.display = 'none';
      if (prevChev) prevChev.classList.remove('open');
      if (prevRow)  prevRow.classList.remove('active');
      openRowId = null;
    }

    if (isOpen) return; // was al open → alleen sluiten

    // Open nieuwe rij
    openRowId = rowId;
    vaccRow.classList.add('active');
    chevEl.classList.add('open');
    advTr.style.display = '';

    // Vul inhoud (altijd vers opbouwen)
    const inner = document.getElementById(`adv-inner-${rowId}`);
    const explanation = buildExplanation(item, input, res);
    inner.innerHTML = `
      <div class="advice-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div class="advice-body">
        <div class="advice-title">Uitleg &amp; advies — ${escHtml(item.label)}</div>
        <div class="advice-text" id="adv-text-${escHtml(rowId)}">${escHtml(explanation)}</div>
        <div class="advice-refs">↗ RIVM Leidraad inhaalvaccinaties 2024</div>
        <div class="advice-actions">
          <button class="md3-btn md3-btn-text" style="font-size:12px;padding:4px 8px" onclick="event.stopPropagation();document.getElementById('adv-${rowId}').style.display='none';document.getElementById('chev-${rowId}').classList.remove('open');this.closest('tr').previousElementSibling.classList.remove('active');window._openRowId=null;">Sluiten</button>
        </div>
      </div>
    `;

    // Optionele AI-toelichting
    if (getApiKey()) {
      const textEl = document.getElementById(`adv-text-${rowId}`);
      const aiDiv  = document.createElement('div');
      aiDiv.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px dashed var(--md-outline-variant);color:var(--md-secondary);white-space:pre-wrap;font-size:12.5px';
      aiDiv.textContent = '…';
      textEl.parentElement.insertBefore(aiDiv, textEl.nextSibling);
      streamFromAnthropic(buildAIPrompt(item, input, res), aiDiv);
    }
  }

  // ── Uitleg opbouwen ───────────────────────────────────────────────────
  function buildExplanation(item, input, res) {
    const ageY = res.patient.ageYears, ageM = res.patient.ageMonths;
    const route = ADMIN_ROUTE[item.code] || 'i.m.';
    const lines = [
      item.rationale,
      '',
      `── Patiëntcontext ──`,
      `Leeftijd: ${ageY} jr (${ageM} mnd)`,
      `Herkomst: ${input.country}${res.patient.tbcRisk ? ' (TBC-risicoland)' : ''}`,
      `Toedieningsweg: ${route}`,
    ];
    if (input.noDocs)    lines.push('⚠ Geen vaccinatiedocumenten — behandeld als volledig niet-gevaccineerd (RIVM-leidraad).');
    if (input.immuun)    lines.push('⚠ Immuundeficiëntie — overleg contra-indicaties levende vaccins (BMR, BCG, varicella, rotavirus).');
    if (input.prematuur) lines.push('⚠ Prematuriteit — vaccineer op kalenderleeftijd (niet gecorrigeerde leeftijd), conform RVP-richtlijn.');
    if (input.hepBmoeder)lines.push('⚠ HepB-positieve moeder — versneld HepB-schema + HBIg + controle serologie op 9-12 mnd.');
    if (input.aspleen)   lines.push('⚠ Asplenie — ook PPV23 (pneumokokken polysacharide) overwegen ≥ 2 jr; levenslang verhoogd risico.');
    lines.push('', 'Bron: RIVM Leidraad inhaalvaccinaties 2024 · RVP uitvoeringsrichtlijnen.');
    return lines.join('\n');
  }

  function buildAIPrompt(item, input, res) {
    return [
      'Je bent een ervaren Jeugdarts KNMG. Geef een beknopte klinisch correcte toelichting (max 220 woorden). Gebruik de RIVM-leidraad inhaalvaccinaties 2024. Antwoord in het Nederlands.',
      '',
      `Vaccin: ${item.label}, dosis ${item.doseNum}/${item.totalDoses}, prioriteit ${item.priority.label}.`,
      `Patiënt: ${res.patient.ageYears} jr (${res.patient.ageMonths} mnd), herkomst ${input.country}${res.patient.tbcRisk ? ' (TBC-risicoland)' : ''}.`,
      `Bijzonderheden: ${[input.immuun&&'immuundeficiëntie',input.prematuur&&'prematuur',input.zwanger&&'zwanger',input.aspleen&&'asplenie',input.hepBmoeder&&'HepB+ moeder',input.noDocs&&'documenten ontbreken'].filter(Boolean).join(', ')||'geen'}.`,
      'Behandel: indicatie, contra-indicaties, intervallen, praktische uitvoering, aandachtspunten voor ouders.',
    ].join('\n');
  }

  // ── Anthropic API — server-side proxy + optionele BYOK-fallback ──────
  // Primair pad: POST /api/ai-analyze (sleutel staat in .env op de server).
  // Fallback: directe browser-aanroep als sessionStorage/localStorage een
  // eigen sleutel bevat (BYOK). Zo werkt de app als demo zonder browserconfig.
  function getClientKey() {
    return sessionStorage.getItem('anthropic_key') || localStorage.getItem('anthropic_api_key') || '';
  }
  function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || '';
  }

  async function callAnthropic(payload, targetEl) {
    // Probeer server-proxy
    try {
      const resp = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        const data = await resp.json();
        const text = (data.content || []).map((b) => b.text || '').join('');
        if (targetEl) targetEl.textContent = text;
        return text;
      }
      if (resp.status === 503) {
        // Server heeft geen sleutel — val terug op BYOK indien beschikbaar
        const clientKey = getClientKey();
        if (!clientKey) {
          if (targetEl) targetEl.remove();
          return null;
        }
        return await callAnthropicDirect(payload, clientKey, targetEl);
      }
      const errText = await resp.text();
      if (targetEl) targetEl.textContent = `[API-fout ${resp.status}] ${errText.slice(0, 300)}`;
      return null;
    } catch (err) {
      // Netwerkfout (bv. offline) — probeer BYOK
      const clientKey = getClientKey();
      if (clientKey) return await callAnthropicDirect(payload, clientKey, targetEl);
      if (targetEl) targetEl.textContent = `[Netwerkfout: ${err.message}]`;
      return null;
    }
  }

  async function callAnthropicDirect(payload, apiKey, targetEl) {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        if (targetEl) targetEl.textContent = `[API-fout ${resp.status}]`;
        return null;
      }
      const data = await resp.json();
      const text = (data.content || []).map((b) => b.text || '').join('');
      if (targetEl) targetEl.textContent = text;
      return text;
    } catch (err) {
      if (targetEl) targetEl.textContent = `[Fout: ${err.message}]`;
      return null;
    }
  }

  // Wrapper voor de uitleg-accordion (kleine toelichting per vaccin)
  async function streamFromAnthropic(prompt, targetEl) {
    await callAnthropic(
      { model: 'claude-sonnet-4-6', max_tokens: 500, messages: [{ role: 'user', content: prompt }] },
      targetEl,
    );
  }

  // ── AI-analyse buitenlandse vaccinaties ──────────────────────────────
  // Stuurt vrije tekst van patiënt + huidige RVP-context naar Claude Sonnet 4.6
  // en toont een gestructureerd advies over welke RVP-vaccins al gedekt zijn
  // door buitenlandse equivalenten (bijv. Pentavalent, OPV, DTwP).
  $('ai-foreign-btn').addEventListener('click', async () => {
    const text = ($('foreign-vaccines').value || '').trim();
    const resultEl = $('ai-foreign-result');
    resultEl.style.display = 'block';

    if (!text) {
      resultEl.textContent = 'Voer eerst de buitenlandse vaccinatiegeschiedenis in.';
      return;
    }
    if (!lastInput || !lastResult) {
      resultEl.textContent = 'Genereer eerst het schema (klik "Schema genereren") zodat de AI de patiëntcontext kan meenemen.';
      return;
    }

    resultEl.textContent = '⏳ Bezig met AI-analyse (Claude Sonnet 4.6)…';

    const country = COUNTRIES.find((c) => c.code === lastInput.country);
    const plannedSummary = lastResult.items
      .map((it) => `- ${it.label} dosis ${it.doseNum}/${it.totalDoses} (prioriteit: ${it.priority.label})`)
      .join('\n');

    const prompt = [
      'Je bent een ervaren Jeugdarts KNMG met expertise in inhaalvaccinaties voor migranten/vluchtelingen volgens de RIVM-leidraad inhaalvaccinaties 2024 en de RVP uitvoeringsrichtlijnen. Antwoord in het Nederlands.',
      '',
      'TAAK: een patiënt heeft in het thuisland vaccinaties gehad, vaak met andere namen (bv. Pentavalent = DTwP-Hib-HepB; OPV = orale polio; DTaP = DKTP zonder polio; Measles-only = niet gelijk aan BMR). Identificeer welke buitenlandse vaccins equivalent zijn aan welke RVP-vaccins, en geef een aangepast inhaalschema-advies.',
      '',
      `PATIËNT-CONTEXT:`,
      `- Leeftijd: ${lastResult.patient.ageYears} jr (${lastResult.patient.ageMonths} mnd)`,
      `- Herkomstland: ${country?.name || lastInput.country}${lastResult.patient.tbcRisk ? ' (TBC-hoog-incidentieland)' : ''}`,
      `- Bijzonderheden: ${[
          lastInput.immuun && 'immuundeficiëntie',
          lastInput.prematuur && 'prematuriteit',
          lastInput.zwanger && 'zwanger',
          lastInput.aspleen && 'asplenie',
          lastInput.hepBmoeder && 'HepB+ moeder',
          lastInput.hivContact && 'HIV-contact',
        ].filter(Boolean).join(', ') || 'geen'}`,
      '',
      `HUIDIG VOORGESTELD INHAALSCHEMA (op basis van "geen documentatie" / wat gebruiker heeft ingevuld):`,
      plannedSummary || '(geen)',
      '',
      `BUITENLANDSE VACCINATIEGESCHIEDENIS (vrije tekst van patiënt/ouder):`,
      `"""${text}"""`,
      '',
      'GEVRAAGDE OUTPUT (gestructureerd, max 450 woorden):',
      '',
      '## Conclusie',
      'Eén alinea: kan het schema worden ingekort, en zo ja waar?',
      '',
      '## Equivalenten (buitenland → RVP)',
      'Per genoemd vaccin: welk RVP-vaccin dekt het, hoeveel doses tellen mee.',
      '',
      '## Aanpassingen op het inhaalschema',
      'Per RVP-vaccin uit het huidige schema: kan dit eruit / minder doses / ongewijzigd.',
      '',
      '## Aandachtspunten',
      'Bv. OPV ≠ IPV maar geeft wel beschermende immuniteit; serologie overwegen bij twijfel; DTwP telt mee als DTaP-equivalent voor primaire serie; mazelen-monovaccin telt niet als 2 BMR-doses.',
      '',
      'Wees voorzichtig: bij twijfel over de samenstelling van een buitenlands vaccin → adviseer serologie of behandel als niet-gevaccineerd (RIVM-uitgangspunt).',
    ].join('\n');

    const reply = await callAnthropic(
      { model: 'claude-sonnet-4-6', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] },
      resultEl,
    );
    if (reply !== null) resultEl.textContent = reply.trim() || '[Geen antwoord ontvangen]';
  });

  // ── PDF-knop ──────────────────────────────────────────────────────────
  $('download-pdf').addEventListener('click', () => {
    if (!lastResult || !lastInput) return;
    if (!window.jspdf || !window.PDFExport) { alert('PDF-bibliotheek niet geladen. Ververs de pagina.'); return; }
    window.PDFExport.generate(lastResult, lastInput, COUNTRIES);
  });

  // ── Helpers ───────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
})();
