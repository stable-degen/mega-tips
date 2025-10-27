export function truncateAddress(address?: string | null, size = 4) {
  if (!address) return "";
  const prefix = address.slice(0, size + 2);
  const suffix = address.slice(-size);
  return `${prefix}...${suffix}`;
}
