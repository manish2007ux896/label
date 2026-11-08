// FILE: src/core/pdf/testSampleGenerator.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generateSampleSellerPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const sampleOrders = [
    {
      marketplace: 'Meesho',
      courier: 'VALMO',
      awb: 'VL9028192019',
      orderId: '482910384729102_1',
      buyer: 'Priya Sharma, Flat 402, Shivam Apts',
      city: 'Surat, Gujarat',
      pin: '395006',
      sku: 'KRT-COT-BLK-XL',
      size: 'XL',
      color: 'BLACK',
      qty: 2, // MULTI-QUANTITY ORDER!
      payment: 'COD',
      amount: '699'
    },
    {
      marketplace: 'Meesho',
      courier: 'VALMO',
      awb: 'VL9028192020',
      orderId: '482910384729103_1',
      buyer: 'Anjali Verma, 14 MG Road',
      city: 'Jaipur, Rajasthan',
      pin: '302001',
      sku: 'KRT-COT-BLK-M',
      size: 'M',
      color: 'BLACK',
      qty: 1,
      payment: 'PREPAID',
      amount: '349'
    },
    {
      marketplace: 'Meesho',
      courier: 'DELHIVERY',
      awb: '148291029381',
      orderId: '482910384729104_1',
      buyer: 'Sunita Patel, 22 Vasant Kunj',
      city: 'Ahmedabad, Gujarat',
      pin: '380015',
      sku: 'SAREE-BAN-RED',
      size: 'FREE',
      color: 'RED',
      qty: 1,
      payment: 'COD',
      amount: '899'
    },
    {
      marketplace: 'Flipkart',
      courier: 'EKART',
      awb: 'FMPC9928172910',
      orderId: 'OD329481029384710293',
      buyer: 'Rahul Mehta, Sector 18',
      city: 'Noida, Uttar Pradesh',
      pin: '201301',
      sku: 'KURTI-RAYON-NAVY-L',
      size: 'L',
      color: 'NAVY',
      qty: 3, // MULTI-QUANTITY ORDER!
      payment: 'COD',
      amount: '1197'
    },
    {
      marketplace: 'Flipkart',
      courier: 'EKART',
      awb: 'FMPP9928172911',
      orderId: 'OD329481029384710294',
      buyer: 'Deepak Joshi, Deccan Gymkhana',
      city: 'Pune, Maharashtra',
      pin: '411004',
      sku: 'KURTI-RAYON-NAVY-M',
      size: 'M',
      color: 'NAVY',
      qty: 1,
      payment: 'PREPAID',
      amount: '399'
    }
  ];

  for (const ord of sampleOrders) {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions
    const H = 841.89;

    // 1. Top Shipping Label Zone (x: 18..577, y: 16..398)
    page.drawRectangle({
      x: 18,
      y: H - 400,
      width: 559,
      height: 382,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1.0,
      color: rgb(1, 1, 1)
    });

    // Courier Header
    page.drawText(`${ord.courier} LOGISTICS`, { x: 30, y: H - 45, size: 16, font: bold });
    page.drawText(`[ ${ord.marketplace.toUpperCase()} ]  |  ${ord.payment === 'COD' ? 'COD - COLLECT CASH' : 'PREPAID'}`, {
      x: 320,
      y: H - 45,
      size: 11,
      font: bold
    });

    page.drawLine({ start: { x: 18, y: H - 56 }, end: { x: 577, y: H - 56 }, thickness: 1 });

    page.drawText(`Customer Shipping Address:`, { x: 30, y: H - 75, size: 10, font: bold });
    page.drawText(ord.buyer, { x: 30, y: H - 92, size: 10, font: reg });
    page.drawText(ord.city, { x: 30, y: H - 108, size: 10, font: reg });
    page.drawText(`PIN CODE: ${ord.pin}`, { x: 30, y: H - 126, size: 12, font: bold });

    // Barcode Simulation (crisp black bars)
    for (let b = 0; b < 48; b++) {
      const barW = (b % 4 === 0 || b % 5 === 0) ? 2.8 : 1.2;
      page.drawRectangle({
        x: 60 + b * 4.8,
        y: H - 240,
        width: barW,
        height: 52,
        color: rgb(0, 0, 0)
      });
    }

    page.drawText(`AWB: ${ord.awb}`, { x: 140, y: H - 258, size: 11, font: bold });
    page.drawText(`Order ID: ${ord.orderId}`, { x: 30, y: H - 310, size: 9.5, font: reg });
    page.drawText(`Collectible Amount: Rs. ${ord.amount}.00`, { x: 30, y: H - 330, size: 10, font: bold });

    // 2. Tax Invoice Fold Line & Header (y_top ~ 408pt)
    page.drawLine({ start: { x: 18, y: H - 404 }, end: { x: 577, y: H - 404 }, thickness: 1.0 });
    page.drawText('TAX INVOICE / BILL OF SUPPLY', { x: 210, y: H - 420, size: 11, font: bold });

    // 3. Bottom Tax Invoice Table
    page.drawText(`Sold By: Surat Ethnic Wear Pvt Ltd  |  GSTIN: 24AAAAA0000A1Z5`, {
      x: 30,
      y: H - 445,
      size: 9,
      font: reg
    });

    page.drawRectangle({
      x: 30,
      y: H - 540,
      width: 535,
      height: 80,
      borderColor: rgb(0.2, 0.2, 0.2),
      borderWidth: 0.8
    });

    page.drawText(`SKU: ${ord.sku}`, { x: 40, y: H - 480, size: 11, font: bold });
    page.drawText(`Size: ${ord.size}   |   Color: ${ord.color}   |   Qty: ${ord.qty} pcs`, {
      x: 40,
      y: H - 505,
      size: 10,
      font: bold
    });
    page.drawText(`Total Amount: Rs. ${ord.amount}.00  (CGST + SGST Included)`, {
      x: 40,
      y: H - 525,
      size: 9,
      font: reg
    });
  }

  return await pdfDoc.save();
}
