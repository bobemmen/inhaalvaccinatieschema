<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Inhaalvaccinatie Adviseur — Jeugdarts KNMG</title>
<link rel="stylesheet" href="{{ asset('css/styles.css') }}" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/themes/airbnb.css" />
</head>
<body>
<header class="topbar">
  <div class="brand">
    <span class="logo" aria-hidden="true">💉</span>
    <div>
      <h1>Inhaalvaccinatie Adviseur</h1>
      <p class="subtitle">Werkt als Jeugdarts KNMG · RIVM-leidraad inhaalvaccinaties 2024</p>
    </div>
  </div>
  <div class="disclaimer" role="note">
    Klinisch beslissingsondersteunend hulpmiddel. Eindverantwoordelijkheid berust bij de behandelend arts.
  </div>
</header>

<main class="layout">
  <section class="panel form-panel" aria-labelledby="form-title">
    <h2 id="form-title">1. Patiëntgegevens</h2>
    <form id="patient-form">
      <div class="grid-2">
        <label>Naam
          <input type="text" name="name" autocomplete="off" placeholder="Voornaam Achternaam" />
        </label>
        <label>Geboortedatum
          <input type="text" name="dob" placeholder="dd-mm-jjjj" required class="date-input" />
        </label>
        <label>Herkomstland
          <select name="country" id="country-select" required>
            <option value="">— kies land —</option>
          </select>
        </label>
        <label>Aankomstdatum in Nederland
          <input type="text" name="arrival" placeholder="dd-mm-jjjj" required class="date-input" />
        </label>
        <label>Geslacht
          <select name="sex" required>
            <option value="">— kies —</option>
            <option value="F">Vrouw / meisje</option>
            <option value="M">Man / jongen</option>
            <option value="X">Anders / onbekend</option>
          </select>
        </label>
        <label>Datum eerste consult
          <input type="text" name="visitDate" placeholder="dd-mm-jjjj (optioneel)" class="date-input" />
        </label>
      </div>

      <h3>2. Reeds gedocumenteerde vaccinaties</h3>
      <div class="checkbox-row">
        <label class="check">
          <input type="checkbox" name="noDocs" id="noDocs" />
          <span>Vaccinatiedocumenten ontbreken (behandel als volledig niet-gevaccineerd)</span>
        </label>
      </div>
      <div id="vaccine-checklist" class="vaccine-checklist"></div>

      <h3>3. Medische bijzonderheden</h3>
      <div class="checkbox-grid">
        <label class="check"><input type="checkbox" name="prematuur" /><span>Prematuriteit (&lt; 37 wkn)</span></label>
        <label class="check"><input type="checkbox" name="immuun" /><span>Immuundeficiëntie / immunosuppressie</span></label>
        <label class="check"><input type="checkbox" name="zwanger" /><span>Zwangerschap</span></label>
        <label class="check"><input type="checkbox" name="hivContact" /><span>HIV-positief of contact</span></label>
        <label class="check"><input type="checkbox" name="aspleen" /><span>(Functionele) asplenie</span></label>
        <label class="check"><input type="checkbox" name="hepBmoeder" /><span>HepB-positieve moeder</span></label>
      </div>
      <label class="full">Aanvullende klinische context (vrije tekst)
        <textarea name="notes" rows="2" placeholder="bijv. eczeem, allergieën, lopende infectie..."></textarea>
      </label>

      <div class="actions">
        <button type="submit" class="primary">Schema genereren</button>
        <button type="reset" class="ghost">Wissen</button>
      </div>
    </form>
  </section>

  <section class="panel schedule-panel" aria-labelledby="schedule-title">
    <div class="schedule-head">
      <h2 id="schedule-title">Inhaalschema</h2>
      <button type="button" id="download-pdf" class="pdf-btn" style="display:none">⬇ Download PDF</button>
    </div>
    <div id="schedule-summary" class="summary"></div>
    <div id="schedule-output" class="schedule-output">
      <p class="empty">Nog geen schema gegenereerd. Vul de patiëntgegevens in en klik op <em>Schema genereren</em>.</p>
    </div>
  </section>

  <section class="panel chat-panel" aria-labelledby="chat-title">
    <h2 id="chat-title">Uitleg &amp; advies</h2>
    <p class="hint">Klik op <em>Uitleg &amp; advies</em> bij een vaccin voor een gedetailleerde klinische toelichting, of stel zelf een vraag.</p>
    <div id="chat-log" class="chat-log" aria-live="polite"></div>
    <form id="chat-form" class="chat-form">
      <input type="text" id="chat-input" placeholder="Stel een klinische vraag over dit schema..." autocomplete="off" />
      <button type="submit">Vraag</button>
    </form>
    <details class="api-config">
      <summary>API-configuratie (optioneel, voor AI-chat)</summary>
      <p class="small">
        Voor uitgebreide AI-toelichting kun je een Anthropic API-sleutel toevoegen
        (wordt alleen lokaal in je browser opgeslagen, gaat rechtstreeks naar Anthropic).
        Zonder sleutel toont de adviseur deterministische uitleg op basis van de RIVM-regels.
      </p>
      <label>Anthropic API key
        <input type="password" id="api-key" placeholder="sk-ant-..." autocomplete="off" />
      </label>
      <button type="button" id="save-key">Opslaan</button>
    </details>
  </section>
</main>

<footer class="footer">
  <small>Bronnen: RIVM Leidraad inhaalvaccinaties 2024 · Rijksvaccinatieprogramma · WHO TBC-risicolanden</small>
</footer>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js"></script>
<script src="https://npmcdn.com/flatpickr@4.6.13/dist/l10n/nl.js"></script>
<script src="{{ asset('js/data.js') }}"></script>
<script src="{{ asset('js/scheduler.js') }}"></script>
<script src="{{ asset('js/pdf.js') }}"></script>
<script src="{{ asset('js/app.js') }}"></script>
</body>
</html>
