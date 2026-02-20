import crypto from "crypto";

const secret = process.env.SESSION_SECRET!;
if (!secret) throw new Error("Missing SESSION_SECRET");


if (!secret) {
  throw new Error("Missing SESSION_SECRET");
}

function sign(data: string) {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
}

export function createSignedSession(payload: object) {
  const json = JSON.stringify(payload);
  const signature = sign(json);
  return Buffer.from(json).toString("base64") + "." + signature;
}

export function verifySignedSession(value: string) {
  try {
    const [base64, signature] = value.split(".");
    const json = Buffer.from(base64, "base64").toString();
    const expectedSig = sign(json);

    if (expectedSig !== signature) return null;

    return JSON.parse(json);
  } catch {
    return null;
  }
}
