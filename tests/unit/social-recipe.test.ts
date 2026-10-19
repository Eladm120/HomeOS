import { describe, expect, it } from "vitest";
import { captionFromPreview, draftFromCaption, instagramEmbedUrl, parseInstagramEmbed, parseYoutubeDescription, previewMeta } from "@/lib/recipe-parse";

describe("instagramEmbedUrl", () => {
  it("maps posts, reels and user-prefixed links to the captioned embed page", () => {
    expect(instagramEmbedUrl("https://www.instagram.com/reel/C7abc_12-X/?igsh=xyz")).toBe("https://www.instagram.com/reel/C7abc_12-X/embed/captioned/");
    expect(instagramEmbedUrl("https://instagram.com/p/Babcdef/")).toBe("https://www.instagram.com/p/Babcdef/embed/captioned/");
    expect(instagramEmbedUrl("https://www.instagram.com/chef.noa/reels/Cxyz123/")).toBe("https://www.instagram.com/reel/Cxyz123/embed/captioned/");
    expect(instagramEmbedUrl("https://www.instagram.com/chef.noa/")).toBeNull();
    expect(instagramEmbedUrl("https://example.com/p/Babcdef/")).toBeNull();
  });
});

describe("parseInstagramEmbed", () => {
  it("reads the rendered caption block, keeping one line per ingredient", () => {
    const html = `<div class="Caption"><a class="CaptionUsername" href="/chef.noa/">chef.noa</a><br /><br />עוגת שוקולד 🍫<br />2 ביצים<br />1 כוס סוכר<br />200 גרם שוקולד &amp; חמאה<div class="CaptionComments">View all</div></div>
      <img class="EmbeddedMediaImage" src="https://scontent.cdninstagram.com/a.jpg?x=1&amp;y=2" />`;
    const r = parseInstagramEmbed(html);
    expect(r.author).toBe("chef.noa");
    expect(r.caption).toBe("עוגת שוקולד 🍫\n2 ביצים\n1 כוס סוכר\n200 גרם שוקולד & חמאה");
    expect(r.image).toBe("https://scontent.cdninstagram.com/a.jpg?x=1&y=2");
  });

  it("prefers the boot JSON when present", () => {
    const ctx = JSON.stringify({ context: { media: { owner: { username: "noa" }, edge_media_to_caption: { edges: [{ node: { text: "פסטה\n3 כפות שמן" } }] } } } });
    const html = `<script>window.__x = {"contextJSON":${JSON.stringify(ctx)}}</script>`;
    expect(parseInstagramEmbed(html)).toMatchObject({ caption: "פסטה\n3 כפות שמן", author: "noa" });
  });

  it("returns nothing for a login wall", () => {
    expect(parseInstagramEmbed("<html><body>Log in to Instagram</body></html>").caption).toBeNull();
  });
});

describe("link-preview captions", () => {
  it("strips the likes/comments prefix", () => {
    expect(captionFromPreview('1,234 likes, 56 comments - chef.noa on May 1, 2026: "שקשוקה\n4 ביצים".')).toBe("שקשוקה\n4 ביצים");
    expect(captionFromPreview("סתם תיאור")).toBe("סתם תיאור");
    expect(captionFromPreview(null)).toBeNull();
  });

  it("keeps line breaks from og:description", () => {
    const html = `<meta property="og:description" content="a: &quot;שורה 1&#10;2 כוסות קמח&quot;" /><meta property="og:image" content="https://x.com/i.jpg" />`;
    const m = previewMeta(html);
    expect(m.image).toBe("https://x.com/i.jpg");
    expect(captionFromPreview(m.description)).toBe("שורה 1\n2 כוסות קמח");
  });
});

describe("parseYoutubeDescription", () => {
  it("reads the full description from the watch page", () => {
    const html = `var ytInitialPlayerResponse = {"videoDetails":{"shortDescription":"מצרכים:\\n2 כוסות קמח\\n1 כפית מלח","x":1}}`;
    expect(parseYoutubeDescription(html)).toBe("מצרכים:\n2 כוסות קמח\n1 כפית מלח");
  });
});

describe("draftFromCaption on a real-looking caption", () => {
  it("finds quantified ingredient lines", () => {
    const d = draftFromCaption("עוגה\n2 ביצים\n1 כוס סוכר\n#מתכון", "https://www.instagram.com/p/Babcdef/", "מתכון של noa", null);
    expect(d.ingredients.map((i) => i.name)).toEqual(["ביצים", "סוכר"]);
    expect(d.source_platform).toBe("instagram");
  });
});
