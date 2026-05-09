<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="csrf-token" content="{{ csrf_token() }}" />
<title>Inhaalvaccinatie Adviseur — Jeugdarts KNMG</title>
<link rel="stylesheet" href="{{ asset('css/styles.css') }}" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css" />
</head>
<body>
<div class="md3-root">

  <!-- AppBar -->
  <header class="md3-appbar">
    <div class="md3-appbar-brand">
      <span class="md3-appbar-logo" aria-hidden="true">💉</span>
      <div>
        <div class="md3-appbar-title">Inhaalvaccinatie Adviseur</div>
        <div class="md3-appbar-sub">Jeugdarts KNMG · RIVM-leidraad 2024</div>
      </div>
    </div>
    <div class="md3-appbar-disclaimer">
      Klinisch beslissingsondersteunend hulpmiddel.<br>Eindverantwoordelijkheid berust bij de behandelend arts.
    </div>
  </header>

  <!-- Patient context strip (getoond na schema-generatie) -->
  <div class="patient-strip" id="patient-strip">
    <span class="md3-overline">Patiëntdossier</span>
    <span class="ps-sep">·</span>
    <span class="ps-name" id="ps-name">—</span>
    <span class="ps-meta" id="ps-meta"></span>
    <span class="md3-chip chip-primary" style="margin-left:6px">RIVM-leidraad 2024</span>
    <div style="flex:1"></div>
    <button type="button" class="md3-btn md3-btn-outline" id="download-pdf" style="display:none">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download PDF
    </button>
  </div>

  <div class="content-split">

    <!-- LEFT — invoerformulier -->
    <aside class="input-column" id="input-column">

      <!-- Card 1: Patiëntgegevens -->
      <div class="md3-card">
        <div class="md3-card-header">
          <div class="md3-card-num">1</div>
          <div class="md3-card-titles">
            <div class="md3-card-title">Patiëntgegevens</div>
            <div class="md3-card-subtitle">Verplichte velden voor schemaberekening</div>
          </div>
        </div>
        <div class="md3-card-body">
          <form id="patient-form">
            <div class="grid-2">
              <div class="md3-field span2">
                <label class="md3-label">Naam</label>
                <input type="text" name="name" class="md3-input" autocomplete="off" placeholder="Voornaam Achternaam" />
              </div>
              <div class="md3-field">
                <label class="md3-label">Geboortedatum</label>
                <input type="text" name="dob" class="md3-input date-input" placeholder="dd-mm-jjjj" required />
              </div>
              <div class="md3-field">
                <label class="md3-label">Geslacht</label>
                <select name="sex" class="md3-select" required>
                  <option value="">— kies —</option>
                  <option value="F">Vrouw / meisje</option>
                  <option value="M">Man / jongen</option>
                  <option value="X">Anders / onbekend</option>
                </select>
              </div>
              <div class="md3-field span2">
                <label class="md3-label">Herkomstland</label>
                <select name="country" id="country-select" class="md3-select" required>
                  <option value="">— kies land —</option>
                </select>
              </div>
              <div class="md3-field">
                <label class="md3-label">Aankomst NL <span class="md3-label-hint">dd-mm-jjjj</span></label>
                <input type="text" name="arrival" class="md3-input date-input" placeholder="dd-mm-jjjj" required />
              </div>
              <div class="md3-field">
                <label class="md3-label">Eerste consult</label>
                <input type="text" name="visitDate" class="md3-input date-input" placeholder="dd-mm-jjjj (optioneel)" />
              </div>
            </div>

            <!-- Card 2: Gedocumenteerde vaccinaties -->
            <div class="md3-card" style="margin-top:14px">
              <div class="md3-card-header">
                <div class="md3-card-num">2</div>
                <div class="md3-card-titles">
                  <div class="md3-card-title">Gedocumenteerde vaccinaties</div>
                  <div class="md3-card-subtitle">Eerder gegeven doses, indien bekend</div>
                </div>
              </div>
              <div class="md3-card-body">
                <label class="md3-check">
                  <input type="checkbox" name="noDocs" id="noDocs" />
                  <div>
                    <div class="md3-check-label">Documentatie ontbreekt</div>
                    <div class="md3-check-sub">Behandel patiënt als volledig niet-gevaccineerd</div>
                  </div>
                </label>
                <hr class="md3-divider" style="margin:8px 0" />
                <div class="grid-2" id="vaccine-checklist"></div>
              </div>
            </div>

            <!-- Card 3: Medische bijzonderheden -->
            <div class="md3-card" style="margin-top:14px">
              <div class="md3-card-header">
                <div class="md3-card-num">3</div>
                <div class="md3-card-titles">
                  <div class="md3-card-title">Medische bijzonderheden</div>
                  <div class="md3-card-subtitle">Beïnvloedt schema en contra-indicaties</div>
                </div>
              </div>
              <div class="md3-card-body">
                <div class="grid-2">
                  <label class="md3-check"><input type="checkbox" name="prematuur" /><div><div class="md3-check-label">Prematuriteit</div><div class="md3-check-sub">&lt; 37 weken</div></div></label>
                  <label class="md3-check"><input type="checkbox" name="immuun" /><div><div class="md3-check-label">Immuundeficiëntie</div><div class="md3-check-sub">of immunosuppressie</div></div></label>
                  <label class="md3-check"><input type="checkbox" name="zwanger" /><div><div class="md3-check-label">Zwangerschap</div></div></label>
                  <label class="md3-check"><input type="checkbox" name="hivContact" /><div><div class="md3-check-label">HIV-positief</div><div class="md3-check-sub">of contact</div></div></label>
                  <label class="md3-check"><input type="checkbox" name="aspleen" /><div><div class="md3-check-label">(Functionele) asplenie</div></div></label>
                  <label class="md3-check"><input type="checkbox" name="hepBmoeder" /><div><div class="md3-check-label">HepB-positieve moeder</div></div></label>
                </div>
                <div class="md3-field" style="margin-top:10px">
                  <label class="md3-label">Aanvullende klinische context</label>
                  <textarea name="notes" class="md3-textarea" rows="2" placeholder="Vrije tekst — anamnese, allergieën, eerdere reacties…"></textarea>
                </div>
              </div>
            </div>

            <!-- Card 4: Schema-instellingen -->
            <div class="md3-card" style="margin-top:14px">
              <div class="md3-card-header">
                <div class="md3-card-num">4</div>
                <div class="md3-card-titles">
                  <div class="md3-card-title">Schema-instellingen</div>
                  <div class="md3-card-subtitle">RIVM: 2 prikken per consult is praktijkadvies (max 3)</div>
                </div>
              </div>
              <div class="md3-card-body">
                <div class="md3-field">
                  <label class="md3-label">Max prikken per consult</label>
                  <div class="seg-control" role="radiogroup" aria-label="Max prikken per consult">
                    <input type="radio" name="maxPerVisit" id="mpv-1" value="1" />
                    <label for="mpv-1" title="1 prik per consult — bv. bij angst of vasovagale voorgeschiedenis">1 prik</label>
                    <input type="radio" name="maxPerVisit" id="mpv-2" value="2" checked />
                    <label for="mpv-2" title="RIVM-praktijkadvies: 2 prikken per consult">2 prikken</label>
                    <input type="radio" name="maxPerVisit" id="mpv-3" value="3" />
                    <label for="mpv-3" title="Max. 3 prikken — RIVM-bovengrens, alleen bij goede tolerantie">3 prikken</label>
                  </div>
                  <div class="md3-check-sub" style="margin-top:6px">
                    Bij overflow worden vaccins doorgeschoven naar het volgende bezoek conform RIVM-leidraad inhaalvaccinaties 2024.
                  </div>
                </div>
              </div>
            </div>

            <!-- Card 5: Buitenlandse vaccinaties -->
            <div class="md3-card" style="margin-top:14px">
              <div class="md3-card-header">
                <div class="md3-card-num">5</div>
                <div class="md3-card-titles">
                  <div class="md3-card-title">Buitenlandse vaccinaties</div>
                  <div class="md3-card-subtitle">Vrije tekst — AI identificeert equivalenten en past advies aan</div>
                </div>
              </div>
              <div class="md3-card-body">
                <div class="md3-field">
                  <label class="md3-label">Vaccins ontvangen in thuisland</label>
                  <textarea name="foreignVaccines" id="foreign-vaccines" class="md3-textarea" rows="4"
                    placeholder="Bijv.: 'BCG bij geboorte; OPV op 6 wkn, 10 wkn, 14 wkn; DTwP-Hib-HepB (Pentavalent) 6/10/14 wkn; Mazelen op 9 mnd...'"></textarea>
                </div>
                <button type="button" class="md3-btn md3-btn-fill" id="ai-foreign-btn" style="margin-top:8px;width:100%">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  AI-analyse: equivalenten en aanvullend advies
                </button>
                <div class="md3-check-sub" style="margin-top:6px">
                  Vereist eigen Anthropic API-sleutel (BYOK). Sonnet 4.6 wordt gebruikt voor de redenering.
                </div>
                <div id="ai-foreign-result" style="display:none;margin-top:10px;padding:10px;background:var(--md-surface-container);border:1px solid var(--md-outline-variant);border-radius:8px;font-size:12.5px;line-height:1.5;white-space:pre-wrap;color:var(--md-on-surface)"></div>
              </div>
            </div>

            <div class="input-footer">
              <button type="submit" class="md3-btn md3-btn-fill" style="flex:1">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.37"/></svg>
                Schema genereren
              </button>
              <button type="reset" class="md3-btn md3-btn-outline">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                Wissen
              </button>
            </div>
          </form>
        </div>
      </div>

    </aside>

    <!-- RIGHT — schema -->
    <main class="schedule-column">
      <div class="schedule-empty" id="schedule-empty">
        <div class="se-icon">📋</div>
        <div>Vul de patiëntgegevens in en klik op <strong>Schema genereren</strong></div>
        <div style="font-size:11px;color:var(--md-on-surface-muted);margin-top:4px">Het inhaalschema verschijnt hier</div>
      </div>
      <div id="schedule-ready" style="display:none; flex:1; flex-direction:column; overflow:hidden">
        <!-- KPI strip -->
        <div class="kpi-strip">
          <div class="kpi-cell"><div class="kpi-label">Consulten gepland</div><div class="kpi-value" id="kpi-visits">—</div><div class="kpi-sub" id="kpi-visits-sub">—</div></div>
          <div class="kpi-cell"><div class="kpi-label">Vaccins totaal</div><div class="kpi-value" id="kpi-doses">—</div><div class="kpi-sub" id="kpi-doses-sub">—</div></div>
          <div class="kpi-cell"><div class="kpi-label">Eerste consult</div><div class="kpi-value" id="kpi-start">—</div><div class="kpi-sub" id="kpi-start-sub">vandaag</div></div>
          <div class="kpi-cell"><div class="kpi-label">Schema afgerond</div><div class="kpi-value" id="kpi-end">—</div><div class="kpi-sub" id="kpi-end-sub">—</div></div>
        </div>
        <!-- Schedule area -->
        <div class="schedule-area">
          <div id="schedule-warnings" class="schedule-warnings" style="display:none"></div>
          <div class="schedule-head-bar">
            <div>
              <h2>Inhaalschema</h2>
              <p>Klik op een rij voor uitleg &amp; advies — conform RIVM-leidraad inhaalvaccinaties 2024</p>
            </div>
          </div>
          <div class="md3-table-wrap">
            <table class="md3-table">
              <thead>
                <tr>
                  <th class="td-num">#</th>
                  <th class="td-when">Datum</th>
                  <th class="td-age">Leeftijd</th>
                  <th>Vaccin · toedieningsweg</th>
                  <th class="td-dose">Dosis</th>
                  <th class="td-status">Prioriteit</th>
                  <th class="td-chevron"></th>
                </tr>
              </thead>
              <tbody id="schedule-tbody"></tbody>
            </table>
          </div>
          <div class="md3-banner" id="interval-banner">
            <div class="md3-banner-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <b>Aandachtspunt — minimumintervallen</b>
              <p id="interval-banner-text"></p>
            </div>
          </div>
        </div>
      </div>
    </main>

  </div><!-- /content-split -->

  <footer style="background:var(--md-surface-container);border-top:1px solid var(--md-outline-variant);padding:6px 20px;font-size:11px;color:var(--md-on-surface-muted)">
    Bronnen: RIVM Leidraad inhaalvaccinaties 2024 · Rijksvaccinatieprogramma · WHO TBC-risicolanden
  </footer>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js"></script>
<script src="https://npmcdn.com/flatpickr@4.6.13/dist/l10n/nl.js"></script>
<script src="{{ asset('js/data.js') }}"></script>
<script src="{{ asset('js/scheduler.js') }}"></script>
<script src="{{ asset('js/pdf.js') }}"></script>
<script src="{{ asset('js/app.js') }}"></script>
</body>
</html>
