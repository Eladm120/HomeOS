import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GroceryItemRow } from "@/components/grocery/item-row";
import type { ShoppingListItem } from "@/lib/types";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowser: () => ({}) }));

const base: ShoppingListItem = {
  id: "1", household_id: "h", list_id: "l", catalog_product_id: null, inventory_item_id: null, category_id: null,
  name: "חלב", quantity: 2, unit: "ליטר", brand: "תנובה", variant: "3%", notes: null, priority: "high", status: "pending",
  image_path: null, added_by: null, purchased_by: null, purchased_at: null, cleared_at: null, deleted_at: null,
  version: 1, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

describe("GroceryItemRow", () => {
  it("shows name, brand, quantity and urgency", () => {
    render(<GroceryItemRow item={base} addedByName="נעה" onToggle={() => {}} />);
    expect(screen.getByText("חלב")).toBeInTheDocument();
    expect(screen.getByText("תנובה · 3%")).toBeInTheDocument();
    expect(screen.getByText("2 ליטר")).toBeInTheDocument();
    expect(screen.getByLabelText("דחוף")).toBeInTheDocument();
    expect(screen.getByText("נעה")).toBeInTheDocument();
  });

  it("toggles via the checkbox without opening the editor", () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    render(<GroceryItemRow item={base} onToggle={onToggle} onOpen={onOpen} />);
    const box = screen.getByRole("checkbox", { name: "סימון חלב כנקנה" });
    expect(box).toHaveAttribute("aria-checked", "false");
    fireEvent.click(box);
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("renders purchased items as checked", () => {
    render(<GroceryItemRow item={{ ...base, status: "purchased" }} onToggle={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "ביטול סימון חלב" })).toHaveAttribute("aria-checked", "true");
  });
});
