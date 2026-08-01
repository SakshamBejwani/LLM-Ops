import { z } from "zod";
import { tool } from "ai";

// A small recursive-descent parser for +, -, *, /, ^, parens and unary minus.
// Deliberately not `eval`/`Function` - this only ever needs to run whatever
// arithmetic expression the model produces.
class ExpressionParser {
  private pos = 0;

  constructor(private readonly input: string) {}

  parse(): number {
    const value = this.parseExpression();
    this.skipWhitespace();
    if (this.pos < this.input.length) {
      throw new Error(`Unexpected character at position ${this.pos}: "${this.input[this.pos]}"`);
    }
    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    for (;;) {
      this.skipWhitespace();
      const op = this.input[this.pos];
      if (op === "+" || op === "-") {
        this.pos++;
        const rhs = this.parseTerm();
        value = op === "+" ? value + rhs : value - rhs;
      } else {
        break;
      }
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    for (;;) {
      this.skipWhitespace();
      const op = this.input[this.pos];
      if (op === "*" || op === "/") {
        this.pos++;
        const rhs = this.parseFactor();
        if (op === "/" && rhs === 0) throw new Error("Division by zero");
        value = op === "*" ? value * rhs : value / rhs;
      } else {
        break;
      }
    }
    return value;
  }

  private parseFactor(): number {
    let value = this.parseUnary();
    this.skipWhitespace();
    if (this.input[this.pos] === "^") {
      this.pos++;
      value = value ** this.parseFactor();
    }
    return value;
  }

  private parseUnary(): number {
    this.skipWhitespace();
    if (this.input[this.pos] === "-") {
      this.pos++;
      return -this.parseUnary();
    }
    if (this.input[this.pos] === "+") {
      this.pos++;
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.skipWhitespace();
    if (this.input[this.pos] === "(") {
      this.pos++;
      const value = this.parseExpression();
      this.skipWhitespace();
      if (this.input[this.pos] !== ")") throw new Error("Expected closing parenthesis");
      this.pos++;
      return value;
    }
    const match = /^\d+(\.\d+)?/.exec(this.input.slice(this.pos));
    if (!match) {
      throw new Error(`Expected a number at position ${this.pos}`);
    }
    this.pos += match[0].length;
    return Number(match[0]);
  }

  private skipWhitespace() {
    while (this.input[this.pos] === " " || this.input[this.pos] === "\t") this.pos++;
  }
}

export function evaluateExpression(expression: string): number {
  return new ExpressionParser(expression).parse();
}

export const calculatorTool = tool({
  description: "Evaluate a basic arithmetic expression (+, -, *, /, ^, parentheses).",
  inputSchema: z.object({
    expression: z.string().describe('e.g. "12 * (3 + 4) / 2"'),
  }),
  execute: async ({ expression }) => {
    const result = evaluateExpression(expression);
    return { expression, result };
  },
});
