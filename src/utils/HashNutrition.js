import crypto from "crypto";

export function hashNutrition(nutrition, dietary) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ nutrition, dietary }))
    .digest("hex");
}
