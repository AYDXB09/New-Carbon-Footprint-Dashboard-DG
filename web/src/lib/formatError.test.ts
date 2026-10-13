import { describe, expect, it } from "vitest";
import { formatError } from "./formatError";

describe("formatError", () => {
  it("reads Error, string and plain-object errors, never '[object Object]'", () => {
    expect(formatError(new Error("boom"))).toBe("boom");
    expect(formatError("nope")).toBe("nope");
    expect(formatError({ message: "row-level security" })).toBe("row-level security");
    expect(formatError({ code: 42 })).toBe('{"code":42}');
  });
  it("turns a missing 0013 column into an instruction", () => {
    const e = { message: "Could not find the 'factor_key' column of 'meters' in the schema cache" };
    expect(formatError(e)).toMatch(/0013/);
    expect(formatError({ message: 'column "stand_in_ok" does not exist' })).toMatch(/0013/);
  });
  it("leaves unrelated messages that merely mention a column alone", () => {
    expect(formatError({ message: "duplicate key value violates unique constraint" })).toMatch(/duplicate key/);
  });
});
