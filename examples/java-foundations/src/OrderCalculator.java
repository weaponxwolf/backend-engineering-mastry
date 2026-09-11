import java.util.List;
import java.util.Objects;

/** A small business rule with no web server or database. */
public class OrderCalculator {
    public record LineItem(long unitPriceCents, int quantity) {
        public LineItem {
            if (unitPriceCents < 0) {
                throw new IllegalArgumentException("Price cannot be negative");
            }
            if (quantity <= 0) {
                throw new IllegalArgumentException("Quantity must be positive");
            }
        }
    }

    public static long totalCents(List<LineItem> items) {
        Objects.requireNonNull(items, "Cart is required");
        long total = 0;
        for (LineItem item : items) {
            Objects.requireNonNull(item, "Cart cannot contain a null item");
            long lineTotal = Math.multiplyExact(item.unitPriceCents(), item.quantity());
            total = Math.addExact(total, lineTotal);
        }
        return total;
    }

    public static void main(String[] args) {
        List<LineItem> cart = List.of(new LineItem(1299, 2));
        System.out.println("Order total: " + totalCents(cart) + " cents");
    }
}
