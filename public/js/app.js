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

  // Auto-masker: 01012001 → 01-01-2001 direct tijdens typen
  function initDateMask(el) {
    el.addEventListener('input', () => {
      const pos = el.selectionStart;
      let v = el.value.replace(/\D/g, '').slice(0, 8);
      if (v.length > 4) v = `${v.slice(0,2)}-${v.slice(2,4)}-${v.slice(4)}`;
      else if (v.length > 2) v = `${v.slice(0,2)}-${v.slice(2)}`;
      el.value = v;
      try { el.setSelectionRange(Math.min(pos, v.length), Math.min(pos, v.length)); } catch(_) {}
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
  const ADMIN_ROUTE = {
    'DKTP-Hib-HepB': 'i.m. · bovenbeen / deltoid',
    'DTP-IPV':        'i.m. · deltoid',
    'HepB-mono':      'i.m. · deltoid',
    'BMR':            's.c. · bovenarm',
    'MenACWY':        'i.m. · deltoid',
    'Pneumokokken':   'i.m. · bovenbeen / deltoid',
    'HPV':            'i.m. · deltoid',
    'BCG':            'i.d. · linker bovenarm',
    'Varicella':      's.c. · bovenarm',
    'Rotavirus':      'oraal',
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
        'Minimuminterval tussen primaire doses: 4 weken. Minimuminterval voor laatste booster: 4-6 maanden (afhankelijk van vaccin). Zie RIVM-leidraad voor exacte intervallen per antigen.';
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
    const lines = [
      item.rationale,
      '',
      `Leeftijd: ${ageY} jr (${ageM} mnd)${input.dob ? '' : ''}`,
      `Herkomst: ${input.country}${res.patient.tbcRisk ? ' (TBC-risicoland)' : ''}`,
    ];
    if (input.noDocs)   lines.push('Geen vaccinatiedocumenten — behandeld als volledig niet-gevaccineerd.');
    if (input.immuun)   lines.push('⚠ Immuundeficiëntie — overleg contra-indicaties levende vaccins.');
    if (input.prematuur)lines.push('Prematuriteit — vaccineer op kalenderleeftijd.');
    lines.push('', 'Minimuminterval: 4 wkn tussen primaire doses; 6 mnd voor eindbooster waar van toepassing (RVP-richtlijn).');
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

  // ── Anthropic API (BYOK, optioneel) ──────────────────────────────────
  function getApiKey() { return sessionStorage.getItem('anthropic_key') || localStorage.getItem('anthropic_api_key') || ''; }

  async function streamFromAnthropic(prompt, targetEl) {
    const key = getApiKey();
    if (!key) { targetEl.remove(); return; }
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!resp.ok) { targetEl.textContent = `[API-fout ${resp.status}]`; return; }
      const data = await resp.json();
      targetEl.textContent = (data.content || []).map((b) => b.text || '').join('');
    } catch (err) {
      targetEl.textContent = `[Fout: ${err.message}]`;
    }
  }

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
