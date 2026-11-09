import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Converts an HTML element (e.g. A4 specification preview) to a high-resolution PDF Blob and URL.
 */
export async function convertElementToPdfBlob(element: HTMLElement): Promise<{ blob: Blob; url: string }> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pdfWidth = 210; // A4 mm
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  const pageHeight = 297; // A4 mm

  let heightLeft = pdfHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
  heightLeft -= pageHeight;

  while (heightLeft > 5) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
  }

  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}
