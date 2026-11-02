import { jsPDF } from 'jspdf';
import type {
  ClimateProfile,
  CropEvaluationResult,
  Field,
  PlanningResult,
  SoilProfile,
  VegetationResult,
} from '@/types';
import { CROP_DATASET_META } from '@/data/cropProfiles';
import { RULES_ENGINE_META, VERDICT_THRESHOLDS } from '@/services/rulesEngine';
import { DATA_SOURCES } from '@/services/sources';
import { NDVI_BANDS } from '@/services/satellite/colorRamp';
import {
  areaInAcres,
  areaInHectares,
  formatArea,
  formatCoord,
  formatDateTime,
  formatNumber,
  monthLabel,
  percent,
} from '@/lib/format';

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  forest: [0, 59, 47] as const,
  forestDeep: [0, 31, 25] as const,
  emerald: [0, 81, 61] as const,
  lime: [168, 230, 0] as const,
  limeSoft: [215, 255, 84] as const,
  ink: [12, 20, 16] as const,
  muted: [95, 115, 104] as const,
  hairline: [222, 226, 218] as const,
  cream: [247, 247, 239] as const,
  amber: [196, 122, 20] as const,
  red: [176, 58, 46] as const,
  green: [46, 139, 87] as const,
};

export interface FieldReportInput {
  field: Field;
  vegetation: VegetationResult | null;
  soil: SoilProfile | null;
  climate: ClimateProfile | null;
  evaluation: CropEvaluationResult | null;
  planning: PlanningResult | null;
  /** Optional composed satellite snapshot of the boundary. */
  snapshotDataUrl?: string | null;
  /** Additional imagery for the vegetation section. */
  ndviImageDataUrl?: string | null;
  generatedAt?: string;
}

class ReportBuilder {
  readonly doc: jsPDF;
  private cursorY = MARGIN;
  private sectionCount = 0;

  constructor() {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
    this.doc.setFont('helvetica', 'normal');
  }

  private get pageBottom(): number {
    return PAGE_HEIGHT - MARGIN - 26;
  }

  ensureSpace(height: number): void {
    if (this.cursorY + height > this.pageBottom) {
      this.doc.addPage();
      this.cursorY = MARGIN;
    }
  }

  setY(value: number): void {
    this.cursorY = value;
  }

  getY(): number {
    return this.cursorY;
  }

  advance(delta: number): void {
    this.cursorY += delta;
  }

  /** Cover block: brand bar, title and the field identity. */
  cover(field: Field, generatedAt: string): void {
    const { doc } = this;

    doc.setFillColor(...COLORS.forestDeep);
    doc.rect(0, 0, PAGE_WIDTH, 150, 'F');

    doc.setFillColor(...COLORS.lime);
    doc.rect(0, 150, PAGE_WIDTH, 3, 'F');

    // Brand mark: the same leaf-in-orbit geometry used in the application.
    const markX = MARGIN;
    const markY = 40;
    doc.setFillColor(...COLORS.emerald);
    doc.roundedRect(markX, markY, 42, 42, 10, 10, 'F');
    doc.setFillColor(...COLORS.limeSoft);
    doc.circle(markX + 21, markY + 21, 12, 'F');
    doc.setFillColor(...COLORS.emerald);
    doc.circle(markX + 21, markY + 21, 4, 'F');
    doc.setDrawColor(...COLORS.lime);
    doc.setLineWidth(0.8);
    doc.circle(markX + 21, markY + 21, 16, 'S');

    doc.setTextColor(...COLORS.cream);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(21);
    doc.text('AgriSense', markX + 56, markY + 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 200, 190);
    doc.text('EARTH INTELLIGENCE FOR AGRICULTURE', markX + 56, markY + 33);

    doc.setFontSize(8);
    doc.setTextColor(150, 175, 165);
    doc.text('FIELD INTELLIGENCE REPORT', MARGIN, 122);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.cream);
    const titleLines = doc.splitTextToSize(field.name, CONTENT_WIDTH - 150);
    doc.text(titleLines.slice(0, 1), PAGE_WIDTH - MARGIN, 112, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 175, 165);
    doc.text(`Generated ${formatDateTime(generatedAt)}`, PAGE_WIDTH - MARGIN, 126, { align: 'right' });

    this.cursorY = 178;
  }

  sectionTitle(title: string, subtitle?: string): void {
    this.sectionCount += 1;
    this.ensureSpace(52);
    const { doc } = this;

    doc.setFillColor(...COLORS.lime);
    doc.rect(MARGIN, this.cursorY - 8, 3, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...COLORS.forest);
    doc.text(title, MARGIN + 11, this.cursorY + 3);

    this.cursorY += 18;

    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.muted);
      const lines = doc.splitTextToSize(subtitle, CONTENT_WIDTH);
      doc.text(lines, MARGIN, this.cursorY);
      this.cursorY += lines.length * 10 + 3;
    }

    this.cursorY += 4;
  }

  paragraph(text: string, options: { size?: number; color?: readonly [number, number, number]; bold?: boolean } = {}): void {
    const { size = 8.5, color = COLORS.ink, bold = false } = options;
    const { doc } = this;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
    this.ensureSpace(lines.length * (size + 2.4) + 4);
    doc.text(lines, MARGIN, this.cursorY);
    this.cursorY += lines.length * (size + 2.4) + 4;
  }

  bulletList(items: string[], options: { size?: number; color?: readonly [number, number, number] } = {}): void {
    const { size = 8.5, color = COLORS.ink } = options;
    const { doc } = this;
    items.forEach((item) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(item, CONTENT_WIDTH - 14);
      this.ensureSpace(lines.length * (size + 2.4) + 3);
      doc.setFillColor(...COLORS.lime);
      doc.circle(MARGIN + 3, this.cursorY - 2.5, 1.6, 'F');
      doc.setTextColor(...color);
      doc.text(lines, MARGIN + 13, this.cursorY);
      this.cursorY += lines.length * (size + 2.4) + 3;
    });
    this.cursorY += 2;
  }

  /** Two-column key/value block with hairline separators. */
  keyValueGrid(rows: Array<[string, string]>, columns = 2): void {
    const { doc } = this;
    const columnWidth = CONTENT_WIDTH / columns;
    const rowHeight = 24;

    for (let index = 0; index < rows.length; index += columns) {
      this.ensureSpace(rowHeight);
      const slice = rows.slice(index, index + columns);
      slice.forEach(([label, value], columnIndex) => {
        const x = MARGIN + columnIndex * columnWidth;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(...COLORS.muted);
        doc.text(label.toUpperCase(), x, this.cursorY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.ink);
        const valueLines = doc.splitTextToSize(value, columnWidth - 12);
        doc.text(valueLines.slice(0, 2), x, this.cursorY + 11);
      });
      this.cursorY += rowHeight;
      doc.setDrawColor(...COLORS.hairline);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, this.cursorY - 7, PAGE_WIDTH - MARGIN, this.cursorY - 7);
    }
    this.cursorY += 6;
  }

  /** Metric tiles laid out in a row. */
  metricRow(metrics: Array<{ label: string; value: string; unit?: string }>): void {
    const { doc } = this;
    const gap = 8;
    const tileWidth = (CONTENT_WIDTH - gap * (metrics.length - 1)) / metrics.length;
    const tileHeight = 44;
    this.ensureSpace(tileHeight + 8);

    metrics.forEach((metric, index) => {
      const x = MARGIN + index * (tileWidth + gap);
      doc.setFillColor(248, 249, 244);
      doc.setDrawColor(...COLORS.hairline);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, this.cursorY, tileWidth, tileHeight, 4, 4, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4);
      doc.setTextColor(...COLORS.muted);
      doc.text(metric.label.toUpperCase(), x + 8, this.cursorY + 13);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...COLORS.forest);
      doc.text(metric.value, x + 8, this.cursorY + 30);

      if (metric.unit) {
        const valueWidth = doc.getTextWidth(metric.value);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.muted);
        doc.text(metric.unit, x + 10 + valueWidth, this.cursorY + 30);
      }
    });

    this.cursorY += tileHeight + 10;
  }

  image(dataUrl: string, options: { maxHeight?: number; caption?: string } = {}): void {
    const { maxHeight = 260, caption } = options;
    const { doc } = this;
    const properties = doc.getImageProperties(dataUrl);
    const aspect = properties.width / properties.height;
    let width = CONTENT_WIDTH;
    let height = width / aspect;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect;
    }
    this.ensureSpace(height + (caption ? 20 : 10));
    const x = MARGIN + (CONTENT_WIDTH - width) / 2;
    doc.setDrawColor(...COLORS.hairline);
    doc.setLineWidth(0.6);
    doc.roundedRect(x - 1, this.cursorY - 1, width + 2, height + 2, 3, 3, 'S');
    doc.addImage(dataUrl, 'JPEG', x, this.cursorY, width, height);
    this.cursorY += height + 6;
    if (caption) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...COLORS.muted);
      doc.text(caption, MARGIN, this.cursorY + 3);
      this.cursorY += 12;
    } else {
      this.cursorY += 4;
    }
  }

  /** Horizontal stacked bar used for vegetation band shares. */
  stackedBar(segments: Array<{ share: number; color: readonly [number, number, number] }>): void {
    const { doc } = this;
    const barHeight = 14;
    this.ensureSpace(barHeight + 8);
    let x = MARGIN;
    segments.forEach((segment) => {
      const width = Math.max(0, segment.share * CONTENT_WIDTH);
      if (width <= 0) return;
      doc.setFillColor(...segment.color);
      doc.rect(x, this.cursorY, width, barHeight, 'F');
      x += width;
    });
    doc.setDrawColor(...COLORS.hairline);
    doc.setLineWidth(0.5);
    doc.rect(MARGIN, this.cursorY, CONTENT_WIDTH, barHeight, 'S');
    this.cursorY += barHeight + 8;
  }

  /** Simple table with a header row. */
  table(headers: string[], rows: string[][], columnWidths: number[]): void {
    const { doc } = this;
    const rowHeight = 17;

    const drawHeader = (): void => {
      this.ensureSpace(rowHeight);
      doc.setFillColor(...COLORS.forest);
      doc.rect(MARGIN, this.cursorY, CONTENT_WIDTH, rowHeight, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.cream);
      let x = MARGIN + 6;
      headers.forEach((header, index) => {
        doc.text(header.toUpperCase(), x, this.cursorY + 11.5);
        x += columnWidths[index];
      });
      this.cursorY += rowHeight;
    };

    drawHeader();

    rows.forEach((row, rowIndex) => {
      if (this.cursorY + rowHeight > this.pageBottom) {
        doc.addPage();
        this.cursorY = MARGIN;
        drawHeader();
      }
      if (rowIndex % 2 === 1) {
        doc.setFillColor(249, 250, 246);
        doc.rect(MARGIN, this.cursorY, CONTENT_WIDTH, rowHeight, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(...COLORS.ink);
      let x = MARGIN + 6;
      row.forEach((cell, index) => {
        const lines = doc.splitTextToSize(cell, columnWidths[index] - 8);
        doc.text(lines.slice(0, 1), x, this.cursorY + 11.5);
        x += columnWidths[index];
      });
      doc.setDrawColor(...COLORS.hairline);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, this.cursorY + rowHeight, PAGE_WIDTH - MARGIN, this.cursorY + rowHeight);
      this.cursorY += rowHeight;
    });

    this.cursorY += 8;
  }

  note(text: string, tone: 'warning' | 'info' | 'danger' = 'info'): void {
    const { doc } = this;
    const toneColor =
      tone === 'danger' ? COLORS.red : tone === 'warning' ? COLORS.amber : COLORS.emerald;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - 20);
    const height = lines.length * 10 + 14;
    this.ensureSpace(height + 6);
    doc.setFillColor(toneColor[0], toneColor[1], toneColor[2]);
    doc.rect(MARGIN, this.cursorY, 2.5, height, 'F');
    doc.setTextColor(...COLORS.ink);
    doc.text(lines, MARGIN + 11, this.cursorY + 11);
    this.cursorY += height + 6;
  }

  /** Footer with page numbers on every page. */
  finalise(field: Field): void {
    const { doc } = this;
    const total = doc.getNumberOfPages();
    for (let page = 1; page <= total; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(...COLORS.hairline);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, PAGE_HEIGHT - MARGIN - 14, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(...COLORS.muted);
      doc.text(`AgriSense field intelligence report · ${field.name}`, MARGIN, PAGE_HEIGHT - MARGIN - 3);
      doc.text(`Page ${page} of ${total}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - 3, { align: 'right' });
    }
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/**
 * Build the complete AgriSense field report.
 * Sections are emitted only for data that was actually retrieved; missing data is
 * stated explicitly rather than omitted silently.
 */
export function buildFieldReport(input: FieldReportInput): jsPDF {
  const { field, vegetation, soil, climate, evaluation, planning } = input;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const report = new ReportBuilder();
  const { doc } = report;

  report.cover(field, generatedAt);

  /* --------------------------------------------------------------- field identity */
  report.sectionTitle('Field identity', 'Boundary geometry computed geodesically on the WGS84 ellipsoid.');
  report.keyValueGrid([
    ['Field name', field.name],
    ['Location', field.locationLabel],
    ['Centroid', formatCoord(field.boundary.centroid, 5)],
    ['Area', `${formatArea(field.boundary.areaM2)} (${areaInHectares(field.boundary.areaM2).toFixed(3)} ha · ${areaInAcres(field.boundary.areaM2).toFixed(2)} ac)`],
    ['Perimeter', `${(field.boundary.perimeterM / 1000).toFixed(3)} km`],
    ['Vertices', `${field.boundary.vertexCount} (ring closed)`],
    ['Bounding box', field.boundary.bbox.map((v) => v.toFixed(4)).join(', ')],
    ['Created', formatDateSafe(field.createdAt)],
  ]);

  if (input.snapshotDataUrl) {
    report.sectionTitle('Boundary and satellite imagery', 'Sentinel-2 cloudless true-colour mosaic with the drawn boundary and crop zones.');
    report.image(input.snapshotDataUrl, {
      maxHeight: 280,
      caption: 'Imagery: ESA Copernicus Sentinel-2 cloudless by EOX. Boundary traced by the user.',
    });
  } else {
    report.sectionTitle('Boundary and satellite imagery');
    report.note(
      'A satellite snapshot could not be composed for this report. The boundary geometry above remains authoritative; only the raster preview is missing.',
      'warning',
    );
  }

  /* ------------------------------------------------------------------ vegetation */
  report.sectionTitle('Vegetation health (NDVI)', 'Derived from Sentinel-2 L2A surface reflectance bands B04 and B08.');
  if (vegetation) {
    report.metricRow([
      { label: 'Mean NDVI', value: vegetation.stats.mean.toFixed(3) },
      { label: 'Median', value: vegetation.stats.median.toFixed(3) },
      { label: 'P10 – P90', value: `${vegetation.stats.p10.toFixed(2)} – ${vegetation.stats.p90.toFixed(2)}` },
      { label: 'Valid pixels', value: String(vegetation.stats.validPixels) },
    ]);

    report.keyValueGrid([
      ['Scene ID', vegetation.item.id],
      ['Platform', vegetation.item.platform],
      ['Acquired', formatDateSafe(vegetation.item.datetime)],
      ['Cloud cover', `${vegetation.item.cloudCover.toFixed(2)}%`],
      ['MGRS tile', vegetation.item.tileId],
      ['Bands', 'B04 (red) · B08 (NIR)'],
    ]);

    report.paragraph('Distribution across health bands', { bold: true, size: 9 });
    report.stackedBar(
      NDVI_BANDS.filter((band) => band.id !== 'nodata').map((band) => ({
        share: vegetation.stats.bands[band.id],
        color: hexToRgb(band.color),
      })),
    );
    report.keyValueGrid(
      NDVI_BANDS.filter((band) => band.id !== 'nodata').map(
        (band) =>
          [
            band.label,
            `${percent(vegetation.stats.bands[band.id], 1)} of the field`,
          ] as [string, string],
      ),
      2,
    );

    if (vegetation.change) {
      report.paragraph(
        `Change against the previous comparable acquisition (${formatDateSafe(vegetation.change.previousDate)}): mean NDVI ${
          vegetation.change.delta >= 0 ? 'rose' : 'fell'
        } by ${Math.abs(vegetation.change.delta).toFixed(3)}.`,
      );
    }

    if (input.ndviImageDataUrl) {
      report.image(input.ndviImageDataUrl, {
        maxHeight: 200,
        caption: 'Sampled NDVI raster across the boundary. Grey cells are outside the field or masked by cloud.',
      });
    }

    report.note(
      'Colour semantics: green indicates healthier vegetation, yellow moderate, red stressed or bare, and grey unavailable or no data.',
    );
  } else {
    report.note(
      'No vegetation index was available for this report. Either no Sentinel-2 acquisition intersected the boundary within the search window, or the boundary was too small for the 10 m pixel grid.',
      'warning',
    );
  }

  /* ------------------------------------------------------------------------ soil */
  report.sectionTitle('Soil properties', 'ISRIC SoilGrids v2.0 mean values, converted from mapped to target units.');
  if (soil) {
    report.table(
      ['Property', 'Value', 'Unit', 'Depth'],
      soil.properties.map((property) => [
        property.label,
        property.value === null ? 'No data' : formatNumber(property.value, property.value < 10 ? 2 : 1),
        property.unit,
        property.depth,
      ]),
      [230, 110, 110, 60],
    );
    if (soil.texture) {
      report.paragraph(
        `Texture classification: ${soil.texture.label} — ${soil.texture.components
          .map((component) => `${component.label} ${component.fraction === null ? 'n/a' : `${(component.fraction * 100).toFixed(1)}%`}`)
          .join(' · ')}`,
      );
    }
    report.note(`Source: ${DATA_SOURCES.soilGrids.label} (${DATA_SOURCES.soilGrids.provider}), retrieved ${formatDateTime(soil.retrievedAt)}. Licence ${DATA_SOURCES.soilGrids.license}.`);
  } else {
    report.note('No soil profile was retrieved for this field. SoilGrids did not return data for this location.', 'warning');
  }

  /* --------------------------------------------------------------------- climate */
  report.sectionTitle('Climate overview', 'Open-Meteo ERA5 reanalysis history combined with the forecast endpoint.');
  if (climate) {
    report.metricRow([
      {
        label: 'Annual rainfall',
        value: climate.annualRainfallMm === null ? 'n/a' : String(Math.round(climate.annualRainfallMm)),
        unit: 'mm',
      },
      {
        label: 'Reference ET₀',
        value: climate.totalEt0Mm === null ? 'n/a' : String(Math.round(climate.totalEt0Mm)),
        unit: 'mm',
      },
      {
        label: 'Temp minimum',
        value: climate.tempRange.minC === null ? 'n/a' : climate.tempRange.minC.toFixed(1),
        unit: '°C',
      },
      {
        label: 'Temp maximum',
        value: climate.tempRange.maxC === null ? 'n/a' : climate.tempRange.maxC.toFixed(1),
        unit: '°C',
      },
    ]);

    report.keyValueGrid([
      ['Rainfall period', climate.rainfallPeriodLabel],
      ['Records assembled', `${climate.days.length} days`],
      [
        'Latest surface moisture',
        climate.soilMoistureSeries.length && climate.soilMoistureSeries[climate.soilMoistureSeries.length - 1].surface !== null
          ? `${climate.soilMoistureSeries[climate.soilMoistureSeries.length - 1].surface?.toFixed(3)} m³/m³`
          : 'Unavailable',
      ],
      [
        'Air quality (PM2.5)',
        climate.airQuality?.pm25 !== null && climate.airQuality !== null
          ? `${climate.airQuality.pm25.toFixed(1)} µg/m³ — ${climate.airQuality.aqiLabel}`
          : 'Unavailable',
      ],
    ]);

    if (climate.anomalies.length) {
      report.paragraph('Climate anomalies against the trailing 12-month baseline', { bold: true, size: 9 });
      report.table(
        ['Anomaly', 'Value', 'Baseline', 'Severity'],
        climate.anomalies.map((anomaly) => [
          anomaly.label,
          `${anomaly.id === 'temperature' && anomaly.value > 0 ? '+' : ''}${formatNumber(anomaly.value, 2)} ${anomaly.unit}`,
          `${formatNumber(anomaly.baseline, 1)} ${anomaly.unit}`,
          anomaly.severity,
        ]),
        [220, 110, 110, 70],
      );
    }
    report.note(
      `Sources: ${DATA_SOURCES.openMeteoArchive.label} and ${DATA_SOURCES.openMeteoForecast.label} (${DATA_SOURCES.openMeteoArchive.provider}), licence CC BY 4.0.`,
    );
  } else {
    report.note('No climate record was retrieved for this field. Open-Meteo did not return data for this location.', 'warning');
  }

  /* ------------------------------------------------------------- land suitability */
  report.sectionTitle(
    'Land suitability',
    `Deterministic rules-engine evaluation across ${evaluation?.datasetSize ?? 0} crop profiles (engine v${RULES_ENGINE_META.version}).`,
  );
  if (evaluation) {
    report.metricRow([
      { label: 'Profiles evaluated', value: String(evaluation.datasetSize) },
      { label: 'Recommended', value: String(evaluation.recommended.length) },
      { label: 'Conditional', value: String(evaluation.conditional.length) },
      { label: 'Rejected', value: String(evaluation.rejected.length) },
    ]);

    if (evaluation.recommended.length || evaluation.conditional.length) {
      report.paragraph('Approved crop candidates', { bold: true, size: 9 });
      report.table(
        ['Crop', 'Score', 'Water (mm)', 'Constraints'],
        [...evaluation.recommended, ...evaluation.conditional].slice(0, 14).map((entry) => [
          entry.crop.name,
          String(Math.round(entry.score * 100)),
          `${entry.crop.waterRequirementMm.min}–${entry.crop.waterRequirementMm.max}`,
          entry.constraints.length ? entry.constraints[0] : 'None raised',
        ]),
        [140, 50, 90, 230],
      );
    }

    report.paragraph('Why crops were rejected', { bold: true, size: 9 });
    report.table(
      ['Crop', 'Score', 'Primary constraint'],
      evaluation.rejected.slice(0, 16).map((entry) => [
        entry.crop.name,
        String(Math.round(entry.score * 100)),
        entry.constraints[0] ?? 'Below the acceptance threshold on the combined factor score.',
      ]),
      [150, 50, 310],
    );

    report.paragraph(
      `Acceptance thresholds: a score of ${Math.round(VERDICT_THRESHOLDS.recommended * 100)} or above is recommended, ${Math.round(VERDICT_THRESHOLDS.conditional * 100)}–${Math.round(VERDICT_THRESHOLDS.recommended * 100)} is conditional, and below ${Math.round(VERDICT_THRESHOLDS.conditional * 100)} is rejected. Scores are reproducible for a given field context.`,
      { size: 7.8, color: COLORS.muted },
    );

    if (CROP_DATASET_META.isDemonstration) {
      report.note(
        `The rules engine evaluated the bundled ${CROP_DATASET_META.size}-crop demonstration profile set. Scores are computed from this field's real NDVI, soil and climate signals, but the crop reference values are demonstration data rather than a connected production rules-engine dataset.`,
        'warning',
      );
    }
  } else {
    report.note('Land suitability was not evaluated for this field.', 'warning');
  }

  /* -------------------------------------------------------- zones and rotation */
  report.sectionTitle('Crop allocation and seasonal calendar', 'Zones tile the drawn boundary exactly; the rotation spreads water demand across the year.');
  if (planning) {
    if (planning.zones.length) {
      report.paragraph('Crop zones', { bold: true, size: 9 });
      report.table(
        ['Zone crop', 'Share', 'Area', 'Mean water demand'],
        planning.zones.map((zone) => [
          zone.cropName,
          percent(zone.share, 1),
          formatArea(zone.areaM2),
          `${Math.round(zone.waterNeedMm)} mm`,
        ]),
        [180, 90, 120, 120],
      );
    }

    if (planning.rotation.length) {
      report.paragraph('Rotation calendar', { bold: true, size: 9 });
      report.table(
        ['Season', 'Crop', 'Planting months', 'Cycle'],
        planning.rotation.map((slot) => [
          slot.season === 'autumn-winter' ? 'Autumn–winter (Rabi)' : slot.season === 'summer' ? 'Summer (Kharif)' : 'Spring',
          slot.cropName,
          slot.months.map((month) => monthLabel(month)).join(', '),
          `${Math.round(slot.waterMm)} mm demand`,
        ]),
        [140, 150, 140, 80],
      );
    }

    if (planning.recommendations.length) {
      report.paragraph('Rules-derived recommendations', { bold: true, size: 9 });
      report.bulletList(planning.recommendations);
    }

    report.paragraph('Guardrail validation', { bold: true, size: 9 });
    report.table(
      ['Check', 'Result', 'Detail'],
      planning.aiPlan.guardrails.map((check) => [
        check.label,
        check.passed ? 'Passed' : 'Warning',
        check.detail,
      ]),
      [150, 60, 300],
    );

    if (planning.aiPlan.status !== 'ok') {
      report.note(
        planning.aiPlan.message ??
          'No AI explanation service was connected. The plan above was produced entirely by the deterministic rules engine.',
      );
    }
  } else {
    report.note('No crop allocation was generated for this field.', 'warning');
  }

  /* ------------------------------------------------------------------- risks */
  report.sectionTitle('Risk warnings', 'Raised only from signals that were actually retrieved.');
  const risks: string[] = [];
  if (climate && climate.annualRainfallMm !== null && climate.totalEt0Mm !== null && climate.totalEt0Mm > climate.annualRainfallMm) {
    risks.push(
      `Structural water deficit: reference evapotranspiration exceeds rainfall by approximately ${Math.round(climate.totalEt0Mm - climate.annualRainfallMm)} mm across the record.`,
    );
  }
  if (climate && climate.tempRange.minC !== null && climate.tempRange.minC < 0) {
    risks.push(`Frost exposure: the record includes minima of ${climate.tempRange.minC.toFixed(1)} °C.`);
  }
  if (vegetation && vegetation.stats.bands.stressed > 0.05) {
    risks.push(
      `Canopy stress: ${percent(vegetation.stats.bands.stressed, 1)} of the field reads below NDVI 0.20, indicating bare soil or severely stressed vegetation.`,
    );
  }
  if (vegetation && vegetation.change && vegetation.change.delta < -0.04) {
    risks.push(`Declining vigour: mean NDVI fell ${Math.abs(vegetation.change.delta).toFixed(3)} against the previous acquisition.`);
  }
  if (planning) {
    planning.aiPlan.guardrails
      .filter((check) => !check.passed)
      .forEach((check) => risks.push(`${check.label}: ${check.detail}`));
  }
  if (!vegetation) risks.push('Vegetation intelligence is unavailable for this field, so canopy condition could not be assessed.');
  if (!soil) risks.push('Soil intelligence is unavailable for this field, so the soil profile was not evaluated.');
  if (!climate) risks.push('Climate intelligence is unavailable for this field, so water balance was not computed.');

  if (risks.length) {
    report.bulletList(risks);
  } else {
    report.note('No risk warnings were raised from the retrieved signals.');
  }

  /* ---------------------------------------------------------------- provenance */
  report.sectionTitle('Data sources and timestamps', 'Every provider used to produce this report.');
  report.table(
    ['Source', 'Provider', 'Licence'],
    [
      [DATA_SOURCES.satelliteImagery.label, DATA_SOURCES.satelliteImagery.provider, DATA_SOURCES.satelliteImagery.license ?? 'See provider'],
      [DATA_SOURCES.sentinelCatalog.label, DATA_SOURCES.sentinelCatalog.provider, DATA_SOURCES.sentinelCatalog.license ?? 'See provider'],
      [DATA_SOURCES.sentinelCogs.label, DATA_SOURCES.sentinelCogs.provider, DATA_SOURCES.sentinelCogs.license ?? 'See provider'],
      [DATA_SOURCES.soilGrids.label, DATA_SOURCES.soilGrids.provider, DATA_SOURCES.soilGrids.license ?? 'See provider'],
      [DATA_SOURCES.openMeteoArchive.label, DATA_SOURCES.openMeteoArchive.provider, DATA_SOURCES.openMeteoArchive.license ?? 'See provider'],
      [DATA_SOURCES.openMeteoForecast.label, DATA_SOURCES.openMeteoForecast.provider, DATA_SOURCES.openMeteoForecast.license ?? 'See provider'],
      [DATA_SOURCES.openMeteoAir.label, DATA_SOURCES.openMeteoAir.provider, DATA_SOURCES.openMeteoAir.license ?? 'See provider'],
      [DATA_SOURCES.rulesEngine.label, DATA_SOURCES.rulesEngine.provider, 'Deterministic engine'],
      [CROP_DATASET_META.label, DATA_SOURCES.rulesDataset.provider, 'Demonstration dataset'],
    ],
    [190, 200, 120],
  );

  report.paragraph(
    `Report generated ${formatDateTime(generatedAt)}. Field created ${formatDateSafe(field.createdAt)}. Values reflect the data available at generation time and are not a substitute for on-site agronomic assessment.`,
    { size: 7.4, color: COLORS.muted },
  );

  report.finalise(field);
  return doc;
}

function formatDateSafe(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function reportFileName(field: Field): string {
  const slug = field.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
  return `agrisense-${slug || 'field'}-${new Date().toISOString().slice(0, 10)}.pdf`;
}
