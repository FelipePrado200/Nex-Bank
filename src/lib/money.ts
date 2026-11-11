/** All helpers take centavos as a string/bigint and never go through floating point. */

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export interface MoneyParts {
  negative: boolean;
  integer: string; // already grouped, e.g. "1.234"
  decimal: string; // two digits
}

export function splitBRL(cents: string | bigint): MoneyParts {
  const value = typeof cents === "bigint" ? cents : BigInt(cents);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  return {
    negative,
    integer: groupThousands((abs / 100n).toString()),
    decimal: (abs % 100n).toString().padStart(2, "0"),
  };
}

/** "R$ 1.234,56" — negative values render as "-R$ 1.234,56". */
export function formatBRL(cents: string | bigint): string {
  const { negative, integer, decimal } = splitBRL(cents);
  return `${negative ? "-" : ""}R$ ${integer},${decimal}`;
}

/** "1.234,56" — no currency symbol, used inside inputs. */
export function formatPlain(cents: string | bigint): string {
  const { integer, decimal } = splitBRL(cents);
  return `${integer},${decimal}`;
}
