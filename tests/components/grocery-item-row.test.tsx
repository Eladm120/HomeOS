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
const dairy = { name: "מוצרי חלב", icon: "milk" };

describe("GroceryItemRow", () => {
  it("shows name, brand, who added it, quantity and urgency", () => {
    render(<GroceryItemRow item={base} category={dairy} checked={false} addedByName="נעה" onToggle={() => {}} />);
    expect(screen.getByText("חלב")).toBeInTheDocument();
    expect(screen.getByText("תנובה · 3% · נעה")).toBeInTheDocument();
    expect(screen.getByText("2 ליטר")).toBeInTheDocument();
    expect(screen.getByText("דחוף")).toBeInTheDocument();
  });

  it("shows a product picture when there is no photo", () => {
    const { container } = render(<GroceryItemRow item={base} category={dairy} checked={false} onToggle={() => {}} />);
    expect(container.textContent).toContain("🥛");
  });

  it("toggles via the checkbox without opening the editor", () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    render(<GroceryItemRow item={base} category={null} checked={false} onToggle={onToggle} onOpen={onOpen} />);
    const box = screen.getByRole("checkbox", { name: "סימון חלב כנקנה" });
    expect(box).toHaveAttribute("aria-checked", "false");
    fireEvent.click(box);
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("renders checked items struck through, without the urgency tag", () => {
    render(<GroceryItemRow item={{ ...base, status: "purchased" }} category={null} checked onToggle={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "החזרת חלב לרשימה" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("חלב").className).toContain("line-through");
    expect(screen.queryByText("דחוף")).not.toBeInTheDocument();
  });
});
