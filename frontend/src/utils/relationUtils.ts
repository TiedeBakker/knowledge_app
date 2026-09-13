/**
 * Haalt het inkomende (eerste) label op uit een samengestelde relatiestring ("ingaand|uitgaand").
 * Vangt lege of ongeldige invoer veilig af.
 * 
 * @example
 * getInboundRelationLabel("is kind van|is ouder van") // -> "is kind van"
 * getInboundRelationLabel("is gerelateerd aan")      // -> "is gerelateerd aan"
 */
export const getInboundRelationLabel = (label?: string | null): string => {
  if (!label) return '';
  const parts = label.split('|');
  return parts[0].trim();
};

/**
 * Haalt het uitgaande (tweede) label op uit een samengestelde relatiestring ("ingaand|uitgaand").
 * Als er geen uitgaand label is (geen '|'), wordt het inkomende label gebruikt.
 * 
 * @example
 * getOutboundRelationLabel("is kind van|is ouder van") // -> "is ouder van"
 * getOutboundRelationLabel("is gerelateerd aan")       // -> "is gerelateerd aan"
 */
export const getOutboundRelationLabel = (label?: string | null): string => {
  if (!label) return '';
  const parts = label.split('|');
  return parts.length > 1 ? parts[1].trim() : parts[0].trim();
};