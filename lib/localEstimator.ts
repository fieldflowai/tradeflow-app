export interface LineItemDraft {
  description: string;
  quantity: number;
  unit_price: number;
}

type Rule = {
  match: RegExp;
  description: string;
  unitPrice: number;
  unit: string;
  defaultQuantity?: number;
};

// These are starter reference rates, not live or location-specific prices.
// Keep quantities deterministic and leave every generated line editable.
const tradeRules: Record<string, Rule[]> = {
  plumbing: [
    { match: /\b(toilet|commode)\b/i, description: "Toilet replacement / installation", unitPrice: 425, unit: "each" },
    { match: /\b(faucet|tap)\b/i, description: "Faucet replacement / installation", unitPrice: 225, unit: "each" },
    { match: /\b(water heater|hot water heater)\b/i, description: "Water heater replacement", unitPrice: 1450, unit: "each" },
    { match: /\b(garbage disposal|food waste disposer)\b/i, description: "Garbage disposal replacement", unitPrice: 325, unit: "each" },
    { match: /\b(drain|clog|blockage)\b/i, description: "Drain clearing / service", unitPrice: 185, unit: "each" },
    { match: /\b(leak|pipe repair|burst pipe)\b/i, description: "Leak / pipe repair", unitPrice: 275, unit: "each" },
    { match: /\b(shower|tub|bathtub)\b/i, description: "Shower / tub fixture work", unitPrice: 650, unit: "each" },
  ],
  electrical: [
    { match: /\b(outlet|receptacle)s?\b/i, description: "Outlet / receptacle replacement", unitPrice: 95, unit: "each" },
    { match: /\b(switch|dimmer)s?\b/i, description: "Switch / dimmer replacement", unitPrice: 85, unit: "each" },
    { match: /\b(light|fixture|ceiling fan)s?\b/i, description: "Light / fixture installation", unitPrice: 185, unit: "each" },
    { match: /\b(circuit|breaker)s?\b/i, description: "Circuit / breaker work", unitPrice: 275, unit: "each" },
    { match: /\b(panel|service upgrade)\b/i, description: "Electrical panel / service work", unitPrice: 2400, unit: "each" },
    { match: /\b(smoke detector|carbon monoxide|co detector)s?\b/i, description: "Safety detector installation", unitPrice: 95, unit: "each" },
    { match: /\b(rewire|rewiring)\b/i, description: "Wiring work", unitPrice: 95, unit: "hour", defaultQuantity: 4 },
  ],
  roofing: [
    { match: /\b(roof replacement|reroof|re-roof|shingle)s?\b/i, description: "Roofing materials allowance", unitPrice: 125, unit: "roofing square" },
    { match: /\b(gutter)s?\b/i, description: "Gutter installation / repair", unitPrice: 18, unit: "linear ft" },
    { match: /\b(flashing|skylight)\b/i, description: "Roof flashing / penetration work", unitPrice: 325, unit: "each" },
    { match: /\b(roof repair|roof leak|leak repair)\b/i, description: "Roof repair labor and materials allowance", unitPrice: 450, unit: "each" },
  ],
  hvac: [
    { match: /\b(heat pump)\b/i, description: "Heat pump replacement allowance", unitPrice: 8500, unit: "system" },
    { match: /\b(furnace|air handler)\b/i, description: "Heating equipment service / replacement allowance", unitPrice: 5200, unit: "system" },
    { match: /\b(air conditioner| ac |condenser)\b/i, description: "Cooling equipment service / replacement allowance", unitPrice: 4800, unit: "system" },
    { match: /\b(thermostat)\b/i, description: "Thermostat installation", unitPrice: 225, unit: "each" },
    { match: /\b(duct|ductwork)\b/i, description: "Ductwork repair allowance", unitPrice: 85, unit: "linear ft" },
    { match: /\b(tune[- ]?up|maintenance|inspection|service)\b/i, description: "HVAC diagnostic / maintenance visit", unitPrice: 175, unit: "visit" },
  ],
  painting: [
    { match: /\b(interior|exterior|room|wall|paint|painting)\b/i, description: "Painting materials and labor allowance", unitPrice: 2.75, unit: "sq ft" },
  ],
  flooring: [
    { match: /\b(tile|floor|flooring|hardwood|laminate|vinyl)\b/i, description: "Flooring materials and installation allowance", unitPrice: 8.5, unit: "sq ft" },
  ],
  drywall: [
    { match: /\b(drywall|sheetrock|plaster)\b/i, description: "Drywall repair / installation allowance", unitPrice: 5.5, unit: "sq ft" },
  ],
  carpentry: [
    { match: /\b(deck|decking)\b/i, description: "Decking materials and installation allowance", unitPrice: 28, unit: "sq ft" },
    { match: /\b(fence|fencing)\b/i, description: "Fence installation allowance", unitPrice: 42, unit: "linear ft" },
    { match: /\b(door|doors)\b/i, description: "Door installation / replacement", unitPrice: 425, unit: "each" },
    { match: /\b(trim|baseboard|crown molding)\b/i, description: "Finish trim installation allowance", unitPrice: 9, unit: "linear ft" },
    { match: /\b(frame|framing)\b/i, description: "Framing labor and materials allowance", unitPrice: 18, unit: "sq ft" },
  ],
  general: [
    { match: /\b(demolition|demo|tear[- ]out)\b/i, description: "Selective demolition and disposal allowance", unitPrice: 8, unit: "sq ft" },
    { match: /\b(cleanup|clean up|debris removal)\b/i, description: "Jobsite cleanup / debris removal", unitPrice: 250, unit: "visit" },
    { match: /\b(permit|inspection fee)\b/i, description: "Permit / inspection allowance", unitPrice: 250, unit: "each" },
  ],
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[,]/g, "").replace(/\s+/g, " ").trim();
}

function readQuantity(text: string, rule: Rule): number {
  const unitPattern = rule.unit === "sq ft"
    ? "(?:sq\\.?\\s*ft\\.?|square\\s*(?:feet|foot))"
    : rule.unit === "linear ft"
      ? "(?:linear\\s*(?:feet|foot)|lin\\.?\\s*ft\\.?|ft\\.?|feet)"
      : rule.unit === "roofing square"
        ? "(?:roofing\\s*squares?|squares?|sq\\.?\\s*ft\\.?|square\\s*(?:feet|foot))"
        : rule.unit === "hour"
          ? "(?:hours?|hrs?)"
          : "";

  if (unitPattern) {
    const unitMatch = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unitPattern}`, "i"));
    if (unitMatch) {
      const amount = Number(unitMatch[1]);
      // Roof area is commonly supplied in square feet; convert to roofing squares.
      return rule.unit === "roofing square" && /sq\.?\s*ft|square\s*(?:feet|foot)/i.test(unitMatch[0])
        ? Math.max(1, Math.ceil(amount / 100))
        : Math.max(0.25, amount);
    }
  }

  const target = rule.match.source.replace(/\\b/g, "");
  const nearby = new RegExp(`(\\d+(?:\\.\\d+)?)\\s+(?:[\\w-]+\\s+){0,3}(?:${target})`, "i").exec(text);
  if (nearby) return Math.max(0.25, Number(nearby[1]));
  if (rule.unit === "sq ft" || rule.unit === "linear ft" || rule.unit === "roofing square") return 0;
  return rule.defaultQuantity ?? 1;
}

function inferTrade(text: string): string | null {
  if (/\b(plumb|toilet|faucet|drain|water heater|pipe|leak)\w*/i.test(text)) return "plumbing";
  if (/\b(electric|outlet|receptacle|switch|breaker|circuit|panel|rewir|wiring)\w*/i.test(text)) return "electrical";
  if (/\b(roof|shingle|gutter|flashing|skylight)\w*/i.test(text)) return "roofing";
  if (/\b(hvac|furnace|heat pump|air conditioner|condenser|thermostat|duct)\w*/i.test(text)) return "hvac";
  if (/\b(paint|painting)\w*/i.test(text)) return "painting";
  if (/\b(floor|flooring|tile|hardwood|laminate|vinyl)\w*/i.test(text)) return "flooring";
  if (/\b(drywall|sheetrock|plaster)\w*/i.test(text)) return "drywall";
  if (/\b(carpentry|carpenter|deck|fence|door|trim|framing|frame)\w*/i.test(text)) return "carpentry";
  if (/\b(general contracting|demolition|demo|tear[- ]out|cleanup|debris removal|permit)\w*/i.test(text)) return "general";
  return null;
}

/**
 * Local, deterministic estimate drafter. It extracts recognizable scope and
 * quantities and uses editable starter allowances; it never fabricates a
 * generic labor line just because a prompt was not understood.
 */
export function generateLocalEstimate(prompt: string): LineItemDraft[] {
  const text = normalize(prompt);
  const trade = inferTrade(text);
  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  const results: LineItemDraft[] = [];

  if (trade) {
    for (const rule of tradeRules[trade] ?? []) {
      if (!rule.match.test(text)) continue;
      const quantity = readQuantity(text, rule);
      const description = quantity === 0
        ? `${rule.description} — enter ${rule.unit} quantity`
        : rule.unit === "each" || rule.unit === "system" || rule.unit === "visit"
          ? rule.description
          : `${rule.description} (${rule.unit})`;
      results.push({ description, quantity: quantity || 1, unit_price: quantity === 0 ? 0 : rule.unitPrice });
    }
  }

  if (hoursMatch && results.length === 0) {
    results.push({
      description: "Additional labor (hours — confirm crew size and rate)",
      quantity: Number(hoursMatch[1]),
      unit_price: 0,
    });
  }

  if (results.length > 0) return results;

  return [{
    description: "Scope needs review — add a specific task, quantity, and materials",
    quantity: 1,
    unit_price: 0,
  }];
}
