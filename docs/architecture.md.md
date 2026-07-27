# HireFlow AI – Software Architecture v1.0

**Status:** Definitief uitgangspunt  
**Product:** HireFlow AI Recruitment Operating System  
**Eigenaar:** HireFlow Group  
**Versie:** 1.0  
**Doel:** Een veilige, schaalbare en AI-first recruitmentapplicatie bouwen waarin AI niet alleen adviseert, maar gecontroleerde acties uitvoert binnen het CRM.

---

## 1. Productvisie

HireFlow AI is geen traditioneel CRM met een losse chatbot. De AI vormt de centrale werkomgeving en gebruikt CRM-modules als gereedschap.

De gebruiker moet opdrachten kunnen geven zoals:

- “Maak een bedrijf aan voor Broekman Logistics.”
- “Welke leads moet ik vandaag opvolgen?”
- “Schrijf een acquisitiemail voor dit bedrijf.”
- “Maak een taak aan voor morgen om 09.00 uur.”
- “Analyseer deze vacature en maak een zoekprofiel.”
- “Welke kandidaten passen het best bij deze vacature?”

De AI mag alleen vooraf goedgekeurde tools gebruiken. De AI krijgt nooit directe toegang tot SQL of onbeperkte databasebewerkingen.

---

## 2. Kernprincipes

1. **AI-first**  
   De AI-assistent is een centrale productfunctie en geen extra pagina zonder koppeling met het CRM.

2. **Veilig handelen**  
   De AI voert alleen acties uit via vooraf gedefinieerde tools met validatie en gebruikerscontrole.

3. **Multi-tenant vanaf de basis**  
   Elke gebruiker of organisatie ziet uitsluitend eigen gegevens.

4. **Eén codebase**  
   Geen losse prototypes of nieuwe ZIP-versies. Alle ontwikkeling gebeurt in dezelfde GitHub-repository.

5. **Iteratief opleveren**  
   Elke sprint eindigt met een werkende, geteste en gecommitte versie.

6. **Menselijke goedkeuring bij risicovolle acties**  
   E-mails verzenden, records verwijderen en grote bulkacties vereisen bevestiging.

7. **Privacy by design**  
   Persoonsgegevens, cv’s, notities en communicatie worden minimaal en doelgericht verwerkt.

---

## 3. Technische stack

### Frontend
- Next.js met App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- TanStack Query

### Backend
- Next.js Route Handlers
- Server Actions waar passend
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security

### AI
- OpenAI SDK via server-side API-routes
- Tool calling
- Streaming antwoorden
- Gespreksgeschiedenis in Supabase
- Modelconfiguratie via één centrale AI-providerlaag

### Hosting en ontwikkeling
- GitHub
- Vercel
- Cursor
- ESLint
- Prettier

---

## 4. Hoofdarchitectuur

```text
Gebruiker
   |
   v
HireFlow AI-interface
   |
   v
AI API-route / AI Runtime
   |
   +--> Systeeminstructies
   +--> Gebruikerscontext
   +--> Gespreksgeschiedenis
   +--> Tool Registry
              |
              +--> Companies tools
              +--> Contacts tools
              +--> Tasks tools
              +--> Vacancies tools
              +--> Candidates tools
              +--> Email tools
              +--> Research tools
   |
   v
Service Layer
   |
   v
Supabase + externe diensten
```

---

## 5. Aanbevolen mappenstructuur

```text
src/
  app/
    (auth)/
      login/
    (dashboard)/
      dashboard/
      companies/
      contacts/
      candidates/
      vacancies/
      pipeline/
      tasks/
      ai-assistant/
    api/
      ai/
        chat/
      tools/
    layout.tsx

  components/
    ai/
      ai-chat.tsx
      ai-message.tsx
      ai-composer.tsx
      ai-tool-result.tsx
      ai-confirmation.tsx
    dashboard/
    companies/
    contacts/
    candidates/
    vacancies/
    pipeline/
    tasks/
    shared/
    ui/

  features/
    companies/
      schemas.ts
      queries.ts
      mutations.ts
      service.ts
      types.ts
    contacts/
    candidates/
    vacancies/
    tasks/
    pipeline/

  lib/
    ai/
      client.ts
      runtime.ts
      prompts.ts
      provider.ts
      tool-registry.ts
      types.ts
    supabase/
      client.ts
      server.ts
      middleware.ts
    auth/
    validation/
    utils/

  tools/
    companies/
      create-company.ts
      search-companies.ts
      update-company.ts
    tasks/
      create-task.ts
      search-tasks.ts
    vacancies/
    candidates/
    contacts/

  config/
    navigation.ts
    site.ts
    ai.ts

  types/
    database.ts
    ai.ts

supabase/
  migrations/
  seed.sql

docs/
  architecture.md
  database.md
  ai-tools.md
  security.md
```

---

## 6. AI Runtime

De AI Runtime is de centrale laag tussen de chatinterface en de tools.

### Verantwoordelijkheden
- authenticatie van de gebruiker controleren;
- juiste organisatie- of gebruikerscontext ophalen;
- relevante gespreksgeschiedenis laden;
- veilige systeeminstructies toevoegen;
- beschikbare tools registreren;
- toolaanroepen valideren;
- resultaten teruggeven aan het model;
- gebeurtenissen loggen;
- streaming antwoorden naar de interface sturen.

### Verboden
- directe SQL vanuit modeloutput;
- service-role keys in browsercode;
- ongevalideerde toolargumenten;
- automatische verzending van e-mails zonder bevestiging;
- verwijderen van gegevens zonder expliciete bevestiging.

---

## 7. Tool Registry

Iedere AI-actie krijgt een afzonderlijke tool met:

- unieke naam;
- duidelijke omschrijving;
- Zod-schema;
- autorisatiecontrole;
- servicefunctie;
- auditlog;
- gestandaardiseerd resultaat.

### Eerste tools

#### Companies
- `create_company`
- `search_companies`
- `get_company`
- `update_company`

#### Tasks
- `create_task`
- `search_tasks`
- `complete_task`

#### Contacts
- `create_contact`
- `search_contacts`

#### Vacancies
- `create_vacancy`
- `analyze_vacancy`
- `search_vacancies`

#### Candidates
- `create_candidate`
- `search_candidates`
- `match_candidates_to_vacancy`

#### Communication
- `draft_acquisition_email`
- `draft_follow_up_email`

### Later
- `send_email`
- `research_companies`
- `import_companies`
- `parse_cv`
- `schedule_meeting`

---

## 8. Toolcontract

Iedere tool retourneert hetzelfde basisformaat:

```ts
type ToolResult<T> = {
  success: boolean;
  message: string;
  data?: T;
  requiresConfirmation?: boolean;
  confirmationId?: string;
  errorCode?: string;
};
```

Voorbeeld:

```ts
{
  success: true,
  message: "Bedrijf is aangemaakt.",
  data: {
    id: "uuid",
    name: "Broekman Logistics"
  }
}
```

---

## 9. AI-bevestigingsmodel

### Geen bevestiging nodig
- records zoeken;
- dashboardinformatie ophalen;
- notities samenvatten;
- e-mailconcept schrijven;
- vacature analyseren.

### Altijd bevestigen
- e-mail daadwerkelijk verzenden;
- records verwijderen;
- bulkimport uitvoeren;
- meerdere records tegelijk wijzigen;
- externe agenda-afspraak maken;
- kandidaat- of klantgegevens extern delen.

De interface toont vóór uitvoering:

```text
De AI wil 25 bedrijven aanmaken.
[Annuleren] [Bevestigen]
```

---

## 10. Datamodel

### profiles
- id
- full_name
- email
- organization_id
- created_at

### organizations
- id
- name
- created_at

### companies
- id
- organization_id
- owner_id
- name
- website
- sector
- city
- employee_count
- priority
- status
- notes
- created_at
- updated_at

### contacts
- id
- organization_id
- company_id
- first_name
- last_name
- job_title
- email
- phone
- linkedin_url
- is_decision_maker
- notes
- created_at

### candidates
- id
- organization_id
- owner_id
- first_name
- last_name
- email
- phone
- location
- availability
- salary_expectation
- skills
- summary
- cv_path
- status
- created_at

### vacancies
- id
- organization_id
- company_id
- owner_id
- title
- description
- location
- employment_type
- salary_min
- salary_max
- status
- requirements
- created_at

### tasks
- id
- organization_id
- owner_id
- title
- description
- due_at
- priority
- status
- related_entity_type
- related_entity_id
- created_at

### pipeline_items
- id
- organization_id
- company_id
- candidate_id
- vacancy_id
- stage
- value
- next_action_at
- created_at

### ai_conversations
- id
- organization_id
- user_id
- title
- created_at
- updated_at

### ai_messages
- id
- conversation_id
- role
- content
- tool_name
- tool_call_id
- metadata
- created_at

### ai_tool_logs
- id
- organization_id
- user_id
- conversation_id
- tool_name
- arguments
- result
- status
- created_at

---

## 11. Row Level Security

Iedere zakelijke tabel bevat minimaal:

- `organization_id`
- waar nodig `owner_id`

RLS-regels controleren dat de ingelogde gebruiker lid is van de juiste organisatie.

Basisregel:

```sql
organization_id in (
  select organization_id
  from profiles
  where id = auth.uid()
)
```

De service-role key wordt uitsluitend server-side gebruikt en alleen wanneer dit strikt noodzakelijk is.

---

## 12. AI-systeeminstructies

De centrale systeeminstructie bevat minimaal:

- rol: HireFlow recruitmentassistent;
- taal: Nederlands, tenzij gebruiker anders vraagt;
- context: eigen CRM en recruitmentprocessen;
- verplicht gebruik van tools voor feitelijke CRM-acties;
- nooit beweren dat een actie is uitgevoerd zonder succesvol toolresultaat;
- bevestiging vragen voor risicovolle acties;
- geen gevoelige gegevens verzinnen;
- fouten duidelijk melden;
- voorstellen compact en uitvoerbaar houden.

---

## 13. API-structuur

### AI-chat
`POST /api/ai/chat`

Verantwoordelijk voor:
- sessie controleren;
- input valideren;
- gesprek ophalen of aanmaken;
- AI Runtime starten;
- stream teruggeven;
- berichten opslaan.

### Bevestigingen
`POST /api/ai/confirm`

Verantwoordelijk voor:
- confirmationId valideren;
- gebruiker en organisatie controleren;
- goedgekeurde actie uitvoeren;
- resultaat loggen.

### Uploads
`POST /api/uploads/cv`

Verantwoordelijk voor:
- bestandstype en grootte controleren;
- opslaan in Supabase Storage;
- metadata registreren;
- later cv-parser starten.

---

## 14. Eerste AI-workflows

### Workflow 1: bedrijf aanmaken
1. Gebruiker geeft bedrijfsgegevens.
2. AI controleert ontbrekende informatie.
3. AI roept `create_company` aan.
4. Tool valideert invoer.
5. Bedrijf wordt opgeslagen.
6. AI meldt alleen succes bij succesvol databaseantwoord.

### Workflow 2: acquisitiemail
1. Gebruiker selecteert of noemt een bedrijf.
2. AI haalt bedrijfscontext op.
3. AI schrijft een concept.
4. Gebruiker kan het concept aanpassen.
5. Verzenden wordt pas later als bevestigde tool toegevoegd.

### Workflow 3: dagplanning
1. AI zoekt achterstallige en geplande taken.
2. AI zoekt leads met follow-updatum vandaag.
3. AI rangschikt op prioriteit.
4. AI geeft een kort dagplan.

### Workflow 4: kandidaatmatch
1. AI haalt vacature-eisen op.
2. AI zoekt kandidaten.
3. Een transparante matchscore wordt berekend.
4. AI toont sterke punten, risico’s en ontbrekende informatie.
5. De gebruiker bepaalt de shortlist.

---

## 15. Audit en logging

Iedere toolaanroep wordt gelogd met:

- gebruiker;
- organisatie;
- toolnaam;
- argumenten;
- resultaat;
- status;
- datum en tijd;
- conversation_id.

Gevoelige waarden zoals API-keys en wachtwoorden mogen nooit in logs terechtkomen.

---

## 16. Omgevingsvariabelen

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=
OPENAI_MODEL=

NEXT_PUBLIC_APP_URL=
```

Regels:
- `.env.local` staat in `.gitignore`;
- `.env.example` bevat uitsluitend lege waarden of placeholders;
- secrets worden ook in Vercel Environment Variables ingesteld;
- geen enkele geheime sleutel begint met `NEXT_PUBLIC_`.

---

## 17. Ontwikkelregels

1. TypeScript strict mode.
2. Geen `any`, behalve gemotiveerde uitzonderingen.
3. Alle input via Zod valideren.
4. Databasecode alleen via services.
5. AI-tools gebruiken dezelfde services als de gewone UI.
6. Geen bedrijfslogica in React-componenten.
7. Geen geheime sleutels in clientcomponenten.
8. Iedere mutatie heeft foutafhandeling.
9. Iedere sprint bevat minimaal één handmatige end-to-endtest.
10. Na een werkende sprint: commit en push naar GitHub.

---

## 18. Sprintvolgorde

### Sprint AI-01 — Werkende chat
- server-side OpenAI-koppeling;
- streaming chat;
- veilige API-route;
- AI Assistant-interface;
- foutafhandeling;
- geen tools.

### Sprint AI-02 — Eerste tools
- `create_company`;
- `search_companies`;
- `create_task`;
- toolresultaten zichtbaar in chat;
- auditlogging.

### Sprint AI-03 — Geheugen
- gesprekken opslaan;
- gespreksoverzicht;
- gesprek hervatten;
- gebruiker- en organisatiecontext.

### Sprint AI-04 — Recruitment intelligence
- vacatureanalyse;
- cv-upload;
- kandidaatprofiel;
- matchscore;
- interviewvragen.

### Sprint AI-05 — Sales intelligence
- acquisitiemail;
- follow-upvoorstellen;
- leadprioritering;
- dagelijkse salesplanning.

### Sprint AI-06 — Externe acties
- e-mailintegratie;
- kalenderintegratie;
- bevestigingsschermen;
- statusregistratie.

### Sprint AI-07 — Workflows
- “Vind nieuwe klanten”;
- “Bereid kandidaatintroductie voor”;
- “Plan mijn werkdag”;
- workflowstatus en hervatten.

---

## 19. Definition of Done

Een feature is pas afgerond wanneer:

- de code compileert;
- linting slaagt;
- de relevante database-migratie aanwezig is;
- RLS is gecontroleerd;
- foutmeldingen bruikbaar zijn;
- secrets niet in Git staan;
- de primaire flow handmatig is getest;
- wijzigingen zijn gecommit en gepusht;
- documentatie is bijgewerkt.

---

## 20. Eerstvolgende concrete opdracht

De eerstvolgende ontwikkelingstaak is **Sprint AI-01**:

> Bouw een werkende, server-side AI-chat op de bestaande AI Assistant-pagina. Gebruik streaming, houd de API-key volledig server-side en voeg nog geen CRM-tools toe. Zorg eerst dat de chat stabiel werkt, foutmeldingen toont en klaar is om later tool calling toe te voegen.

Na succesvolle test wordt deze versie gecommit als:

```text
feat: add secure streaming AI assistant
```
