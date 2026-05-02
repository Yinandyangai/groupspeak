import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? "dev-secret";
if (SECRET === "dev-secret" && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production");
}

export interface AuthClaims {
  sub: string; // userId
  name: string;
  anon: boolean;
}

export function signToken(claims: AuthClaims, ttlSec = 60 * 60 * 24 * 7): string {
  return jwt.sign(claims, SECRET, { expiresIn: ttlSec, algorithm: "HS256" });
}

export function verifyToken(token: string): AuthClaims {
  const decoded = jwt.verify(token, SECRET, { algorithms: ["HS256"] });
  if (typeof decoded === "string") throw new Error("invalid token");
  return decoded as AuthClaims;
}
