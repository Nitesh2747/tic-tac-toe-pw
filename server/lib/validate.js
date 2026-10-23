// Everything a client sends is untrusted: check it before using it.
export const isId = (value) =>
  typeof value === "string" && value.length > 0 && value.length <= 64;
