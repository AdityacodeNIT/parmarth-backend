import { Product } from "../product/product.models.js";
import { hashNutrition } from "../../utils/HashNutrition.js";
import { geminiModel } from "../../utils/ai.js";

export const getWhyHealthyAI = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    console.log("Product nutrition:", product.nutrition);

    const nutritionHash = hashNutrition(
      product.nutrition,
      product.dietary
    );
    

    /* ───────── CACHE HIT ───────── */
    if (
      product.aiInsights?.whyHealthy?.text &&
      product.aiInsights.whyHealthy.nutritionHash === nutritionHash
    ) {
      return res.json({
        source: "cache",
        text: product.aiInsights.whyHealthy.text,
      });
    }

    /* ───────── PROMPT ───────── */
    const prompt = `You are an impartial nutrition analyst providing informational interpretation only.

Your task is not to restate nutrition numbers, but to explain what the combination and balance of the provided values generally indicates from a dietary structure perspective.

Do not persuade, promote, or encourage consumption. Do not use marketing language or emotional framing. Do not exaggerate benefits or minimize limitations. Do not express opinions or speculation.

Do not make medical, therapeutic, preventive, or disease-related claims. Do not reference health conditions, risk reduction, immunity, metabolism, weight change, muscle gain, or performance. Do not imply superiority over other foods.

Avoid merely listing nutrients or repeating the data in sentence form. Instead, describe how the relative presence of protein, fibre, sugar, fat, calories, and sodium typically function together in everyday dietary patterns. Focus on balance, proportion, and practical dietary role rather than outcomes.

If a nutrient level is moderate or limited, describe this neutrally. If the data does not support a clear interpretation, state that limitation directly.

Use simple, declarative sentences. Each sentence should convey one analytical idea. Avoid adjectives unless they describe quantity or presence. Avoid conclusions, summaries, or recommendations.

Write in plain text only. Do not use bullet points, numbering, headings, emojis, symbols, or formatting. Do not reference yourself or the instructions.

Nutrition data
Protein ${product.nutrition.macros.protein} grams
Fibre ${product.nutrition.macros.fibre} grams
Sugar ${product.nutrition.macros.sugar} grams
Fat ${product.nutrition.macros.fat} grams
Calories ${product.nutrition.energy.calories}
Sodium ${product.nutrition.micros.minerals.sodium} milligrams

Dietary classification
Vegan ${product.dietary.isVegan}
Sugar free ${product.dietary.isSugarFree}

Produce a short paragraph of three to four sentences explaining how this nutritional profile generally fits into common dietary patterns. The response should reflect expert interpretation of nutrient balance rather than a factual recap of values.`;

  const result = await geminiModel.generateContent({
  contents: [
    {
      role: "user",
      parts: [{ text: prompt }],
    },
  ],
  generationConfig: {
    temperature: 0.25,
    maxOutputTokens: 25000,
  },
});

const text = result.response.text(); // ✅ CORRECT

if (!text) {
  return res.status(500).json({ error: "AI response empty" });
}
console.log("Gemini response text:", text);

    /* ───────── STORE IN DB ───────── */
    product.aiInsights = {
      whyHealthy: {
        text,
        generatedAt: new Date(),
        nutritionHash,
      },
    };

    await product.save();

    res.json({ source: "ai", text });
  } catch (err) {
    console.error("Gemini error:", err);
    res.status(500).json({ error: "AI generation failed" });
  }
};
