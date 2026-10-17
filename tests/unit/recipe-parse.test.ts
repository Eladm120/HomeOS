import { describe, expect, it } from "vitest";
import { detectPlatform, draftFromCaption, isoDurationMinutes, parseRecipeHtml } from "@/lib/recipe-parse";

const blog = `<html><head><title>עוגת שוקולד</title>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Recipe",
"name":"עוגת שוקולד &amp; אגוזים","description":"<p>עוגה פשוטה</p>","image":[{"url":"https://img.example/cake.jpg"}],
"prepTime":"PT20M","cookTime":"PT1H5M","recipeYield":"8 מנות",
"recipeIngredient":["2 כוסות קמח","200 גרם שוקולד מריר","3 ביצים"],
"recipeInstructions":[{"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"מחממים תנור."},{"@type":"HowToStep","text":"מערבבים הכל."}]}]}]}</script>
</head></html>`;

describe("recipe parsing", () => {
  it("reads schema.org Recipe from JSON-LD graphs", () => {
    const d = parseRecipeHtml(blog, "https://www.foodblog.co.il/cake");
    expect(d.title).toBe("עוגת שוקולד & אגוזים");
    expect(d.description).toBe("עוגה פשוטה");
    expect(d.image_url).toBe("https://img.example/cake.jpg");
    expect(d.prep_minutes).toBe(20);
    expect(d.cook_minutes).toBe(65);
    expect(d.servings).toBe(8);
    expect(d.ingredients).toEqual([
      { name: "קמח", quantity: 2, unit: "כוסות" },
      { name: "שוקולד מריר", quantity: 200, unit: "גרם" },
      { name: "ביצים", quantity: 3, unit: null },
    ]);
    expect(d.steps).toEqual(["מחממים תנור.", "מערבבים הכל."]);
    expect(d.completeness).toBe("full");
    expect(d.source_platform).toBe("website");
  });

  it("falls back to Open Graph when there is no structured recipe", () => {
    const d = parseRecipeHtml(
      `<meta property="og:title" content="פסטה ברוטב"><meta property="og:description" content="מהיר"><meta property="og:image" content="http://insecure/img.jpg">`,
      "https://example.com/p",
    );
    expect(d.title).toBe("פסטה ברוטב");
    expect(d.image_url).toBeNull();
    expect(d.ingredients).toEqual([]);
    expect(d.completeness).toBe("partial");
    expect(d.notice).toBeTruthy();
  });

  it("detects platforms and durations", () => {
    expect(detectPlatform("https://www.instagram.com/reel/abc")).toBe("instagram");
    expect(detectPlatform("https://vm.tiktok.com/xyz")).toBe("tiktok");
    expect(detectPlatform("https://youtu.be/1")).toBe("youtube");
    expect(isoDurationMinutes("PT1H30M")).toBe(90);
    expect(isoDurationMinutes("garbage")).toBeNull();
  });

  it("pulls quantified ingredient lines out of a video caption", () => {
    const d = draftFromCaption("שקשוקה מהירה 🍅\n• 4 עגבניות\n• 2 כפות שמן זית\nבתיאבון!", "https://www.tiktok.com/@x/video/1", "שקשוקה", null);
    expect(d.ingredients.map((i) => i.name)).toEqual(["עגבניות", "שמן זית"]);
    expect(d.source_platform).toBe("tiktok");
  });
});
