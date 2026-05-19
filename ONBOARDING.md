# Onboarding — meridian-app

Schritt-für-Schritt-Setup für neue Co-Founder oder Contributors. Geschätzter Aufwand: 60-90 Minuten.

## Voraussetzungen
- Windows 11 oder macOS oder Linux
- GitHub-Account mit Org-Member-Status bei `Roly-Bach`
- Eigene API-Keys (werden im Verlauf eingerichtet)

## 1. Software installieren

### Windows (winget)
```powershell
winget install OpenJS.NodeJS
winget install Git.Git
winget install GitHub.cli
winget install Python.Python.3.12
winget install Microsoft.VisualStudioCode
```

### macOS (brew)
```bash
brew install node git gh python@3.12
brew install --cask visual-studio-code
```

### Tooling-spezifisch
```powershell
# pipx via Python
python -m pip install --user pipx
python -m pipx ensurepath

# Aider mit Python 3.12 (Pfad nach OS anpassen)
# Windows:
python -m pipx install aider-chat --python "C:\Users\<USER>\AppData\Local\Programs\Python\Python312\python.exe"
# macOS/Linux:
python -m pipx install aider-chat --python python3.12
```

### VS Code Extensions
- **Claude Code** (Anthropic)
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- GitLens
- Error Lens
- GitHub Pull Requests

## 2. Accounts und Zugriff

### GitHub
1. GitHub-Account haben (oder erstellen)
2. Auf E-Mail-Einladung von `Roly-Bach`-Org klicken (kommt von Lias)
3. `gh auth login` — wähle GitHub.com, HTTPS, Browser-Flow

### Vercel
1. Mit GitHub-Account einloggen auf [vercel.com](https://vercel.com)
2. Auf Team-Einladung warten (Lias schickt)

### Supabase
1. Mit GitHub-Account einloggen auf [supabase.com](https://supabase.com)
2. Auf Organization-Member-Einladung warten (Lias schickt)

### Google AI Studio (eigener API-Key)
1. Login mit Google-Account auf [aistudio.google.com](https://aistudio.google.com/app/apikey)
2. "Create API key" → "Create API key in new project"
3. Key kopieren, lokal in User-Environment setzen:

```powershell
# Windows
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "<dein-key>", "User")
```

```bash
# macOS/Linux: in ~/.zshrc oder ~/.bashrc
export GEMINI_API_KEY="<dein-key>"
```

Schreib den Key nie in Code-Files. Niemals committen.

### Anthropic Claude (für Claude Code)
1. Subscription bei [claude.ai](https://claude.ai) (Pro empfohlen für unlimited Claude Code)
2. In VS Code: Claude Code Extension öffnen, Login folgen

## 3. Repo klonen und Setup

```powershell
# In den Code-Ordner wechseln (Pfad anpassen)
cd C:\Users\<USER>\Code

# Clone
gh repo clone Roly-Bach/meridian-app

# Hineingehen
cd meridian-app

# Dependencies
npm install

# Playwright Browser für E2E-Tests (~300 MB, einmalig)
npx playwright install chromium

# Env-Datei aus Beispiel anlegen
Copy-Item .env.local.example .env.local
```

Dann `.env.local` öffnen und Supabase-Werte einsetzen:
- `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` bekommst du von Lias oder aus dem Supabase Dashboard (Settings → API), sobald du Org-Member bist.

## 4. Funktionsprüfung

```powershell
# Build muss durchlaufen
npm run build

# Typecheck muss sauber sein
npm run typecheck

# Lint muss durchlaufen
npm run lint

# Dev-Server starten
npm run dev
# Öffne http://localhost:3000
```

## 5. Claude Code starten und Agent-Pipeline kennenlernen

In VS Code: Claude Code Extension öffnen, im Repo `meridian-app` arbeiten.

Verfügbare Slash-Commands:
- `/build <feature>` — volle 5-Rollen-Pipeline für mittlere Features
- `/quick <task>` — schlanke Coder+Reviewer-Pipeline für kleine Aufgaben
- `/cleanup` — Janitor räumt veraltete Memories und Docs auf
- `/adr <titel>` — neue Architecture Decision Record anlegen
- `/research <topic>` — Web-Recherche via Scout

Die Subagents sind unter `.claude/agents/` definiert. Architect, Scout, Coder, Reviewer (Cross-Vendor via Gemini), Verifier, Janitor.

## 6. Erste produktive Aktion

Lies bitte:
1. [CONTRIBUTING.md](./CONTRIBUTING.md) — GitHub-Workflow und Regeln
2. [docs/adr/ADR-001-fork-audit.md](./docs/adr/ADR-001-fork-audit.md) — Hybrid-Setup-Begründung
3. [docs/adr/ADR-002-hybrid-backend-eu.md](./docs/adr/ADR-002-hybrid-backend-eu.md) — Backend-Architektur

Erste eigene Aktion: Erstelle einen Feature-Branch und mache eine kleine, harmlose Änderung (z.B. einen Tippfehler in README.md fixen), pushe via Pull Request. Damit testen wir den Workflow.

```powershell
git checkout -b feature/onboarding-test
# kleine Änderung machen, dann:
git add .
git commit -m "test: onboarding workflow check"
git push -u origin feature/onboarding-test
gh pr create
```

## Troubleshooting

### `aider` nach Installation nicht gefunden
PATH-Update wirkt nur in neuen Shells. Schließe das aktuelle Terminal und öffne ein neues, oder nutze den absoluten Pfad: `C:\Users\<USER>\.local\bin\aider.exe`.

### Aider Rate-Limit-Errors bei Gemini Pro
Gemini Pro-Modelle (`gemini-2.5-pro`, `gemini-3.1-pro-preview`) sind nicht im Free-Tier. Standard ist `gemini-2.5-flash` für Reviewer. Für Pro-Tier: Billing in Google AI Studio aktivieren.

### Supabase Connection-Fehler
Prüfe `.env.local` Werte. Test via:
```powershell
curl -H "apikey: $key" "$url/rest/v1/unternehmen?select=id&limit=1"
# Erwartung: HTTP 200, Body []
```

### Claude Code findet Subagents nicht
Working Directory muss `meridian-app/` sein, nicht ein Parent-Verzeichnis. Prüfe via `pwd` in Claude Code Terminal.

## Support

Bei Problemen: Issue im Repo öffnen oder Lias direkt fragen.
