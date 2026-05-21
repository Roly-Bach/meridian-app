import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportProcessStep {
  id: string
  title: string
  description: string | null
  role: string | null
  frequency_per_month: number | null
  duration_minutes: number | null
  data_sources: string[]
  rule_based: boolean
}

export interface ReportKnowledgeObject {
  id: string
  type: 'pain_point' | 'tool'
  content: Record<string, unknown>
}

export interface ReportUseCase {
  id: string
  type: string
  title: string
  description: string | null
  priority: 'high' | 'medium' | 'low' | null
  roi_eur_per_year: number | null
  score: number | null
}

export interface ReportData {
  interview: {
    employee_name: string
    employee_role: string | null
    department: string
    created_at: string
  }
  executiveSummary: string
  processSteps: ReportProcessStep[]
  painPoints: ReportKnowledgeObject[]
  tools: ReportKnowledgeObject[]
  useCases: ReportUseCase[]
  generatedAt: string
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PINK = '#E040FB'
const TEXT_PRIMARY = '#111111'
const TEXT_MUTED = '#6B7280'
const BORDER = '#E5E5E5'
const BG_LIGHT = '#FAFAFA'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: TEXT_PRIMARY,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 48,
    backgroundColor: '#FFFFFF',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: PINK,
  },
  headerLeft: {
    flexDirection: 'column',
    gap: 2,
  },
  logo: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: PINK,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 9,
    color: TEXT_MUTED,
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
  },
  headerName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_PRIMARY,
  },
  headerMeta: {
    fontSize: 9,
    color: TEXT_MUTED,
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: PINK,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Executive Summary
  summaryBox: {
    backgroundColor: BG_LIGHT,
    borderLeftWidth: 3,
    borderLeftColor: PINK,
    padding: 12,
    borderRadius: 4,
  },
  summaryText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: TEXT_PRIMARY,
  },

  // Table
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowLast: {
    flexDirection: 'row',
  },
  tableCell: {
    padding: '6 8',
    fontSize: 9,
    color: TEXT_PRIMARY,
    flex: 1,
  },
  tableCellHeader: {
    padding: '6 8',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_MUTED,
    flex: 1,
  },
  tableCellNarrow: {
    flex: 0.6,
  },
  tableCellWide: {
    flex: 1.8,
  },

  // List items
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 6,
  },
  listBullet: {
    width: 12,
    fontSize: 10,
    color: PINK,
    marginTop: 1,
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: TEXT_PRIMARY,
    marginBottom: 1,
  },
  listDescription: {
    fontSize: 9,
    color: TEXT_MUTED,
    lineHeight: 1.4,
  },

  // Badge
  badgeHigh: {
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
    fontSize: 8,
    padding: '2 5',
    borderRadius: 3,
  },
  badgeMedium: {
    backgroundColor: '#FEF3C7',
    color: '#D97706',
    fontSize: 8,
    padding: '2 5',
    borderRadius: 3,
  },
  badgeLow: {
    backgroundColor: '#ECFDF5',
    color: '#059669',
    fontSize: 8,
    padding: '2 5',
    borderRadius: 3,
  },

  // Empty state
  emptyText: {
    fontSize: 9,
    color: TEXT_MUTED,
    fontStyle: 'italic',
    padding: 10,
    textAlign: 'center',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: TEXT_MUTED,
  },
  footerBrand: {
    fontSize: 8,
    color: PINK,
    fontFamily: 'Helvetica-Bold',
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priorityLabel(p: string | null): string {
  if (p === 'high') return 'Hoch'
  if (p === 'medium') return 'Mittel'
  if (p === 'low') return 'Niedrig'
  return '—'
}

function priorityStyle(p: string | null) {
  if (p === 'high') return styles.badgeHigh
  if (p === 'medium') return styles.badgeMedium
  return styles.badgeLow
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function dash(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '—'
  return String(val)
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

function ProcessStepsSection({ steps }: { steps: ReportProcessStep[] }) {
  return (
    <View style={styles.section}>
      <SectionTitle>Prozessschritte</SectionTitle>
      {steps.length === 0 ? (
        <Text style={styles.emptyText}>Keine Prozessschritte gefunden.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellHeader, styles.tableCellWide]}>Schritt</Text>
            <Text style={[styles.tableCellHeader, styles.tableCellNarrow]}>Häufigkeit/Monat</Text>
            <Text style={[styles.tableCellHeader, styles.tableCellNarrow]}>Dauer (min)</Text>
            <Text style={styles.tableCellHeader}>Systeme</Text>
          </View>
          {steps.map((step, i) => (
            <View key={step.id} style={i === steps.length - 1 ? styles.tableRowLast : styles.tableRow}>
              <View style={[styles.tableCell, styles.tableCellWide]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>{step.title}</Text>
                {step.description && <Text style={{ fontSize: 8, color: TEXT_MUTED, marginTop: 1 }}>{step.description}</Text>}
              </View>
              <Text style={[styles.tableCell, styles.tableCellNarrow]}>{dash(step.frequency_per_month)}</Text>
              <Text style={[styles.tableCell, styles.tableCellNarrow]}>{dash(step.duration_minutes)}</Text>
              <Text style={styles.tableCell}>
                {step.data_sources.length > 0 ? step.data_sources.join(', ') : '—'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function PainPointsSection({ items }: { items: ReportKnowledgeObject[] }) {
  return (
    <View style={styles.section}>
      <SectionTitle>Pain Points & Engpässe</SectionTitle>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>Keine Pain Points identifiziert.</Text>
      ) : (
        items.map((item) => {
          const c = item.content as { description?: string; severity?: string }
          return (
            <View key={item.id} style={styles.listItem}>
              <Text style={styles.listBullet}>▸</Text>
              <View style={styles.listContent}>
                <Text style={styles.listDescription}>{c.description ?? '—'}</Text>
                {c.severity && (
                  <Text style={[priorityStyle(c.severity), { marginTop: 2, alignSelf: 'flex-start' }]}>
                    {c.severity === 'high' ? 'Kritisch' : c.severity === 'medium' ? 'Mittel' : 'Niedrig'}
                  </Text>
                )}
              </View>
            </View>
          )
        })
      )}
    </View>
  )
}

function ToolsSection({ items }: { items: ReportKnowledgeObject[] }) {
  return (
    <View style={styles.section}>
      <SectionTitle>Tools & Systeme</SectionTitle>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>Keine Tools identifiziert.</Text>
      ) : (
        items.map((item) => {
          const c = item.content as { name?: string; purpose?: string }
          return (
            <View key={item.id} style={styles.listItem}>
              <Text style={styles.listBullet}>▸</Text>
              <View style={styles.listContent}>
                <Text style={styles.listTitle}>{c.name ?? '—'}</Text>
                {c.purpose && <Text style={styles.listDescription}>{c.purpose}</Text>}
              </View>
            </View>
          )
        })
      )}
    </View>
  )
}

function UseCasesSection({ useCases }: { useCases: ReportUseCase[] }) {
  return (
    <View style={styles.section}>
      <SectionTitle>KI Use Cases</SectionTitle>
      {useCases.length === 0 ? (
        <Text style={styles.emptyText}>Noch keine KI Use Cases generiert.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellHeader, styles.tableCellWide]}>Use Case</Text>
            <Text style={[styles.tableCellHeader, styles.tableCellNarrow]}>Priorität</Text>
            <Text style={[styles.tableCellHeader, styles.tableCellNarrow]}>ROI / Jahr</Text>
            <Text style={[styles.tableCellHeader, styles.tableCellNarrow]}>Score</Text>
          </View>
          {useCases.map((uc, i) => (
            <View key={uc.id} style={i === useCases.length - 1 ? styles.tableRowLast : styles.tableRow}>
              <View style={[styles.tableCell, styles.tableCellWide]}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>{uc.title}</Text>
                {uc.description && <Text style={{ fontSize: 8, color: TEXT_MUTED, marginTop: 1 }}>{uc.description}</Text>}
              </View>
              <View style={[styles.tableCell, styles.tableCellNarrow]}>
                <Text style={[priorityStyle(uc.priority), { alignSelf: 'flex-start' }]}>
                  {priorityLabel(uc.priority)}
                </Text>
              </View>
              <Text style={[styles.tableCell, styles.tableCellNarrow]}>
                {uc.roi_eur_per_year != null ? `${uc.roi_eur_per_year.toLocaleString('de-DE')} €` : '—'}
              </Text>
              <Text style={[styles.tableCell, styles.tableCellNarrow]}>
                {uc.score != null ? uc.score.toFixed(1) : '—'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

// ─── Document ─────────────────────────────────────────────────────────────────

export function InterviewReport({ data }: { data: ReportData }) {
  const { interview, executiveSummary, processSteps, painPoints, tools, useCases, generatedAt } = data

  return (
    <Document
      title={`Meridian Report — ${interview.employee_name}`}
      author="Meridian"
      subject="Interview-Zusammenfassung"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logo}>Meridian</Text>
            <Text style={styles.headerSubtitle}>Interview-Zusammenfassung</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerName}>{interview.employee_name}</Text>
            {interview.employee_role && (
              <Text style={styles.headerMeta}>{interview.employee_role}</Text>
            )}
            <Text style={styles.headerMeta}>{interview.department}</Text>
            <Text style={styles.headerMeta}>Interview: {formatDate(interview.created_at)}</Text>
          </View>
        </View>

        {/* Executive Summary */}
        <View style={styles.section}>
          <SectionTitle>Zusammenfassung</SectionTitle>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>{executiveSummary}</Text>
          </View>
        </View>

        {/* Process Steps */}
        <ProcessStepsSection steps={processSteps} />

        {/* Pain Points */}
        <PainPointsSection items={painPoints} />

        {/* Tools */}
        <ToolsSection items={tools} />

        {/* Use Cases */}
        <UseCasesSection useCases={useCases} />

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Erstellt am {formatDate(generatedAt)}</Text>
          <Text style={styles.footerBrand}>Erstellt mit Meridian</Text>
        </View>
      </Page>
    </Document>
  )
}
