#!/usr/bin/env bash
set -euo pipefail

lab_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v javac >/dev/null || ! command -v java >/dev/null; then
  echo 'Install JDK 21 and make java and javac available on PATH.' >&2
  exit 1
fi

lab_build_dir="$(mktemp -d "${TMPDIR:-/tmp}/java-foundations.XXXXXX")"
trap 'rm -rf "$lab_build_dir"' EXIT
javac --release 21 -Xlint:all -Werror -d "$lab_build_dir" \
  "$lab_dir/src/OrderCalculator.java" "$lab_dir/test/OrderCalculatorTest.java"
java -cp "$lab_build_dir" OrderCalculator
java -cp "$lab_build_dir" OrderCalculatorTest
