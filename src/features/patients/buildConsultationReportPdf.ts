import * as FileSystem from "expo-file-system/legacy";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export type ReportPdfRxLine = {
  id: string;
  name?: string | null;
  dosePattern?: string | null;
  foodTiming?: string | null;
  duration?: string | number | null;
};

export type ConsultationReportPdfInput = {
  facilityName: string;
  facilityAddress: string;
  dateTimeLabel: string;
  consultLabel: string;
  patientName: string;
  patientMeta: string;
  doctorLabel: string;
  diagnosis: string;
  notes: string;
  prescriptionRows: ReportPdfRxLine[];
};

function foodTimingLabel(value?: string | null): string {
  if (!value) return "";
  if (value === "AF") return "After Food";
  if (value === "BF") return "Before Food";
  return value;
}

function wrapText(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Pure-JS PDF (no native ExpoPrint). Works in existing custom/dev clients.
 */
export async function buildConsultationReportPdf(
  input: ConsultationReportPdfInput
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // US Letter
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  const pageWidth = page.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = page.getHeight() - margin;

  const drawText = (
    text: string,
    x: number,
    yy: number,
    size: number,
    bold = false,
    color = rgb(0.09, 0.09, 0.09)
  ) => {
    page.drawText(text, {
      x,
      y: yy,
      size,
      font: bold ? fontBold : font,
      color,
    });
  };

  // Header
  drawText(input.facilityName || "Facility", margin, y, 22, true);
  const metaSize = 10;
  const rightX = pageWidth - margin;
  const dateW = font.widthOfTextAtSize(input.dateTimeLabel, metaSize);
  drawText(input.dateTimeLabel, rightX - dateW, y + 8, metaSize, false, rgb(0.45, 0.45, 0.45));
  y -= 16;
  drawText(
    input.facilityAddress || "Address not available",
    margin,
    y,
    10,
    false,
    rgb(0.45, 0.45, 0.45)
  );
  const rxId = `Prescription ID: ${input.consultLabel}`;
  const rxW = font.widthOfTextAtSize(rxId, metaSize);
  drawText(rxId, rightX - rxW, y, metaSize, false, rgb(0.45, 0.45, 0.45));
  y -= 14;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });
  y -= 22;

  // Patient / Physician
  page.drawRectangle({
    x: margin,
    y: y - 52,
    width: contentWidth,
    height: 60,
    color: rgb(0.98, 0.98, 0.98),
  });
  drawText("PATIENT", margin + 12, y - 8, 9, true, rgb(0.45, 0.45, 0.45));
  drawText(input.patientName, margin + 12, y - 26, 13, true);
  drawText(`ID: ${input.patientMeta}`, margin + 12, y - 42, 10, false, rgb(0.4, 0.4, 0.4));

  const physLabel = "PHYSICIAN";
  const physLabelW = fontBold.widthOfTextAtSize(physLabel, 9);
  drawText(physLabel, rightX - 12 - physLabelW, y - 8, 9, true, rgb(0.45, 0.45, 0.45));
  const docW = fontBold.widthOfTextAtSize(input.doctorLabel, 12);
  drawText(input.doctorLabel, rightX - 12 - docW, y - 26, 12, true);
  const spec = "General Medicine";
  const specW = font.widthOfTextAtSize(spec, 10);
  drawText(spec, rightX - 12 - specW, y - 42, 10, false, rgb(0.4, 0.4, 0.4));
  y -= 76;

  // Diagnosis / Notes boxes
  const gap = 12;
  const boxW = (contentWidth - gap) / 2;
  const boxH = 80;
  page.drawRectangle({
    x: margin,
    y: y - boxH,
    width: boxW,
    height: boxH,
    color: rgb(0.94, 0.97, 1),
  });
  page.drawRectangle({
    x: margin + boxW + gap,
    y: y - boxH,
    width: boxW,
    height: boxH,
    color: rgb(1, 0.98, 0.92),
  });
  drawText("DIAGNOSIS", margin + 10, y - 14, 9, true, rgb(0.12, 0.25, 0.69));
  const diagLines = wrapText(input.diagnosis || "N/A", boxW - 20, font, 11);
  diagLines.slice(0, 4).forEach((line, i) => {
    drawText(line, margin + 10, y - 32 - i * 14, 11);
  });
  drawText(
    "DOCTOR NOTES",
    margin + boxW + gap + 10,
    y - 14,
    9,
    true,
    rgb(0.57, 0.25, 0.05)
  );
  const noteLines = wrapText(input.notes || "—", boxW - 20, font, 11);
  noteLines.slice(0, 4).forEach((line, i) => {
    drawText(line, margin + boxW + gap + 10, y - 32 - i * 14, 11);
  });
  y -= boxH + 22;

  // Prescription
  drawText("Rx PRESCRIPTION", margin, y, 14, true);
  y -= 10;
  const tableTop = y;
  const col1 = margin;
  const col2 = margin + contentWidth * 0.42;
  const col3 = margin + contentWidth * 0.82;
  const rowH = 22;
  page.drawRectangle({
    x: margin,
    y: tableTop - rowH,
    width: contentWidth,
    height: rowH,
    color: rgb(0.09, 0.09, 0.09),
  });
  drawText("Medicine", col1 + 8, tableTop - 15, 10, true, rgb(1, 1, 1));
  drawText("Dosage & Frequency", col2 + 4, tableTop - 15, 10, true, rgb(1, 1, 1));
  drawText("Days", col3 + 8, tableTop - 15, 10, true, rgb(1, 1, 1));
  y = tableTop - rowH;

  const rows =
    input.prescriptionRows.length > 0
      ? input.prescriptionRows
      : [
          {
            id: "empty",
            name: "No medicines in this prescription.",
            dosePattern: "",
            foodTiming: "",
            duration: "",
          },
        ];

  rows.forEach((line, idx) => {
    y -= rowH;
    if (y < 90) return;
    if (idx % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y,
        width: contentWidth,
        height: rowH,
        color: rgb(0.98, 0.98, 0.98),
      });
    }
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });
    const dose = [line.dosePattern, foodTimingLabel(line.foodTiming)]
      .filter(Boolean)
      .join(" · ");
    drawText((line.name || "—").slice(0, 36), col1 + 8, y + 7, 10);
    drawText((dose || "—").slice(0, 32), col2 + 4, y + 7, 10);
    drawText(
      line.duration != null && String(line.duration) ? String(line.duration) : "—",
      col3 + 8,
      y + 7,
      10
    );
  });

  y -= 28;
  page.drawLine({
    start: { x: margin, y: y + 12 },
    end: { x: pageWidth - margin, y: y + 12 },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });

  // Next visit / Authorized
  drawText("NEXT VISIT", margin, y, 9, true, rgb(0.45, 0.45, 0.45));
  const authLabel = "AUTHORIZED BY";
  const authLabelW = fontBold.widthOfTextAtSize(authLabel, 9);
  drawText(authLabel, rightX - authLabelW, y, 9, true, rgb(0.45, 0.45, 0.45));
  y -= 22;
  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: 90,
    height: 22,
    color: rgb(0.93, 0.99, 0.96),
  });
  drawText("As advised", margin + 10, y + 2, 11, false, rgb(0.02, 0.37, 0.27));
  const docW2 = fontBold.widthOfTextAtSize(input.doctorLabel, 12);
  drawText(input.doctorLabel, rightX - docW2, y + 2, 12, true);

  // Watermark
  const watermark = "Powered by Welbuk";
  const wmSize = 11;
  const wmW = font.widthOfTextAtSize(watermark, wmSize);
  drawText(
    watermark,
    (pageWidth - wmW) / 2,
    36,
    wmSize,
    false,
    rgb(0.64, 0.64, 0.64)
  );

  return pdf.save();
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  // btoa available in RN Hermes / web
  return globalThis.btoa(binary);
}

export type CachedConsultationReportPdf = {
  uri: string;
  fileName: string;
};

/** Build the consultation report PDF and write it to the app cache directory. */
export async function writeConsultationReportPdfToCache(
  input: ConsultationReportPdfInput
): Promise<CachedConsultationReportPdf> {
  const bytes = await buildConsultationReportPdf(input);

  const fileName = `prescription-${String(input.consultLabel)
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-|-$/g, "") || "report"}.pdf`;

  const dir = FileSystem.cacheDirectory;
  if (!dir) {
    throw new Error("Could not access cache directory for PDF.");
  }

  const uri = `${dir}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, uint8ToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { uri, fileName };
}
