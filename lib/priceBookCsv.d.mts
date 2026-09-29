export type ImportedPriceBookItem = {
  name: string;
  description: string;
  trade: string;
  unit: string;
  unit_price: number;
};

export function parsePriceBookCsv(text: string): ImportedPriceBookItem[];
