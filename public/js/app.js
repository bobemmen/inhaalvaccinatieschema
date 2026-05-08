// UI-koppeling: form, schema-render, chat (deterministisch + optionele Anthropic API).

(function () {
  const { VACCINES, COUNTRIES } = window.RIVM_DATA;
  const $ = (id) => document.getElementById(id);

  let lastResult = null;
  let lastInput = null;

  // ----- Init form -----
  const countrySel = $('country-select');
  for (const c of COUNTRIES) {
    const o = document.createElement('option');
    o.value = c.code; o.textContent = c.name;
    countrySel.appendChild(o);
  }

  const checklist = $('vaccine-checklist');
  for (const v of VACCINES) {
    const row = document.createElement('div');
    row.className = 'vacc-row';
    row.innerHTML = `
      <label class="check" style="margin:0;">
        <input type="checkbox" data-vacc="${v.code}" />
        <span>${v.label}</span>
      </label>
      <input type="number" min="0" max="6" value="0" class="doses" data-vacc-doses="${v.code}" title="aantal gedocumenteerde doses" />
    `;
    checklist.appendChild(row);
  }

  // ----- Datumhulpers -----
  function dutchDateToIso(val) {
    if (!val) return '';
    const m = val.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  document.querySelectorAll('.date-input').forEach((el) => {
    el.addEventListener('input', () => {
      let v = el.value.replace(/\D/g, '');
      if (v.length > 2) v = v.slice(0, 2) + '-' + v.slice(2);
      if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
      el.value = v.slice(0, 10);
    });
  });

  const noDocs = $('noDocs');
  noDocs.addEventListener('change', () => {
    checklist.classList.toggle('disabled', noDocs.checked);
  });

  $('patient-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const documented = {};
    checklist.querySelectorAll('input[data-vacc]').forEach((cb) => {
      const code = cb.dataset.vacc;
      const dosesEl = checklist.querySelector(`[data-vacc-doses="${code}"]`);
      const n = cb.checked ? Math.max(1, parseInt(dosesEl.value || '1', 10)) : parseInt(dosesEl.value || '0', 10);
      if (n > 0) documented[code] = n;
    });

    const input = {
      name: fd.get('name'),
      dob: dutchDateToIso(fd.get('dob')),
      country: fd.get('country'),
      arrival: dutchDateToIso(fd.get('arrival')),
      sex: fd.get('sex'),
      visitDate: dutchDateToIso(fd.get('visitDate')) || new Date().toISOString().slice(0, 10),
      noDocs: noDocs.checked,
      documented,
      prematuur: !!fd.get('prematuur'),
      immuun: !!fd.get('immuun'),
      zwanger: !!fd.get('zwanger'),
      hivContact: !!fd.get('hivContact'),
      aspleen: !!fd.get('aspleen'),
      hepBmoeder: !!fd.get('hepBmoeder'),
      notes: fd.get('notes') || '',
    };

    lastInput = input;
    lastResult = window.Scheduler.generate(input);
    renderSchedule(lastResult, input);
  });

  // ----- Render -----
  function renderSchedule(res, input) {
    const summary = $('schedule-summary');
    summary.classList.add('visible');
    const ageY = res.patient.ageYears, ageM = res.patient.ageMonths;
    const ageStr = ageY >= 2 ? `${ageY} jaar` : `${ageM} maanden`;
    const country = COUNTRIES.find((c) => c.code === input.country);
    summary.innerHTML = `
      <strong>${escapeHtml(input.name || 'Patiënt')}</strong>
      · ${ageStr} · herkomst: ${escapeHtml(country?.name || '?')}
      · TBC-risicoland: <strong>${res.patient.tbcRisk ? 'ja' : 'nee'}</strong>
      · ${res.visits.length} bezoek${res.visits.length === 1 ? '' : 'en'}, ${res.items.length} dosis/doses gepland.
    `;

    const out = $('schedule-output');
    out.innerHTML = '';

    if (res.warnings.length) {
      const w = document.createElement('div');
      w.className = 'warnings';
      w.innerHTML = `<strong>Klinische aandachtspunten</strong><ul>${res.warnings.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`;
      out.appendChild(w);
    }

    if (!res.visits.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'Geen aanvullende inhaalvaccinaties geïndiceerd op basis van de ingevoerde gegevens.';
      out.appendChild(p);
      return;
    }

    let visitNum = 0;
    for (const visit of res.visits) {
      visitNum++;
      const block = document.createElement('div');
      block.className = 'visit-block';
      block.innerHTML = `
        <div class="visit-header">
          <span><strong>Bezoek ${visitNum}</strong> · ${visit.items.length} vaccin${visit.items.length === 1 ? '' : 's'}</span>
          <span class="pri-badge ${visit.priority.cssClass}">${visit.priority.label}</span>
        </div>
        <div class="visit-vaccines"></div>
      `;
      const vBox = block.querySelector('.visit-vaccines');
      for (const it of visit.items) {
        const wrap = document.createElement('div');
        wrap.className = 'vaccine-wrap';
        const line = document.createElement('div');
        line.className = 'vaccine-line';
        line.innerHTML = `
          <div>
            <div class="vacc-name">${escapeHtml(it.label)}</div>
            <div class="vacc-meta">Dosis ${it.doseNum} van ${it.totalDoses} · ${visit.priority.label}</div>
          </div>
          <button type="button" class="explain-btn">Uitleg &amp; advies</button>
        `;
        const expl = document.createElement('div');
        expl.className = 'vaccine-explanation';
        const btn = line.querySelector('button');
        btn.addEventListener('click', () => toggleExplanation(it, res, input, btn, line, expl));
        wrap.appendChild(line);
        wrap.appendChild(expl);
        vBox.appendChild(wrap);
      }
      out.appendChild(block);
    }

    // PDF-knop tonen
    const pdfBtn = $('download-pdf');
    if (pdfBtn) pdfBtn.style.display = 'inline-block';
  }

  function closeAllExplanations(except) {
    document.querySelectorAll('.vaccine-explanation.visible').forEach((el) => {
      if (el === except) return;
      el.classList.remove('visible');
      const line = el.previousElementSibling;
      if (line) {
        line.classList.remove('expanded');
        const b = line.querySelector('.explain-btn');
        if (b) { b.classList.remove('active'); b.textContent = 'Uitleg & advies'; }
      }
    });
  }

  function toggleExplanation(item, res, input, btn, line, expl) {
    const isOpen = expl.classList.contains('visible');
    closeAllExplanations(isOpen ? null : expl);
    if (isOpen) {
      expl.classList.remove('visible');
      line.classList.remove('expanded');
      btn.classList.remove('active');
      btn.textContent = 'Uitleg & advies';
      return;
    }
    if (!expl.dataset.loaded) {
      expl.textContent = buildDeterministicExplanation(item, res, input);
      expl.dataset.loaded = '1';
      if (getApiKey()) {
        const aiBlock = document.createElement('div');
        aiBlock.className = 'ai-block';
        aiBlock.innerHTML = '<div class="ai-label">AI-toelichting (Claude)</div><div class="ai-body">…</div>';
        expl.appendChild(aiBlock);
        streamFromAnthropic(buildPromptForVaccine(item, res, input), aiBlock.querySelector('.ai-body'), true);
      }
    }
    expl.classList.add('visible');
    line.classList.add('expanded');
    btn.classList.add('active');
    btn.textContent = 'Verberg uitleg';
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ----- Chat -----
  const chatLog = $('chat-log');
  const chatForm = $('chat-form');
  const chatInput = $('chat-input');

  function addMsg(role, body) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerHTML = `<div class="who">${role === 'user' ? 'Vraag' : 'Adviseur'}</div><div class="body"></div>`;
    div.querySelector('.body').textContent = body;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
    return div.querySelector('.body');
  }

  function buildDeterministicExplanation(item, res, input) {
    const ageY = res.patient.ageYears, ageM = res.patient.ageMonths;
    const lines = [];
    lines.push(`Vaccin: ${item.label}`);
    lines.push(`Dosis: ${item.doseNum} van ${item.totalDoses} · Prioriteit: ${item.priority.label}`);
    lines.push('');
    lines.push('Klinische rationale:');
    lines.push(item.rationale);
    lines.push('');
    lines.push('Context:');
    lines.push(`• Leeftijd: ${ageY} jaar (${ageM} mnd)`);
    lines.push(`• Herkomst: ${input.country}${res.patient.tbcRisk ? ' (TBC-risicoland)' : ''}`);
    if (input.noDocs) lines.push('• Geen documenten — behandeld als volledig niet-gevaccineerd.');
    if (input.immuun) lines.push('• Immuundeficiëntie — let op contra-indicaties levende vaccins.');
    if (input.prematuur) lines.push('• Prematuur — vaccineer op kalenderleeftijd, niet op gecorrigeerde leeftijd.');
    lines.push('');
    lines.push('Minimuminterval / planning: volg RVP-regels (4 weken tussen primaire doses, 6 maanden voor laatste booster waar geïndiceerd).');
    return lines.join('\n');
  }

  function buildPromptForVaccine(item, res, input) {
    return [
      'Je bent een ervaren Jeugdarts KNMG. Geef een beknopte, klinisch correcte toelichting (max 250 woorden) op het advies hieronder. Gebruik de RIVM-leidraad inhaalvaccinaties 2024 als basis. Antwoord in het Nederlands.',
      '',
      `Vaccin: ${item.label}, dosis ${item.doseNum}/${item.totalDoses}, prioriteit ${item.priority.label}.`,
      `Patiënt: ${res.patient.ageYears} jr (${res.patient.ageMonths} mnd), herkomst ${input.country}${res.patient.tbcRisk ? ' (TBC-risicoland)' : ''}.`,
      `Bijzonderheden: ${[
        input.immuun && 'immuundeficiëntie',
        input.prematuur && 'prematuur',
        input.zwanger && 'zwanger',
        input.aspleen && 'asplenie',
        input.hepBmoeder && 'HepB+ moeder',
        input.noDocs && 'documenten ontbreken',
      ].filter(Boolean).join(', ') || 'geen'}.`,
      `Aanvullende notities: ${input.notes || '-'}`,
      '',
      'Behandel: indicatie, contra-indicaties, intervallen, praktische uitvoering, en aandachtspunten voor ouders.',
    ].join('\n');
  }

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = chatInput.value.trim();
    if (!q) return;
    addMsg('user', q);
    chatInput.value = '';
    const target = addMsg('assistant', deterministicAnswer(q));
    if (getApiKey() && lastResult) {
      streamFromAnthropic(buildFreeFormPrompt(q), target);
    }
  });

  function deterministicAnswer(q) {
    if (!lastResult) {
      return 'Genereer eerst een schema; dan kan ik gerichte uitleg geven. Algemene RIVM-richtlijnen: minimuminterval tussen primaire doses 4 weken; levende vaccins ≥ 4 weken uit elkaar of op dezelfde dag; hexavalent voor < 4 jr, daarna DTP-IPV los.';
    }
    return 'Op basis van het huidige schema: zie de klinische rationale per vaccin. Voor uitgebreide AI-toelichting: voeg een Anthropic API-sleutel toe in het paneel onder de chat.';
  }

  function buildFreeFormPrompt(q) {
    const r = lastResult, i = lastInput;
    return [
      'Je bent een Jeugdarts KNMG. Beantwoord de vraag op basis van de RIVM-leidraad inhaalvaccinaties 2024. Antwoord in het Nederlands, beknopt en klinisch.',
      '',
      `Patiëntcontext: ${r.patient.ageYears} jr (${r.patient.ageMonths} mnd), herkomst ${i.country}${r.patient.tbcRisk ? ' (TBC-risicoland)' : ''}, geslacht ${i.sex}.`,
      `Bijzonderheden: ${[i.immuun && 'immuundeficiëntie', i.prematuur && 'prematuur', i.zwanger && 'zwanger', i.aspleen && 'asplenie', i.noDocs && 'geen documenten'].filter(Boolean).join(', ') || 'geen'}.`,
      `Schema: ${r.items.map((x) => `${x.label} dosis ${x.doseNum}/${x.totalDoses} (${x.priority.label})`).join('; ')}.`,
      '',
      `Vraag: ${q}`,
    ].join('\n');
  }

  // ----- Anthropic API (optioneel, BYOK) -----
  function getApiKey() { return localStorage.getItem('anthropic_api_key') || ''; }
  $('save-key').addEventListener('click', () => {
    const v = $('api-key').value.trim();
    if (v) {
      localStorage.setItem('anthropic_api_key', v);
      $('api-key').value = '';
      addMsg('assistant', 'API-sleutel opgeslagen (lokaal). AI-toelichting is nu actief.');
    } else {
      localStorage.removeItem('anthropic_api_key');
      addMsg('assistant', 'API-sleutel verwijderd.');
    }
  });

  async function streamFromAnthropic(userPrompt, targetEl, replace = false) {
    const key = getApiKey();
    if (!key) return;
    if (replace) targetEl.textContent = '';
    else targetEl.textContent += '\n\n— AI-toelichting —\n';
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!resp.ok) {
        targetEl.textContent += `\n[API-fout ${resp.status}: ${await resp.text()}]`;
        return;
      }
      const data = await resp.json();
      const text = (data.content || []).map((b) => b.text || '').join('');
      targetEl.textContent += text;
      if (chatLog.contains(targetEl)) chatLog.scrollTop = chatLog.scrollHeight;
    } catch (err) {
      targetEl.textContent += `\n[Netwerkfout: ${err.message}]`;
    }
  }

  // ----- PDF-export -----
  $('download-pdf').addEventListener('click', () => {
    if (!lastResult || !lastInput) return;
    if (!window.jspdf || !window.PDFExport) {
      alert('PDF-bibliotheek niet geladen. Probeer de pagina te verversen.');
      return;
    }
    window.PDFExport.generate(lastResult, lastInput, COUNTRIES);
  });
})();
