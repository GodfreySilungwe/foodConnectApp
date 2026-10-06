const mwkFormatter = new Intl.NumberFormat('en-MW', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMWK(amount) {
  return `MWK ${mwkFormatter.format(Number(amount) || 0)}`;
}