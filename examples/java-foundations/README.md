# Java foundations: calculate an order total

This is the first executable lab. Use JDK 21. No Maven, Docker, database, or network is needed.
Run this command from the repository root in Bash (Linux, macOS, WSL, or Git Bash):

```bash
bash examples/java-foundations/run.sh
```

Expected output:

```console
Order total: 2598 cents
PASS: 12 checks
```

The script compiles into a temporary directory and removes that directory when it exits.
For a different shell, run these commands from this lab directory:

```bash
javac --release 21 -d build src/OrderCalculator.java test/OrderCalculatorTest.java
java -cp build OrderCalculator
java -cp build OrderCalculatorTest
```

Read [the implementation](src/OrderCalculator.java), then [the tests](test/OrderCalculatorTest.java).
A method is a named operation. A record groups values. A list stores several items.
The loop adds the cost of each line to the total. Two items at 1,299 cents cost 2,598 cents.

The rule uses one currency with 100 cents per unit. Prices come from a trusted catalog
in a real service; a client must not choose the price it pays. Empty carts total zero,
but a checkout operation would reject an empty order. This calculation does not reserve
stock, charge money, or save anything to a database.

The tests cover valid totals, empty and null inputs, invalid quantities, and overflow.
Overflow means a number cannot fit in the chosen integer type. `Math.addExact` and
`Math.multiplyExact` report this as an error instead of silently wrapping the value.
See the [Java 21 Math API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Math.html).

## Build, break, explain

1. Predict the total for two lines: 250 cents × 3 and 100 cents × 2. Add a test for 950.
2. Change the quantity validation to accept zero. Run the tests and explain the failure.
3. Restore the validation. Replace `Math.addExact` with `+`. Explain which boundary test fails.
4. Restore the safe addition. Add a maximum quantity of 100 with tests for 100 and 101.
5. Explain why passing these tests proves this calculation, but says nothing about HTTP or database transactions.

Done means you can change the rule, observe a failing test, fix it, and explain the result
without copying a solution. Commit that evidence to your own learning repository.
