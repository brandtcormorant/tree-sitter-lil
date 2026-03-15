/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "lil",

  extras: ($) => [/\s/, $.comment],

  conflicts: ($) => [[$.block, $.table_literal]],

  word: ($) => $.identifier,

  rules: {
    source_file: ($) => repeat($._statement),

    _statement: ($) => choice($.let_declaration, $.assignment, $._expression),

    // --- Declarations ---

    let_declaration: ($) =>
      seq("let", field("name", $.identifier), "=", field("value", $._expression)),

    assignment: ($) =>
      prec.right(
        1,
        seq(field("name", $.identifier), "=", field("value", $._expression)),
      ),

    // --- Expressions ---

    _expression: ($) =>
      choice(
        $.match_expression,
        $.function_definition,
        $.continue_expression,
        $.return_expression,
        $.binary_expression,
        $.unary_expression,
        $.call_expression,
        $.index_expression,
        $.field_expression,
        $.parenthesized_expression,
        $.table_literal,
        $.array_literal,
        $._primary,
      ),

    // --- Binary expressions with precedence ---

    binary_expression: ($) =>
      choice(
        ...[
          ["==", 3],
          ["!=", 3],
          ["<", 4],
          [">", 4],
          ["<=", 4],
          [">=", 4],
          ["+", 5],
          ["-", 5],
          ["*", 6],
          ["/", 6],
          ["%", 6],
        ].map(([op, prec_val]) =>
          prec.left(
            prec_val,
            seq(
              field("left", $._expression),
              field("operator", op),
              field("right", $._expression),
            ),
          ),
        ),
      ),

    unary_expression: ($) =>
      prec(
        7,
        seq(
          field("operator", choice("-", "!")),
          field("operand", $._expression),
        ),
      ),

    // --- Postfix ---

    call_expression: ($) =>
      prec(
        8,
        seq(
          field("function", $._expression),
          "(",
          field("arguments", optional($.argument_list)),
          ")",
        ),
      ),

    argument_list: ($) => seq($._expression, repeat(seq(",", $._expression))),

    index_expression: ($) =>
      prec(
        8,
        seq(
          field("object", $._expression),
          "[",
          field("index", $._expression),
          "]",
        ),
      ),

    field_expression: ($) =>
      prec(
        8,
        seq(
          field("object", $._expression),
          ".",
          field("field", $.identifier),
        ),
      ),

    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    // --- Match ---

    match_expression: ($) =>
      seq(
        "match",
        field("scrutinee", $._expression),
        "{",
        optional($.match_body),
        "}",
      ),

    match_body: ($) =>
      seq($.match_arm, repeat(seq(",", $.match_arm)), optional(",")),

    match_arm: ($) =>
      seq(field("pattern", $._pattern), "=>", field("body", choice(prec(1, $.block), $._expression))),

    _pattern: ($) =>
      choice(
        $.integer,
        $.float,
        $.string,
        $.tag,
        $.true,
        $.false,
        $.nil,
        $.identifier,
      ),

    // --- Functions ---

    function_definition: ($) =>
      seq(
        "fn",
        "(",
        field("parameters", optional($.parameter_list)),
        ")",
        field("body", $.block),
      ),

    parameter_list: ($) =>
      seq($.identifier, repeat(seq(",", $.identifier))),

    block: ($) => seq("{", repeat($._statement), "}"),

    // --- Continue / Return ---

    continue_expression: ($) => prec.right(2, seq("continue", $._expression)),

    return_expression: ($) => prec.right(2, seq("return", $._expression)),

    // --- Composite literals ---

    table_literal: ($) =>
      seq(
        "{",
        optional(seq($.table_field, repeat(seq(",", $.table_field)), optional(","))),
        "}",
      ),

    table_field: ($) =>
      seq(field("key", $.identifier), ":", field("value", $._expression)),

    array_literal: ($) =>
      seq(
        "[",
        optional(
          seq($._expression, repeat(seq(",", $._expression)), optional(",")),
        ),
        "]",
      ),

    // --- Primaries ---

    _primary: ($) =>
      choice(
        $.integer,
        $.float,
        $.string,
        $.tag,
        $.true,
        $.false,
        $.nil,
        $.identifier,
      ),

    integer: (_) => /\d+/,

    float: (_) => /\d+\.\d+/,

    string: (_) => seq('"', repeat(choice(/[^"\\]+/, /\\./)), '"'),

    tag: (_) => /:[a-zA-Z_][a-zA-Z0-9_]*/,

    true: (_) => "true",
    false: (_) => "false",
    nil: (_) => "nil",

    identifier: (_) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    comment: (_) => token(seq("//", /.*/)),
  },
});
