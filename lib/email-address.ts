export function emailAddressFromConfig(value: string | undefined) {
  const configuredValue = value?.trim();
  if (!configuredValue) return null;

  const mailbox = configuredValue.match(/<\s*([^<>]+)\s*>$/)?.[1]?.trim() ?? configuredValue;
  if (mailbox.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailbox)) return null;

  return mailbox;
}
