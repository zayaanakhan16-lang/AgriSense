import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { NoFieldSelected } from '@/components/common/FieldContextBar';
import { InlineNotice, SourceNote } from '@/components/common/StateBlocks';
import { PageScaffold, SectionCard, SkeletonPanel } from '@/components/layout/PageScaffold';
import { buildFieldReport, reportFileName } from '@/services/report/pdfReport';
import { buildFieldSnapshot, drawSnapshotOverlay } from '@/services/report/fieldSnapshot';
import { formatArea, formatDateTime } from '@/lib/format';
import { useFieldIntelligence } from '@/hooks/useFieldIntelligence';
import { cn } from '@/lib/utils';

type ExportState = 'idle' | 'building' | 'ready' | 'error';

export default function ReportsPage(): JSX.Element {
  const { field, intelligence, running, error: analysisError, analysedAt, run } = useFieldIntelligence();
  const { vegetation, soil, climate, evaluation, planning } = intelligence;

  const [includeSnapshot, setIncludeSnapshot] = useState(true);
  const [includeZones, setIncludeZones] = useState(true);
  const [includeNdvi, setIncludeNdvi] = useState(true);
  const [state, setState] = useState<ExportState>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  if (!field) {
    return (
      <PageScaffold
        title="Reports"
        description="Generate a field-ready PDF containing the boundary, vegetation, soil, climate, suitability and crop plan."
      >
        <NoFieldSelected />
      </PageScaffold>
    );
  }

  const contents = [
    { label: 'Branding and cover', available: true, detail: 'AgriSense identity, field name and generation timestamp.' },
    { label: 'Field identity and area', available: true, detail: `${formatArea(field.boundary.areaM2)} · ${field.boundary.vertexCount} vertices` },
    { label: 'Map and boundary', available: Boolean(includeSnapshot), detail: includeSnapshot ? 'Real Sentinel-2 tiles with the boundary traced on top.' : 'Disabled in the options above.' },
    { label: 'Vegetation health', available: Boolean(vegetation), detail: vegetation ? `Mean NDVI ${vegetation.stats.mean.toFixed(3)} · ${vegetation.item.platform}` : 'Not available for this field.' },
    { label: 'Soil properties', available: Boolean(soil), detail: soil ? `${soil.properties.length} SoilGrids properties` : 'Not available for this field.' },
    { label: 'Climate overview', available: Boolean(climate), detail: climate ? `${climate.days.length} days of record` : 'Not available for this field.' },
    { label: 'Land suitability', available: Boolean(evaluation), detail: evaluation ? `${evaluation.datasetSize} profiles scored` : 'Not available for this field.' },
    { label: 'Crop zones and rotation', available: Boolean(planning), detail: planning ? `${planning.zones.length} zones · ${planning.rotation.length} rotation slots` : 'Not available for this field.' },
    { label: 'Risk warnings', available: true, detail: 'Derived from the signals that were actually retrieved.' },
    { label: 'Data sources and timestamps', available: true, detail: 'Provider, licence and retrieval time for every dataset.' },
  ];

  const handleExport = async (): Promise<void> => {
    setState('building');
    setStatusMessage('Composing satellite snapshot from real tiles…');

    try {
      let snapshotDataUrl: string | null = null;
      if (includeSnapshot) {
        const snapshot = await buildFieldSnapshot(field.boundary.bbox, { width: 1200 });
        if (snapshot) {
          setStatusMessage('Tracing the field boundary onto the imagery…');
          const composed = await drawSnapshotOverlay(snapshot, {
            field,
            zones: planning?.zones ?? [],
            showZones: includeZones,
          });
          snapshotDataUrl = composed.dataUrl;
        } else {
          setStatusMessage('Satellite tiles could not be composed — continuing without the map image.');
        }
      }

      let ndviImage: string | null = null;
      if (includeNdvi && vegetation) {
        setStatusMessage('Rendering the NDVI raster…');
        ndviImage = renderNdviDataUrl(vegetation.grid, 640);
      }

      setStatusMessage('Assembling the PDF document…');
      const doc = buildFieldReport({
        field,
        vegetation,
        soil,
        climate,
        evaluation,
        planning,
        snapshotDataUrl,
        ndviImageDataUrl: ndviImage,
      });

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
      doc.save(reportFileName(field));
      setLastExport(new Date().toISOString());
      setState('ready');
      setStatusMessage('Report generated and downloaded.');
    } catch (exportError) {
      setState('error');
      setStatusMessage(
        exportError instanceof Error
          ? `The report could not be generated: ${exportError.message}`
          : 'The report could not be generated.',
      );
    }
  };

  const availableCount = contents.filter((entry) => entry.available).length;

  return (
    <PageScaffold
      title="Reports"
      description="A printable, field-ready PDF. Sections are included only when the underlying data was actually retrieved."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={run} disabled={running}>
            {running ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Refresh data
          </Button>
          <Button variant="lime" size="sm" onClick={handleExport} disabled={state === 'building'}>
            {state === 'building' ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {state === 'building' ? 'Generating…' : 'Generate PDF'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <SectionCard
              title={field.name}
              description={`${field.locationLabel} · analysed ${analysedAt ? formatDateTime(analysedAt) : 'not yet'}`}
              actions={<Badge variant="outline">{formatArea(field.boundary.areaM2)}</Badge>}
            >
              <div className="grid gap-2.5 sm:grid-cols-2">
                {contents.map((entry) => (
                  <div
                    key={entry.label}
                    className={cn(
                      'flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
                      entry.available ? 'border-border/60 bg-muted/15' : 'border-amber-500/25 bg-amber-500/[0.05]',
                    )}
                  >
                    {entry.available ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-lime" />
                    ) : (
                      <FileText className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                    )}
                    <div className="min-w-0">
                      <p className="text-2xs font-semibold">{entry.label}</p>
                      <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{entry.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-3.5" />
              <p className="text-2xs leading-relaxed text-muted-foreground">
                {availableCount} of {contents.length} sections have data. Unavailable sections are written into the report
                as explicit statements rather than omitted, so the reader always knows what was and was not assessed.
              </p>
            </SectionCard>

            {running ? (
              <SectionCard title="Preparing report data">
                <SkeletonPanel rows={4} />
              </SectionCard>
            ) : null}

            {analysisError ? (
              <InlineNotice tone="warning">
                The last analysis run reported: {analysisError} The report will still generate with whatever data is
                available.
              </InlineNotice>
            ) : null}

            <SectionCard title="Report preview" description="The generated document opens in your browser and downloads automatically.">
              {previewUrl ? (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                    <iframe
                      src={`${previewUrl}#toolbar=0&navpanes=0`}
                      title="AgriSense report preview"
                      className="h-[460px] w-full"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={previewUrl} target="_blank" rel="noreferrer noopener">
                        <Printer className="size-3.5" />
                        Open in new tab
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={previewUrl} download={reportFileName(field)}>
                        <Download className="size-3.5" />
                        Download again
                      </a>
                    </Button>
                    {lastExport ? (
                      <span className="text-2xs text-muted-foreground">Generated {formatDateTime(lastExport)}</span>
                    ) : null}
                  </div>
                  <p className="text-2xs leading-relaxed text-muted-foreground">
                    The document is produced locally in your browser. Nothing is uploaded, and the generated file is
                    available offline once downloaded.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 px-6 py-12 text-center">
                  <FileText className="mb-3 size-6 text-muted-foreground" />
                  <p className="text-xs font-medium">No report generated yet</p>
                  <p className="mt-1 max-w-sm text-2xs leading-relaxed text-muted-foreground">
                    Choose the options on the right, then generate. The PDF is assembled entirely in the browser — the map
                    image uses the same real Sentinel-2 tiles as the Earth view.
                  </p>
                  <Button variant="lime" size="sm" className="mt-4" onClick={handleExport}>
                    <Download className="size-3.5" />
                    Generate PDF
                  </Button>
                </div>
              )}

              {statusMessage ? (
                <InlineNotice tone={state === 'error' ? 'danger' : 'info'} className="mt-3">
                  <span className="flex items-center gap-2">
                    {state === 'building' ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    {statusMessage}
                  </span>
                </InlineNotice>
              ) : null}
            </SectionCard>
          </div>

          <div className="space-y-4">
            <SectionCard title="Export options" description="Control what is embedded in the document.">
              <ul className="space-y-3.5">
                <li className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-medium">
                      <ImageIcon className="size-3.5 text-lime" />
                      Satellite snapshot
                    </p>
                    <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                      Compose real Sentinel-2 tiles around the boundary into the report. Falls back gracefully if tiles
                      cannot be read.
                    </p>
                  </div>
                  <Switch checked={includeSnapshot} onCheckedChange={setIncludeSnapshot} aria-label="Include satellite snapshot" />
                </li>
                <li className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-medium">
                      <Layers className="size-3.5 text-lime" />
                      Crop zones on the map
                    </p>
                    <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                      Overlay the colour-coded crop allocation on the snapshot. Requires the satellite snapshot.
                    </p>
                  </div>
                  <Switch
                    checked={includeZones}
                    onCheckedChange={setIncludeZones}
                    disabled={!includeSnapshot}
                    aria-label="Include crop zones"
                  />
                </li>
                <li className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-medium">
                      <ShieldCheck className="size-3.5 text-lime" />
                      NDVI raster image
                    </p>
                    <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                      Render the sampled vegetation index grid as an image in the vegetation section.
                    </p>
                  </div>
                  <Switch
                    checked={includeNdvi}
                    onCheckedChange={setIncludeNdvi}
                    disabled={!vegetation}
                    aria-label="Include NDVI raster"
                  />
                </li>
              </ul>
            </SectionCard>

            <SectionCard title="Report metadata">
              <dl className="space-y-2.5 text-xs">
                <Row label="Format" value="A4 portrait, PDF" />
                <Row label="Pages" value="Auto-paginated with numbered footers" />
                <Row label="Generated in" value="Your browser — nothing is uploaded" />
                <Row label="Filename" value={reportFileName(field)} mono />
              </dl>
              <Separator className="my-3.5" />
              <SourceNote
                source={{
                  id: 'pdf-export',
                  label: 'Client-side PDF export',
                  provider: 'jsPDF',
                  note: 'All content is composed locally from data already loaded in the session.',
                }}
              />
            </SectionCard>

            <SectionCard title="What this report is not" description="Scope boundaries, stated plainly.">
              <ul className="space-y-2.5 text-2xs leading-relaxed text-muted-foreground">
                <li>
                  It is not a certified agronomic assessment. Every figure traces to a provider listed in the sources
                  section, and soil values are modelled at 250 m rather than sampled on your field.
                </li>
                <li>
                  Yield or revenue projections are only included when a connected rules-engine service supplies them.
                  AgriSense does not invent financial outcomes.
                </li>
                <li>
                  Crop suitability is deterministic. The AI layer, when connected, only explains the engine's approved
                  candidates.
                </li>
              </ul>
              <Separator className="my-3.5" />
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/intelligence">Review field intelligence first</Link>
              </Button>
            </SectionCard>
          </div>
        </div>
      </div>
    </PageScaffold>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-2xs uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 truncate text-right', mono ? 'font-mono text-2xs' : 'text-xs font-medium')}>{value}</dd>
    </div>
  );
}

/** Render the sampled NDVI grid to a JPEG data URL for embedding in the PDF. */
function renderNdviDataUrl(
  grid: { width: number; height: number; values: Array<number | null> },
  targetWidth: number,
): string | null {
  const cell = Math.max(2, Math.floor(targetWidth / grid.width));
  const canvas = document.createElement('canvas');
  canvas.width = grid.width * cell;
  canvas.height = grid.height * cell;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.fillStyle = '#8C9793';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const anchors: Array<[number, [number, number, number]]> = [
    [-0.2, [136, 66, 52]],
    [0.1, [200, 72, 60]],
    [0.2, [227, 154, 52]],
    [0.35, [201, 214, 63]],
    [0.5, [79, 168, 74]],
    [0.65, [31, 122, 77]],
    [0.9, [16, 92, 62]],
  ];
  const ramp = (value: number): string => {
    const v = Math.max(-0.2, Math.min(0.9, value));
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const [v0, c0] = anchors[index];
      const [v1, c1] = anchors[index + 1];
      if (v >= v0 && v <= v1) {
        const t = (v - v0) / (v1 - v0 || 1);
        return `rgb(${Math.round(c0[0] + (c1[0] - c0[0]) * t)},${Math.round(c0[1] + (c1[1] - c0[1]) * t)},${Math.round(c0[2] + (c1[2] - c0[2]) * t)})`;
      }
    }
    return 'rgb(16,92,62)';
  };

  for (let row = 0; row < grid.height; row += 1) {
    for (let col = 0; col < grid.width; col += 1) {
      const value = grid.values[row * grid.width + col];
      if (value === null || value === undefined) continue;
      context.fillStyle = ramp(value);
      context.fillRect(col * cell, row * cell, cell, cell);
    }
  }

  try {
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return null;
  }
}
