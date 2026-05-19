# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Konto erstellen" [level=1] [ref=e5]
      - paragraph [ref=e6]: Starte mit Meridian
    - generic [ref=e7]:
      - generic [ref=e8]:
        - text: Workspace-Name
        - textbox "Workspace-Name" [ref=e9]:
          - /placeholder: z.B. Mahr GmbH
          - text: QA Workspace 1779209149329
      - generic [ref=e10]:
        - text: E-Mail
        - textbox "E-Mail" [ref=e11]:
          - /placeholder: name@unternehmen.de
          - text: qa-1779209149329@meridian-test.dev
      - generic [ref=e12]:
        - text: Passwort
        - textbox "Passwort" [ref=e13]:
          - /placeholder: Mindestens 8 Zeichen
          - text: QaTestPass123!
      - button "Registrieren" [ref=e14] [cursor=pointer]
    - paragraph [ref=e15]:
      - text: Bereits registriert?
      - link "Anmelden" [ref=e16] [cursor=pointer]:
        - /url: /login
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e22] [cursor=pointer]:
    - img [ref=e23]
  - alert [ref=e26]
```