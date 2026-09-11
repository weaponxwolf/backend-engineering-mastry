import java.util.Arrays;
import java.util.List;

/** No test library is needed for this first lab. Failures exit with an error. */
public class OrderCalculatorTest {
    private static int checks;

    public static void main(String[] args) {
        equal(2598, OrderCalculator.totalCents(List.of(item(1299, 2))), "two units");
        equal(3098, OrderCalculator.totalCents(List.of(item(1299, 2), item(500, 1))),
                "multiple lines");
        equal(0, OrderCalculator.totalCents(List.of()), "empty cart");
        equal(0, OrderCalculator.totalCents(List.of(item(0, 3))), "free item");
        equal(Long.MAX_VALUE, OrderCalculator.totalCents(List.of(item(Long.MAX_VALUE, 1))),
                "largest representable total");
        throwsType(IllegalArgumentException.class, () -> item(-1, 1), "negative price");
        throwsType(IllegalArgumentException.class, () -> item(100, 0), "zero quantity");
        throwsType(IllegalArgumentException.class, () -> item(100, -1), "negative quantity");
        throwsType(NullPointerException.class, () -> OrderCalculator.totalCents(null), "null cart");
        throwsType(NullPointerException.class,
                () -> OrderCalculator.totalCents(Arrays.asList((OrderCalculator.LineItem) null)),
                "null item");
        throwsType(ArithmeticException.class,
                () -> OrderCalculator.totalCents(List.of(item(Long.MAX_VALUE, 2))),
                "multiplication overflow");
        throwsType(ArithmeticException.class,
                () -> OrderCalculator.totalCents(List.of(item(Long.MAX_VALUE, 1), item(1, 1))),
                "addition overflow");
        System.out.println("PASS: " + checks + " checks");
    }

    private static OrderCalculator.LineItem item(long price, int quantity) {
        return new OrderCalculator.LineItem(price, quantity);
    }

    private static void equal(long expected, long actual, String name) {
        if (expected != actual) {
            throw new AssertionError(name + ": expected " + expected + ", got " + actual);
        }
        checks++;
    }

    private static void throwsType(Class<? extends Throwable> type, Runnable action, String name) {
        try {
            action.run();
        } catch (Throwable failure) {
            if (!type.isInstance(failure)) {
                throw new AssertionError(name + ": wrong failure type", failure);
            }
            checks++;
            return;
        }
        throw new AssertionError(name + ": expected " + type.getSimpleName());
    }
}
