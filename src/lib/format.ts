export const formatRwf = (n: number) =>
  new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " Rwf";

export const formatNumber = (n: number) =>
  new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 }).format(Math.round(n || 0));

export const monthRange = (months: number) => {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months + 1);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);