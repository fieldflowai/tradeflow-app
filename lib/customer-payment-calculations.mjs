export function estimateTotalCents(estimate, lines) {
  const packages = Array.isArray(estimate.package_options)
    ? estimate.package_options.filter((option) => option && typeof option === "object")
    : [];
  const selected = packages.find((option) => option.name === estimate.selected_package);
  const packageTotal = selected ? Number(selected.total) : null;
  const subtotal = packageTotal !== null && Number.isFinite(packageTotal)
    ? packageTotal
    : lines.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
  const markup = selected ? 0 : subtotal * Number(estimate.markup_percentage || 0) / 100;
  const tax = (subtotal + markup) * Number(estimate.tax_rate || 0) / 100;
  const amount = Math.round((subtotal + markup + tax) * 100);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
}

export function paidCents(rows) {
  return rows.reduce((sum, row) => {
    if (!["succeeded", "partially_refunded", "refunded"].includes(row.status)) return sum;
    return sum + Math.max(0, Number(row.amount_cents) - Number(row.amount_refunded_cents));
  }, 0);
}
