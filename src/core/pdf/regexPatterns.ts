// FILE: src/core/pdf/regexPatterns.ts

export const MARKETPLACE_REGEX = {
  // 1. Courier Partner Detection
  COURIER: {
    VALMO:       /\b(VALMO|FASHNEAR|MEESHO\s*LOGISTICS|POCKETSHIP)\b/i,
    DELHIVERY:   /\b(DELHIVERY)\b/i,
    SHADOWFAX:   /\b(SHADOWFAX)\b/i,
    XPRESSBEES:  /\b(XPRESSBEES)\b/i,
    ECOM_EXP:    /\b(ECOM\s*EXPRESS|ECOMEXP)\b/i,
    EKART:       /\b(E-?KART|EKART\s*LOGISTICS|INSTAKART)\b/i,
    ATS:         /\b(AMAZON\s*TRANSPORTATION|ATS)\b/i,
    BLUEDART:    /\b(BLUE\s*DART)\b/i,
    DTDC:        /\b(DTDC)\b/i,
  },

  // 2. AWB & Order ID Patterns
  AWB_MEESHO:    /\b(VL\d{10,14}|SF\d{10,14}|XB\d{10,14}|\d{12,15})\b/,
  AWB_FLIPKART:  /\b(FMPC\d{9,12}|FMPP\d{9,12}|EKART\d{8,12})\b/i,
  ORDER_MEESHO:  /\b(\d{10,16}_\d{1,2})\b/, // e.g. 482910384729_1
  ORDER_FLIPKART:/\b(OD\d{16,21})\b/,       // e.g. OD329481029384710293
  ORDER_AMAZON:  /\b(\d{3}-\d{7}-\d{7})\b/, // e.g. 402-1234567-1234567

  // 3. Buyer Destination 6-Digit Indian Pin Code
  PIN_CODE:      /\b([1-8][0-9]{5})\b/,

  // 4. Payment Mode Detection
  PAYMENT_MODE:  /\b(COD|CASH\s*ON\s*DELIVERY|FMPC|PREPAID|ONLINE)\b/i,

  // 5. SKU & Size Extraction from Bottom Tax Invoice Table
  MEESHO_SKU_LINE: /SKU\s*[:\-]?\s*([A-Za-z0-9_\-\.\/]+).*?Size\s*[:\-]?\s*([A-Za-z0-9\-\s]+).*?Qty\s*[:\-]?\s*(\d+)/is,
  FLIPKART_SKU_ROW: /^\s*\d+\s+([A-Za-z0-9_\-\.\/]{3,40})\s+(.+?)\s+(\d+)\s+₹?\s*[\d,]+\.\d{2}/m,
  GENERIC_QTY:     /\b(?:Qty|Quantity|Net\s*Qty)\s*[:\-]?\s*(\d{1,3})\b/i,
  GENERIC_SIZE:    /\b(?:Size)\s*[:\-]?\s*(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|FREE\s*SIZE|\d{2})\b/i,

  // 6. Common Apparel Colors in Indian E-Commerce
  COLORS: /\b(BLACK|WHITE|RED|BLUE|NAVY|GREEN|YELLOW|PINK|MAROON|PURPLE|ORANGE|GREY|GRAY|BEIGE|PEACH|MUSTARD|TEAL|BROWN|MAGENTA|OLIVE|WINE|RUST|GOLD|SILVER|CREAM)\b/i,
};
